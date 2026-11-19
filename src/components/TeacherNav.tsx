"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/teacher", "반 전체"],
  ["/teacher/grading", "첨삭 · 채점"],
  ["/teacher/units", "유닛 보기"],
  ["/teacher/db", "문항 DB"],
  ["/teacher/tasks", "추가 과제"],
] as const;

export default function TeacherNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <>
      {ITEMS.map(([href, label]) => {
        const on = href === "/teacher" ? path === "/teacher" || path.startsWith("/teacher/students") || path.startsWith("/teacher/report") : path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""}>
            {label}
            {href === "/teacher/grading" && pending > 0 && <span className="n">{pending}</span>}
          </Link>
        );
      })}
    </>
  );
}
