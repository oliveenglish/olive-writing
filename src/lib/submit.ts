import { db, BUCKET } from "./supabase";
import { aiCorrect, aiEnabled } from "./ai";
import { position, scheduleReviews, taughtCodes } from "./data";
import type { Profile } from "./auth";

/** 사진 올리기 → 저장 경로 */
export async function uploadPhoto(studentId: string, file: File | null): Promise<string | null> {
  if (!file || !file.size) return null;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${studentId}/${Date.now()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw new Error("사진을 올리지 못했어요: " + error.message);
  return path;
}

async function photoBase64(path: string) {
  const { data } = await db().storage.from(BUCKET).download(path);
  if (!data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const mediaType = (data.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";
  return { base64: buf.toString("base64"), mediaType };
}

/**
 * 글쓰기 제출 만들기.
 * AI 키가 있으면 첨삭 초안만 붙여 두고, 결과는 항상 쌤이 확인한 뒤에 보내요.
 */
export async function createSubmission(opts: {
  student: Profile;
  kind: "unit_answer" | "weekly" | "final" | "task" | "hand";
  ref: string;
  title: string;
  text: string | null;
  photo: File | null;
  rubric?: Record<string, unknown>;
  parentId?: string | null;
}) {
  const photo_path = await uploadPhoto(opts.student.id, opts.photo);
  const { data: sub, error } = await db()
    .from("submissions")
    .insert({
      student_id: opts.student.id,
      kind: opts.kind,
      ref: opts.ref,
      title: opts.title,
      text_content: opts.text,
      photo_path,
      rubric: opts.rubric ?? null,
      parent_id: opts.parentId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (aiEnabled()) {
    const pos = await position(opts.student.id);
    const level = pos.type === "unit" ? `${pos.unit.stage} · ${pos.unit.title}` : pos.type === "final" ? pos.stage : "초급";
    const codes = await taughtCodes(opts.student.id);
    const draft = await aiCorrect({
      task: opts.title,
      text: opts.text,
      photo: photo_path ? await photoBase64(photo_path) : null,
      codes,
      level,
    });
    if (draft) {
      const teacher = await classTeacher(opts.student);
      const autosend = false; // 쌤 결정: 모든 제출은 쌤이 확인한 뒤 결과를 보내요 (AI는 초안만)
      await db()
        .from("submissions")
        .update(
          autosend
            ? {
                ai_draft: draft,
                status: "returned",
                corrected_text: draft.corrected,
                teacher_comment: draft.comment,
                error_codes: draft.error_codes,
                returned_at: new Date().toISOString(),
              }
            : { ai_draft: draft }
        )
        .eq("id", sub.id);
      if (autosend) await recordWritingCodes(opts.student.id, draft.error_codes, opts.ref);
    }
  }
  return sub.id as string;
}

async function classTeacher(student: Profile) {
  if (!student.class_id) return null;
  const { data: c } = await db().from("classes").select("teacher_id").eq("id", student.class_id).maybeSingle();
  if (!c) return null;
  const { data: t } = await db().from("profiles").select("*").eq("id", c.teacher_id).maybeSingle();
  return t as Profile | null;
}

/** 글쓰기에서 찍힌 코드도 기록 → 약점 · 복습으로 연결 */
export async function recordWritingCodes(studentId: string, codes: string[], ref: string) {
  if (!codes?.length) return;
  await db()
    .from("attempts")
    .insert(codes.map((c) => ({ student_id: studentId, context: "writing", correct: false, error_code: c, unit_id: ref })));
  await scheduleReviews(studentId, codes);
}
