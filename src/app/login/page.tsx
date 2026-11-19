import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { loginStudent, loginTeacher } from "@/app/actions/auth";

export default function Login({ searchParams }: { searchParams: { tab?: string } }) {
  const teacher = searchParams.tab === "teacher";
  return (
    <>
      <header className="top"><Link href="/" className="brand"><b>올리브</b> 라이팅</Link></header>
      <main className="narrow col">
        <div className="tabs">
          <Link href="/login" className={teacher ? "" : "on"}>학생</Link>
          <Link href="/login?tab=teacher" className={teacher ? "on" : ""}>쌤</Link>
        </div>
        <div className="card col">
          {teacher ? (
            <AuthForm action={loginTeacher} submit="쌤 로그인" fields={[
              { name: "email", label: "이메일", type: "email", inputMode: "email" },
              { name: "password", label: "비밀번호", type: "password" },
            ]} />
          ) : (
            <AuthForm action={loginStudent} submit="들어가기" fields={[
              { name: "username", label: "아이디" },
              { name: "pin", label: "PIN 4자리", type: "password", inputMode: "numeric", maxLength: 4 },
            ]} />
          )}
        </div>
        {teacher ? (
          <Link href="/teacher-signup" className="small">쌤 계정 처음 만들기</Link>
        ) : (
          <Link href="/join" className="small">처음이에요 · 반 코드로 시작하기</Link>
        )}
      </main>
    </>
  );
}
