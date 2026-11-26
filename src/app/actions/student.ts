"use server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase";
import { getUnit } from "@/lib/content";
import { latestProofs } from "@/lib/progress";

const KEY = /^(w\d+-(flash|match|word|meaning)|s\d+-(shadow|chunk)|video)$/;

/** 앱 활동을 마치면 체크 (단어 학습 · 문장 연습 · ③ 영상 강의 다 봤어요) */
export async function saveCheck(unitId: string, key: string, score?: number, total?: number) {
  const me = await requireStudent();
  if (!KEY.test(key) || !getUnit(unitId)) return;
  await db()
    .from("app_checks")
    .upsert(
      { student_id: me.id, unit_id: unitId, key, score: score ?? null, total: total ?? null, done_at: new Date().toISOString() },
      { onConflict: "student_id,unit_id,key" }
    );
  revalidatePath("/student");
}

/**
 * ② · ⑤ · ⑦ 인증 사진 올리기 (여러 장은 화면에서 한 장으로 이어 붙여서 와요)
 * 쌤이 아직 안 본 사진이 있으면 새 사진으로 바꿔요.
 */
export async function uploadProof(unitId: string, step: number, fd: FormData): Promise<{ ok: boolean; message: string }> {
  const me = await requireStudent();
  if (![2, 5, 7].includes(step) || !getUnit(unitId)) return { ok: false, message: "어느 숙제인지 알 수 없어요." };
  const photo = fd.get("photo");
  if (!(photo instanceof File) || !photo.size) return { ok: false, message: "사진을 올려 주세요." };
  const latest = await latestProofs(me.id, unitId);
  if (step === 7) {
    const p5 = latest.get(5);
    if (!p5 || p5.status !== "returned") return { ok: false, message: "쌤 첨삭이 오면 다시 쓰기를 올릴 수 있어요." };
  }
  const prev = latest.get(step);
  if (prev && prev.status === "submitted") {
    await db().storage.from(BUCKET).remove([prev.photo_path]);
    await db().from("proofs").delete().eq("id", prev.id);
  }
  const path = `${me.id}/${unitId.replace(/[^A-Za-z0-9-]/g, "_")}-${step}-${Date.now()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(path, photo, { contentType: photo.type || "image/jpeg" });
  if (error) return { ok: false, message: "사진을 올리지 못했어요: " + error.message };
  const { error: e2 } = await db().from("proofs").insert({ student_id: me.id, unit_id: unitId, step, photo_path: path });
  if (e2) return { ok: false, message: "저장하지 못했어요: " + e2.message };
  revalidatePath("/student");
  return { ok: true, message: step === 5 ? "쌤에게 보냈어요! 첨삭이 오면 ⑥에서 확인해요." : "쌤에게 보냈어요!" };
}

/** 첨삭 · 확인 결과를 봤어요 */
export async function markSeen(proofId: string) {
  const me = await requireStudent();
  await db().from("proofs").update({ seen: true }).eq("id", proofId).eq("student_id", me.id);
}
