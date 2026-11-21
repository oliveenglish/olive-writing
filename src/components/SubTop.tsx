import Link from "next/link";
import { IBack, IClose } from "./Icons";

/** 학생 하위 화면 맨 위: ← 뒤로 · 작은 글 · 제목 */
export default function SubTop({ back, small, title, close = false, right }: { back: string; small: string; title: string; close?: boolean; right?: React.ReactNode }) {
  return (
    <header className="top">
      <Link href={back} className="iconbtn" aria-label={close ? "닫기" : "뒤로"}>{close ? <IClose /> : <IBack />}</Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="s">{small}</div>
        <div className="t">{title}</div>
      </div>
      {right}
    </header>
  );
}
