import AuthForm from "@/components/AuthForm";
import { loginAny } from "@/app/actions/auth";
import BridgeMark from "@/components/BridgeMark";

/** 접속 화면: 왼쪽 남색 소개 · 오른쪽 로그인 하나 (학생은 아이디 + PIN, 쌤은 이메일 + 비밀번호) */
export default function LoginScreen() {
  return (
    <div className="login">
      <section className="login-side">
        <div className="login-side-in">
          <div style={{ marginBottom: 14 }}><BridgeMark width={150} color="#fff" post="#A9C46C" /></div>
          <div className="login-kicker">OLIVE BRIDGE WRITING</div>
          <h1 className="login-title">올리브<br />브릿지 라이팅</h1>
          <p className="login-sub">문장 드릴부터 국제학교 에세이까지.<br />매일 조금씩 쓰고, 쌤 첨삭으로 한 문장씩 자라요.</p>
          <div className="small" style={{ marginTop: 28, color: "#cfe0a6", fontWeight: 700 }}>올리브영어 아카데미</div>
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
