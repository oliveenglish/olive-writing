"use server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getUnit } from "@/lib/content";
import { cleanUrl } from "@/lib/zoom";
import { COMMON, MAT_BUCKET } from "@/lib/materials";

/* ───── 영상 강의 · 숙제 안내 (유닛마다 하나) ───── */
export async function saveGuide(unitId: string, _: { msg?: string; ok?: boolean } | undefined, fd: FormData): Promise<{ msg: string; ok: boolean }> {
  const me = await requireTeacher();
  if (!getUnit(unitId)) return { ok: false, msg: "유닛을 찾을 수 없어요." };
  const url = cleanUrl(fd.get("video_url"));
  if (url === false) return { ok: false, msg: "영상 주소는 https:// 로 시작하는 주소를 붙여 넣어 주세요." };
  const row = {
    unit_id: unitId,
    teacher_id: me.id,
    video_url: url,
    video_title: String(fd.get("video_title") || "").trim() || null,
    video_note: String(fd.get("video_note") || "").trim() || null,
    homework: String(fd.get("homework") || "").trim() || null,
    must_watch: fd.get("must_watch") === "on",
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("unit_guides").upsert(row, { onConflict: "unit_id" });
  if (error) return { ok: false, msg: "저장하지 못했어요: " + error.message + " (Supabase에서 schema.sql을 다시 실행했는지 확인)" };
  revalidatePath("/teacher/videos");
  revalidatePath("/student");
  return { ok: true, msg: `${unitId} 저장했어요. 학생 홈 ③ 영상 강의 · 숙제 안내에 바로 보여요.` };
}

/* ───── 교재 폴더 ───── */
const okFolder = (f: string) => f === COMMON || !!getUnit(f);

/** 파일을 브라우저에서 바로 Supabase로 올릴 수 있는 1회용 주소 (Vercel 용량 제한을 피해요) */
export async function materialUploadUrl(folder: string, fileName: string): Promise<{ path: string; token: string } | { error: string }> {
  const me = await requireTeacher();
  if (!okFolder(folder)) return { error: "폴더를 골라 주세요." };
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "pdf";
  const safe = folder.replace(/[^A-Za-z0-9-]/g, "_");
  const path = `${me.id}/${safe}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await db().storage.from(MAT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "올릴 준비를 못 했어요: " + (error?.message ?? "") + " (schema.sql을 다시 실행했는지 확인)" };
  return { path: data.path, token: data.token };
}

export async function saveMaterial(input: { path: string; title: string; size: number; folder: string; visible: string; studentIds: string[]; isNew: boolean }): Promise<{ error?: string }> {
  const me = await requireTeacher();
  if (!okFolder(input.folder)) return { error: "폴더를 골라 주세요." };
  if (!input.path.startsWith(`${me.id}/`)) return { error: "파일 경로가 맞지 않아요." };
  const visible = ["all", "teacher", "some"].includes(input.visible) ? input.visible : "all";
  const { error } = await db().from("materials").insert({
    teacher_id: me.id,
    folder: input.folder,
    title: input.title.slice(0, 200) || "자료",
    file_path: input.path,
    size: input.size,
    visible,
    student_ids: visible === "some" ? input.studentIds : [],
    is_new: input.isNew,
  });
  if (error) {
    await db().storage.from(MAT_BUCKET).remove([input.path]);
    return { error: "저장하지 못했어요: " + error.message };
  }
  revalidatePath("/teacher/materials");
  revalidatePath("/student/materials");
  revalidatePath("/student");
  return {};
}

export async function deleteMaterial(id: string) {
  const me = await requireTeacher();
  const { data } = await db().from("materials").select("file_path").eq("id", id).eq("teacher_id", me.id).maybeSingle();
  if (!data) return;
  await db().storage.from(MAT_BUCKET).remove([data.file_path]);
  await db().from("materials").delete().eq("id", id).eq("teacher_id", me.id);
  revalidatePath("/teacher/materials");
  revalidatePath("/student/materials");
}

export async function toggleNewMaterial(id: string, on: boolean) {
  const me = await requireTeacher();
  await db().from("materials").update({ is_new: on }).eq("id", id).eq("teacher_id", me.id);
  revalidatePath("/teacher/materials");
  revalidatePath("/student/materials");
}
