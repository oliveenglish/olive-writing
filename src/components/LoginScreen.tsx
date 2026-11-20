import AuthForm from "@/components/AuthForm";
import { loginAny } from "@/app/actions/auth";

/** 접속 화면: 왼쪽 남색 소개 · 오른쪽 로그인 하나 (학생은 아이디 + PIN, 쌤은 이메일 + 비밀번호) */
export default function LoginScreen() {
  return (
    <div className="login">
      <section className="login-side">
        <div className="login-side-in">
          <div className="login-kicker">WRITING</div>
          <h1 className="login-title">Olive<br />English Academy</h1>
          <p className="login-sub">Write a little every day, get feedback from your teacher, and grow sentence by sentence.</p>
        </div>
      </section>
      <section className="login-main">
        <div className="login-box">
          <h2 className="login-h">로그인</h2>
          <div className="login-hint">아이디와 비밀번호(PIN)를 입력해요</div>
          <AuthForm action={loginAny} submit="로그인" fields={[
            { name: "id", label: "아이디" },
            { name: "pw", label: "비밀번호 (PIN)", type: "password" },
          ]} />
        </div>
      </section>
    </div>
  );
}
