import { db } from "./supabase";
import type { Profile } from "./auth";

/** 이 쌤 반의 학생들 */
export async function myStudents(teacherId: string) {
  const { data: classes } = await db().from("classes").select("*").eq("teacher_id", teacherId).order("created_at");
  const ids = (classes ?? []).map((c) => c.id);
  const { data: students } = ids.length
    ? await db().from("profiles").select("*").eq("role", "student").in("class_id", ids).order("name")
    : { data: [] as Profile[] };
  return { classes: classes ?? [], students: (students as Profile[]) ?? [] };
}

/** 확인 · 첨삭 기다리는 인증 사진 수 */
export async function pendingCount(teacherId: string) {
  const { students } = await myStudents(teacherId);
  if (!students.length) return 0;
  const { count } = await db()
    .from("proofs")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .in("student_id", students.map((s) => s.id));
  return count ?? 0;
}
