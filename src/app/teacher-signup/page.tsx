import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { teacherSignup } from "@/app/actions/auth";

export default function TeacherSignup() {
  return (
    <>
      <header className="top"><Link href="/" className="brand"><b>올리브</b> 라이팅</Link></header>
      <main className="narrow col">
        <h1>쌤 계정 만들기</h1>
        <p className="muted small">설정(TEACHER_EMAILS)에 등록한 이메일로만 만들 수 있어요.</p>
        <div className="card">
          <AuthForm action={teacherSignup} submit="쌤 계정 만들기" fields={[
            { name: "name", label: "이름", placeholder: "JY쌤" },
            { name: "email", label: "이메일", type: "email", inputMode: "email" },
            { name: "password", label: "비밀번호 (8자 이상)", type: "password" },
          ]} />
        </div>
      </main>
    </>
  );
}
