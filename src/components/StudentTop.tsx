import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function StudentTop({ name, extra }: { name: string; extra?: React.ReactNode }) {
  return (
    <header className="top">
      <Link href="/student" className="brand"><b>올리브</b> 라이팅</Link>
      <div className="row" style={{ fontWeight: 700, color: "var(--muted)" }}>
        {extra}
        <span>{name}</span>
        <form action={logout}><button className="btn ghost sm">나가기</button></form>
      </div>
    </header>
  );
}
