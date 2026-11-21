"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkPhoto } from "@/app/actions/teacher";

export type CheckCardData = {
  id: string;
  student: string;
  unit: string;
  page: string;
  label: string;
  when: string;
  photo: string | null;
  again: boolean;
  /** 10쪽이면 9쪽 첨삭본을 옆에 */
  before?: { photo: string | null; markup: string | null } | null;
  decision?: string | null;
  comment?: string | null;
};

/** 워크시트 사진 확인만: ✓ 확인 / ↺ 다시 써 와요 (+ 짧은 한마디) */
export default function PhotoCheck({ c, done = false }: { c: CheckCardData; done?: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState(c.comment ?? "");
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone && !done) return null;
  const act = (d: "ok" | "redo") =>
    start(async () => {
      await checkPhoto(c.id, d, comment);
      setGone(true);
      router.refresh();
    });
  return (
    <div className="card checkcard">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <b>{c.student}</b>
        <span className="small muted">{c.when}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="chip">{c.unit}</span>
        <span className="chip gray">✏️ {c.label}</span>
        {c.again && <span className="chip" style={{ background: "#FFF1E6", color: "#C2561A" }}>↺ 다시 쓴 것</span>}
        {done && c.decision && <span className={`chip ${c.decision === "redo" ? "red" : ""}`}>{c.decision === "redo" ? "↺ 다시 써 와요" : "✓ 확인"}</span>}
      </div>
      {c.before && (
        <div className="grid2" style={{ gap: 8 }}>
          <div className="col" style={{ gap: 4 }}>
            <span className="small muted">9쪽 · 쌤 첨삭본</span>
            {c.before.photo && (
              <a href={c.before.photo} target="_blank" rel="noreferrer" className="photo">
                <img src={c.before.photo} alt="9쪽" />
                {c.before.markup && <img className="overlay" src={c.before.markup} alt="" />}
              </a>
            )}
          </div>
          <div className="col" style={{ gap: 4 }}>
            <span className="small muted">10쪽 · 다시 쓴 글</span>
            {c.photo && <a href={c.photo} target="_blank" rel="noreferrer" className="photo"><img src={c.photo} alt="10쪽" /></a>}
          </div>
        </div>
      )}
      {!c.before && c.photo && (
        <a href={c.photo} target="_blank" rel="noreferrer" className="photo" title="눌러서 크게 보기">
          <img src={c.photo} alt={c.label} />
        </a>
      )}
      <input className="input" style={{ fontSize: 15, minHeight: 44 }} placeholder="한마디 (선택) · 예: 3번 줄 철자 다시" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm" disabled={pending} onClick={() => act("ok")}>✓ 확인</button>
        <button className="btn ghost sm" disabled={pending} onClick={() => act("redo")}>↺ 다시 써 와요</button>
      </div>
    </div>
  );
}
