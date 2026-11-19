import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { joinClass } from "@/app/actions/auth";

export default function Join() {
  return (
    <>
      <header className="top"><Link href="/" className="brand"><b>올리브</b> 라이팅</Link></header>
      <main className="narrow col">
        <h1>반 코드로 시작하기</h1>
        <p className="muted">쌤이 알려 준 반 코드를 넣고, 내 아이디와 PIN을 정해요. 다음부터는 아이디와 PIN으로 들어와요.</p>
        <div className="card">
          <AuthForm action={joinClass} submit="시작하기" fields={[
            { name: "code", label: "반 코드", placeholder: "OLIVE-2412" },
            { name: "name", label: "내 이름", placeholder: "김하준" },
            { name: "grade", label: "학년", placeholder: "초4" },
            { name: "nickname", label: "별명 (선택)", placeholder: "문장 장인" },
            { name: "username", label: "아이디 (영어 소문자 · 숫자)", placeholder: "hajun" },
            { name: "pin", label: "PIN 숫자 4자리", type: "password", inputMode: "numeric", maxLength: 4 },
          ]} />
        </div>
      </main>
    </>
  );
}
