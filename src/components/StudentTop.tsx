import Link from "next/link";
import { logout } from "@/app/actions/auth";

/** 학생 화면 맨 위: 학년 · 이름 · 별명 */
export default function StudentTop({ name, grade, nickname, extra }: { name: string; grade?: string | null; nickname?: string | null; extra?: React.ReactNode }) {
  return (
    <header className="top">
      <Link href="/student" className="brand"><b>올리브</b> 라이팅</Link>
      <div className="row" style={{ fontWeight: 700, color: "var(--muted)", alignItems: "center" }}>
        {extra}
        <span className="row" style={{ gap: 6, alignItems: "center" }}>
          {grade && <span className="chip gray">{grade}</span>}
          <b style={{ color: "var(--head)" }}>{name}</b>
          {nickname && <span className="chip" style={{ background: "var(--goldbg)", color: "var(--head)", borderColor: "var(--gold)" }}>{nickname}</span>}
        </span>
        <form action={logout}><button className="btn ghost sm">나가기</button></form>
      </div>
    </header>
  );
}
