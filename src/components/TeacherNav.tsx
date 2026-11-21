"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/teacher", "이번 주 진행"],
  ["/teacher/proofs", "인증 · 첨삭"],
  ["/teacher/words", "단어 · 예문 엑셀"],
] as const;

export default function TeacherNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <>
      {ITEMS.map(([href, label]) => {
        const on = href === "/teacher" ? path === "/teacher" || path.startsWith("/teacher/students") : path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""}>
            {label}
            {href === "/teacher/proofs" && pending > 0 && <span className="n">{pending}</span>}
          </Link>
        );
      })}
    </>
  );
}
