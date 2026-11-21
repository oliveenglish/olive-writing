import { redirect } from "next/navigation";
import { db, serverClient } from "./supabase";

export type Profile = {
  id: string;
  role: "student" | "teacher";
  name: string;
  username: string | null;
  grade: string | null;
  nickname: string | null;
  class_id: string | null;
  start_unit: string | null;
  memo: string | null;
  ai_autosend: boolean | null;
  class_days: number[] | null;
  last_seen_at: string | null;
  created_at: string;
};

/** 학생 아이디 → 내부 로그인용 이메일 */
export const studentEmail = (username: string) => `${username.trim().toLowerCase()}@students.example.com`;
/** PIN 4자리 → 내부 비밀번호 (Supabase는 6자 이상 필요) */
export const studentPassword = (pin: string) => `${pin.trim()}#olive`;

export async function currentProfile(): Promise<Profile | null> {
  const { data } = await serverClient().auth.getUser();
  if (!data.user) return null;
  const { data: p } = await db().from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return (p as Profile) ?? null;
}

export async function requireStudent(): Promise<Profile> {
  const p = await currentProfile();
  if (!p) redirect("/login");
  if (p.role !== "student") redirect("/teacher");
  // 접속 시간은 10분에 한 번만 저장 (문제마다 저장하면 느려져요)
  if (!p.last_seen_at || Date.now() - new Date(p.last_seen_at).getTime() > 10 * 60 * 1000)
    await db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", p.id);
  return p;
}

export async function requireTeacher(): Promise<Profile> {
  const p = await currentProfile();
  if (!p) redirect("/login?tab=teacher");
  if (p.role !== "teacher") redirect("/student");
  return p;
}

export function teacherEmails(): string[] {
  return (process.env.TEACHER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
