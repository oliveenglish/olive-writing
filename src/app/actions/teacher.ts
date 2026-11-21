"use server";
import { revalidatePath } from "next/cache";
import { requireTeacher, studentEmail, studentPassword } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase";
import { firstUnit, getUnit, nextUnit } from "@/lib/content";

/* ───── 학생 ───── */
export type MakeStudentState = { error?: string; made?: { name: string; username: string; pin: string } } | undefined;

/** 쌤이 학생 아이디 · PIN을 직접 만들어 주기 */
export async function makeStudent(_: MakeStudentState, fd: FormData): Promise<MakeStudentState> {
  const me = await requireTeacher();
  const name = String(fd.get("name") || "").trim();
  const grade = String(fd.get("grade") || "").trim() || null;
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const pin = String(fd.get("pin") || "").trim();
  const unit = String(fd.get("unit") || "");
  const days = fd.getAll("day").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!name || !username || !pin) return { error: "이름 · 아이디 · PIN을 채워 주세요." };
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: "아이디는 영어 소문자 · 숫자 3~20자로 만들어요. (예: minji01)" };
  if (!/^\d{4}$/.test(pin)) return { error: "PIN은 숫자 4자리예요." };
  const { data: taken } = await db().from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { error: `'${username}'은(는) 이미 있는 아이디예요. 다른 아이디로 해 주세요.` };
  // 반은 하나만 써요: 쌤의 첫 반 (없으면 '내 학생' 반을 만들어요)
  let classId: string;
  const { data: c } = await db().from("classes").select("id").eq("teacher_id", me.id).order("created_at").limit(1).maybeSingle();
  if (c) classId = c.id;
  else {
    const { data: nc, error } = await db().from("classes").insert({ name: "내 학생", code: "OLIVE-" + Math.floor(1000 + Math.random() * 9000), teacher_id: me.id }).select("id").single();
    if (error || !nc) return { error: "반을 만들지 못했어요: " + (error?.message ?? "") };
    classId = nc.id;
  }
  const { data: created, error } = await db().auth.admin.createUser({ email: studentEmail(username), password: studentPassword(pin), email_confirm: true });
  if (error || !created.user) return { error: "계정을 만들지 못했어요: " + (error?.message ?? "") };
  const { error: e2 } = await db().from("profiles").insert({
    id: created.user.id,
    role: "student",
    name,
    grade,
    username,
    class_id: classId,
    current_unit: getUnit(unit)?.id ?? null,
    class_days: Array.from(new Set(days)).sort((a, b) => a - b),
  });
  if (e2) {
    await db().auth.admin.deleteUser(created.user.id);
    return { error: "학생 정보를 저장하지 못했어요: " + e2.message + " (schema.sql을 실행했는지 확인)" };
  }
  revalidatePath("/teacher");
  return { made: { name, username, pin } };
}

/** 학생 정보 · 유닛 · 수업 요일 · 메모 한 번에 저장 */
export async function saveStudent(studentId: string, fd: FormData) {
  await requireTeacher();
  const name = String(fd.get("name") || "").trim();
  const unit = getUnit(String(fd.get("unit") || ""));
  const days = fd.getAll("day").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const patch: Record<string, unknown> = {
    grade: String(fd.get("grade") || "").trim() || null,
    memo: String(fd.get("memo") || ""),
    class_days: Array.from(new Set(days)).sort((a, b) => a - b),
  };
  if (name) patch.name = name;
  if (unit) patch.current_unit = unit.id;
  await db().from("profiles").update(patch).eq("id", studentId);
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher");
}

export async function resetPin(studentId: string, fd: FormData) {
  await requireTeacher();
  const pin = String(fd.get("pin") || "").trim();
  if (!/^\d{4}$/.test(pin)) return;
  await db().auth.admin.updateUserById(studentId, { password: studentPassword(pin) });
  revalidatePath(`/teacher/students/${studentId}`);
}

/* ───── 인증 확인 · 첨삭 ───── */

/**
 * ② · ⑦ 확인: ✓ 확인 / ↺ 다시 써 와요
 * ⑦을 ✓ 확인하면 그 학생은 다음 유닛으로 넘어가요.
 */
export async function checkProof(proofId: string, decision: "ok" | "redo", comment: string) {
  await requireTeacher();
  if (decision !== "ok" && decision !== "redo") return;
  const { data: p } = await db().from("proofs").select("*").eq("id", proofId).maybeSingle();
  if (!p) return;
  await db()
    .from("proofs")
    .update({ status: "returned", decision, comment: comment.trim() || null, seen: false, returned_at: new Date().toISOString() })
    .eq("id", proofId);
  if (p.step === 7 && decision === "ok") {
    // 그 학생이 아직 이 유닛에 있을 때만 다음 유닛으로 (쌤이 이미 다른 유닛으로 옮겼으면 그대로)
    const { data: st } = await db().from("profiles").select("current_unit").eq("id", p.student_id).maybeSingle();
    const now = getUnit(st?.current_unit)?.id ?? firstUnit().id;
    const nx = nextUnit(p.unit_id);
    if (nx && now === p.unit_id) await db().from("profiles").update({ current_unit: nx.id }).eq("id", p.student_id);
  }
  revalidatePath("/teacher");
  revalidatePath("/teacher/proofs");
}

/** ⑤ 빨간 펜 첨삭 보내기 (사진 위 그림 + 한마디) */
export async function correctProof(proofId: string, fd: FormData) {
  await requireTeacher();
  const { data: p } = await db().from("proofs").select("*").eq("id", proofId).maybeSingle();
  if (!p) return;
  let markup_path: string | null = p.markup_path;
  const markup = fd.get("markup");
  if (markup instanceof File && markup.size) {
    markup_path = `${p.student_id}/markup-${proofId}-${Date.now()}.png`;
    await db().storage.from(BUCKET).upload(markup_path, markup, { contentType: "image/png", upsert: true });
  }
  await db()
    .from("proofs")
    .update({ status: "returned", decision: "corrected", markup_path, comment: String(fd.get("comment") || "").trim() || null, seen: false, returned_at: new Date().toISOString() })
    .eq("id", proofId);
  revalidatePath("/teacher/proofs");
  revalidatePath("/teacher");
}
