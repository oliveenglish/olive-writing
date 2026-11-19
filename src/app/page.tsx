import Link from "next/link";
import { redirect } from "next/navigation";
import Olly from "@/components/Olly";
import { currentProfile } from "@/lib/auth";

export default async function Welcome() {
  const p = await currentProfile();
  if (p) redirect(p.role === "teacher" ? "/teacher" : "/student");
  return (
    <>
      <header className="top">
        <span className="brand"><b>올리브</b> 라이팅</span>
        <Link href="/login?tab=teacher" className="small" style={{ fontWeight: 700 }}>쌤 로그인</Link>
      </header>
      <main className="narrow col" style={{ alignItems: "center", textAlign: "center", gap: 22 }}>
        <Olly size={150} />
        <div className="muted" style={{ fontWeight: 700 }}>초등부터 B1 에세이까지, 한 계단씩</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.35 }}>반가워! 나는 올리야.<br />오늘도 한 문장씩 써 볼까?</h1>
        <div className="col" style={{ width: "100%" }}>
          <Link href="/login" className="btn">로그인</Link>
          <Link href="/join" className="btn ghost">처음이에요 · 반 코드로 시작하기</Link>
        </div>
      </main>
    </>
  );
}
