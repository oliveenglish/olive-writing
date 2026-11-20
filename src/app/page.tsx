import { redirect } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";
import { currentProfile } from "@/lib/auth";

/** 첫 화면 = 로그인 (이미 로그인했으면 바로 내 화면으로) */
export default async function Welcome() {
  const p = await currentProfile();
  if (p) redirect(p.role === "teacher" ? "/teacher" : "/student");
  return <LoginScreen />;
}
