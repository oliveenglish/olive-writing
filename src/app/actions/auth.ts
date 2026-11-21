"use server";
import { redirect } from "next/navigation";
import { db, serverClient } from "@/lib/supabase";
import { studentEmail, studentPassword, teacherEmails } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

/** 로그인 하나로: @가 있으면 쌤(이메일 · 비밀번호), 없으면 학생(아이디 · PIN) */
export async function loginAny(s: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") || "").trim();
  const pw = String(fd.get("pw") || "");
  if (!id || !pw) return { error: "아이디와 비밀번호(PIN)를 입력해 주세요." };
  const f = new FormData();
  if (id.includes("@")) {
    f.set("email", id);
    f.set("password", pw);
    return loginTeacher(s, f);
  }
  f.set("username", id);
  f.set("pin", pw);
  return loginStudent(s, f);
}

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
