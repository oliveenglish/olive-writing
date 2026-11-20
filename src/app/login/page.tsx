import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { loginAny } from "@/app/actions/auth";

/** 로그인 하나: 학생은 아이디 + PIN, 쌤은 이메일 + 비밀번호 */
export default function Login() {
  return (
    <>
      <header className="top"><Link href="/" className="brand"><b>올리브</b> 라이팅</Link></header>
      <main className="narrow col">
        <h1 className="title">로그인</h1>
        <div className="card col">
          <AuthForm action={loginAny} submit="로그인" fields={[
            { name: "id", label: "아이디 (쌤은 이메일)" },
            { name: "pw", label: "비밀번호 (PIN)", type: "password" },
          ]} />
        </div>
        <Link href="/teacher-signup" className="small muted" style={{ alignSelf: "flex-end", opacity: 0.6 }}>쌤 계정 만들기</Link>
      </main>
    </>
  );
}
