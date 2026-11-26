import Link from "next/link";

/** 학생 메뉴: 홈 · 내 위치 · 교재 폴더 · 지난 첨삭 */
export default function StudentNav({ on, fresh = 0 }: { on: "home" | "map" | "folder" | "history"; fresh?: number }) {
  const items = [
    { k: "home", href: "/student", label: "홈 · 과제" },
    { k: "map", href: "/student/map", label: "내 위치" },
    { k: "folder", href: "/student/materials", label: "교재 폴더" },
    { k: "history", href: "/student/history", label: "지난 첨삭" },
  ] as const;
  return (
    <nav className="snav" aria-label="학생 메뉴">
      {items.map((i) => (
        <Link key={i.k} href={i.href} className={on === i.k ? "on" : ""}>
          {i.label}
          {i.k === "folder" && fresh > 0 && <span className="newdot">NEW</span>}
        </Link>
      ))}
    </nav>
  );
}
