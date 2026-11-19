"use server";
import { redirect } from "next/navigation";
import { db, serverClient } from "@/lib/supabase";
import { studentEmail, studentPassword, teacherEmails } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function loginStudent(_: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const pin = String(fd.get("pin") || "").trim();
  if (!username || !pin) return { error: "아이디와 PIN을 입력해 주세요." };
  const { error } = await serverClient().auth.signInWithPassword({ email: studentEmail(username), password: studentPassword(pin) });
  if (error) return { error: "아이디나 PIN이 맞지 않아요. 기억이 안 나면 쌤에게 물어봐요." };
  redirect("/student");
}

export async function loginTeacher(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const { data, error } = await serverClient().auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (/confirm/i.test(error?.message ?? "")) return { error: "이메일 확인이 안 된 계정이에요. Supabase → Authentication → Users에서 지우고 다시 가입해 주세요." };
    return { error: "이메일이나 비밀번호가 맞지 않아요. 처음이면 아래 '쌤 계정 처음 만들기'로 먼저 가입해 주세요." };
  }
  // 로그인은 됐는데 쌤 정보(profiles)가 없으면 여기서 만들어 줘요
  const { data: p } = await db().from("profiles").select("id,role").eq("id", data.user.id).maybeSingle();
  if (!p) {
    if (!teacherEmails().includes(email)) return { error: "쌤 계정으로 등록된 이메일이 아니에요. (TEACHER_EMAILS 설정 확인)" };
    const { error: e2 } = await db().from("profiles").insert({ id: data.user.id, role: "teacher", name: "쌤" });
    if (e2) return { error: "쌤 정보를 만들지 못했어요: " + e2.message + " (schema.sql을 실행했는지 확인)" };
  } else if (p.role !== "teacher") {
    return { error: "학생 계정이에요. 학생 탭에서 로그인해 주세요." };
  }
  redirect("/teacher");
}

/** 반 코드로 학생 가입 */
export async function joinClass(_: FormState, fd: FormData): Promise<FormState> {
  const code = String(fd.get("code") || "").trim().toUpperCase();
  const name = String(fd.get("name") || "").trim();
  const grade = String(fd.get("grade") || "").trim();
  const nickname = String(fd.get("nickname") || "").trim() || null;
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const pin = String(fd.get("pin") || "").trim();
  if (!code || !name || !username || !pin) return { error: "빈칸을 모두 채워 주세요." };
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: "아이디는 영어 소문자 · 숫자 3~20자로 만들어요." };
  if (!/^\d{4}$/.test(pin)) return { error: "PIN은 숫자 4자리예요." };
  const { data: cls } = await db().from("classes").select("id").eq("code", code).maybeSingle();
  if (!cls) return { error: "반 코드를 다시 확인해 주세요." };
  const { data: taken } = await db().from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { error: "이미 있는 아이디예요. 다른 아이디로 해 주세요." };

  const { data: created, error } = await db().auth.admin.createUser({
    email: studentEmail(username),
    password: studentPassword(pin),
    email_confirm: true,
  });
  if (error || !created.user) return { error: "가입하지 못했어요: " + (error?.message ?? "") };
  await db().from("profiles").insert({ id: created.user.id, role: "student", name, grade, nickname, username, class_id: cls.id });
  await serverClient().auth.signInWithPassword({ email: studentEmail(username), password: studentPassword(pin) });
  redirect("/student");
}

/** 쌤 가입 (TEACHER_EMAILS 에 있는 이메일만) */
export async function teacherSignup(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const name = String(fd.get("name") || "").trim() || "쌤";
  if (!teacherEmails().includes(email)) return { error: "쌤 계정으로 등록된 이메일이 아니에요. (TEACHER_EMAILS 설정 확인)" };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이에요." };
  const { data: created, error } = await db().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) {
    if (/already|registered|exists/i.test(error?.message ?? "")) return { error: "이미 가입된 이메일이에요. 로그인 화면에서 들어가 주세요." };
    return { error: "가입하지 못했어요: " + (error?.message ?? "") + " (Vercel의 SUPABASE_SERVICE_ROLE_KEY 확인)" };
  }
  const { error: e2 } = await db().from("profiles").insert({ id: created.user.id, role: "teacher", name });
  if (e2) return { error: "쌤 정보를 만들지 못했어요: " + e2.message + " (schema.sql을 실행했는지 확인)" };
  await serverClient().auth.signInWithPassword({ email, password });
  redirect("/teacher");
}

export async function logout() {
  await serverClient().auth.signOut();
  redirect("/");
}
