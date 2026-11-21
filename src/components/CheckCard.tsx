"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkProof } from "@/app/actions/teacher";

export type ProofCard = {
  id: string;
  student: string;
  unit: string;
  step: number;
  when: string;
  photo: string | null;
  status: string;
  decision: string | null;
  comment: string | null;
  /** ⑦이면 ⑤ 첨삭본을 옆에 */
  before?: { photo: string | null; markup: string | null } | null;
};

const STEP_NAME: Record<number, string> = { 2: "② 워크북 단어 학습", 5: "⑤ 쌤 숙제", 7: "⑦ 다시 쓰기" };

/** 인증 사진 카드: ② · ⑦은 ✓ 확인 / ↺ 다시 써 와요, ⑤는 빨간 펜 첨삭으로 */
export default function CheckCard({ c }: { c: ProofCard }) {
  const router = useRouter();
  const [comment, setComment] = useState(c.comment ?? "");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const returned = c.status === "returned";
  const act = (d: "ok" | "redo") =>
    start(async () => {
      await checkProof(c.id, d, comment);
      setSent(d === "ok" ? (c.step === 7 ? "✓ 확인 · 다음 유닛이 열렸어요" : "✓ 확인했어요") : "↺ 다시 써 오라고 보냈어요");
      router.refresh();
    });
  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>{c.student}</b>
        <span className="small muted">{c.when}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="chip">{c.unit}</span>
        <span className="chip gray">{STEP_NAME[c.step]}</span>
        {returned && <span className={`chip ${c.decision === "redo" ? "red" : ""}`}>{c.decision === "redo" ? "↺ 다시 써 와요" : c.decision === "corrected" ? "첨삭함" : "✓ 확인"}</span>}
      </div>
      {c.before ? (
        <div className="side2" style={{ gap: 8 }}>
          <div className="col" style={{ gap: 4 }}>
            <span className="small" style={{ color: "var(--red)", fontWeight: 800 }}>⑤ 쌤 첨삭본</span>
            {c.before.photo && (
              <a href={c.before.markup ?? c.before.photo} target="_blank" rel="noreferrer" className="photo">
                <img src={c.before.photo} alt="⑤ 원본" />
                {c.before.markup && <img className="overlay" src={c.before.markup} alt="" />}
              </a>
            )}
          </div>
          <div className="col" style={{ gap: 4 }}>
            <span className="small muted" style={{ fontWeight: 800 }}>⑦ 다시 쓴 글</span>
            {c.photo && <a href={c.photo} target="_blank" rel="noreferrer" className="photo"><img src={c.photo} alt="⑦ 다시 쓴 글" /></a>}
          </div>
        </div>
      ) : (
        c.photo && <a href={c.photo} target="_blank" rel="noreferrer" className="photo" title="눌러서 크게 보기"><img src={c.photo} alt="인증 사진" style={{ maxHeight: 420, objectFit: "contain" }} /></a>
      )}
      {c.step === 5 ? (
        <Link href={`/teacher/proofs/${c.id}`} className="btn red">{returned ? "첨삭 고치기" : "빨간 펜으로 첨삭하기"}</Link>
      ) : sent ? (
        <div className="bubble ok">{sent}</div>
      ) : (
        <>
          <input className="input" style={{ fontSize: 15, minHeight: 44 }} placeholder="한마디 (선택) · 예: 3번 줄 철자 다시" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="grid2">
            <button type="button" className="btn sm" disabled={pending} onClick={() => act("ok")}>✓ 확인{c.step === 7 ? " · 다음 유닛" : ""}</button>
            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => act("redo")}>↺ 다시 써 와요</button>
          </div>
        </>
      )}
    </div>
  );
}
