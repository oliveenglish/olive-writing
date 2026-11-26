"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/teacher", "학생 진도"],
  ["/teacher/proofs", "인증 · 첨삭"],
  ["/teacher/videos", "영상 강의"],
  ["/teacher/materials", "교재 폴더"],
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
      <span className="soon" title="Zoom 수업은 나중에 챌린지 기능으로 넣어요">챌린지 · 준비 중</span>
    </>
  );
}
