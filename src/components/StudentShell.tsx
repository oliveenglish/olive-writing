import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { stepStates, unitOf } from "@/lib/progress";
import { positionOf } from "@/lib/materials";
import { logout } from "@/app/actions/auth";
import BridgeMark from "./BridgeMark";

type Key = "home" | "map" | "folder" | "history";
const MENU: { k: Key; href: string; label: string }[] = [
  { k: "home", href: "/student", label: "홈 · 오늘 할 일" },
  { k: "map", href: "/student/map", label: "내 위치 · STEP 지도" },
  { k: "folder", href: "/student/materials", label: "교재 폴더" },
  { k: "history", href: "/student/history", label: "지난 첨삭" },
];
const TAB: Record<Key, string> = { home: "홈", map: "내 위치", folder: "교재 폴더", history: "지난 첨삭" };

const I = ({ k }: { k: Key }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {k === "home" && <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
    {k === "map" && <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>}
    {k === "folder" && <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />}
    {k === "history" && <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13 7l4 4" /></>}
  </svg>
);

/** 학생 화면 틀: 컴퓨터는 왼쪽 메뉴, 휴대폰은 위 카드 + 아래 탭 (디자인 캔버스와 같은 모양) */
export default async function StudentShell({ me, on, done, freshFiles = 0, children }: { me: Profile; on: Key; done?: number; freshFiles?: number; children: React.ReactNode }) {
  const unit = unitOf(me);
  const pos = positionOf(unit);
  const d = done ?? (await stepStates(me.id, unit.id)).filter((s) => s.status === "done").length;
  return (
    <div className="sshell">
      <aside className="sside">
        <div className="sbrand">
          <BridgeMark width={34} color="#9FD9CC" post="#4CC3A8" />
          <span><small>OLIVE BRIDGE</small><b>브릿지 라이팅</b></span>
        </div>
        <Link href="/student/map" className="spos">
          <span className="k">지금 내 위치</span>
          <b>{unit.stage} · Unit {pos.unitNo}</b>
          <span className="t">{unit.title}</span>
          <span className="sbar"><span style={{ width: `${Math.round((d / 7) * 100)}%` }} /></span>
          <span className="k">이번 유닛 {d} / 7 · 전체 로드맵 {pos.stageNo} / {pos.stageTotal}단계</span>
        </Link>
        <nav className="smenu" aria-label="학생 메뉴">
          {MENU.map((m) => (
            <Link key={m.k} href={m.href} className={on === m.k ? "on" : ""}>
              {m.label}
              {m.k === "folder" && freshFiles > 0 && <span className="newdot">NEW</span>}
            </Link>
          ))}
        </nav>
        <form action={logout} className="sme">
          <span>{me.nickname || me.name}</span>
          <button className="slogout">로그아웃</button>
        </form>
      </aside>
      <div className="smain">{children}</div>
      <nav className="stabs" aria-label="앱 메뉴">
        {MENU.map((m) => (
          <Link key={m.k} href={m.href} className={on === m.k ? "on" : ""}>
            <I k={m.k} />
            {TAB[m.k]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
