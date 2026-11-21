import Link from "next/link";
import type { UnitHistory, HistProof } from "@/lib/history";
import { kst } from "@/lib/dates";

const STEP_NAME: Record<number, string> = { 2: "② 워크북 단어", 5: "⑤ 쌤 숙제", 7: "⑦ 다시 쓰기" };
const md = (ts: string | null) => (ts ? kst(ts).slice(5, 10).replace("-", "/") : "");

function result(p: HistProof): { text: string; cls: string } {
  if (p.status === "submitted") return { text: p.step === 5 ? "첨삭 기다리는 중" : "확인 기다리는 중", cls: "gray" };
  if (p.decision === "redo") return { text: p.markup ? "🖍️ 첨삭 · 다시 써 와요" : "↺ 다시 써 와요", cls: "warn" };
  if (p.decision === "corrected") return { text: "🖍️ 빨간 펜 첨삭", cls: "red" };
  return { text: p.step === 7 ? "✓ 통과" : "✓ 확인", cls: "" };
}

/** 유닛별 진행 + 지난 과제 (쌤 · 학생 같이 씀) */
export default function HistoryList({ list }: { list: UnitHistory[] }) {
  if (!list.length) return <div className="card muted">아직 기록이 없어요.</div>;
  return (
    <div className="col" style={{ gap: 12 }}>
      {list.map((h) => {
        const tries7 = h.proofs.filter((p) => p.step === 7).length;
        return (
          <details key={h.unit.id} className="card hist" open={h.state === "now"}>
            <summary>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}>
                  <b>{h.unit.id}</b>
                  <span className={`chip ${h.state === "done" ? "" : h.state === "now" ? "warn" : "gray"}`}>{h.state === "done" ? `✓ 끝 ${md(h.finishedAt)}` : h.state === "now" ? "지금 하는 중" : "넘어감"}</span>
                </span>
                <span className="small" style={{ display: "block", marginTop: 4 }}>{h.unit.title} · {h.unit.topic}</span>
                <span className="small muted">{h.from ? `${md(h.from)} ~ ${md(h.to)}` : "아직 시작 전"}</span>
              </span>
              <span className="small muted">펼치기</span>
            </summary>

            <div className="histstats">
              <div><span>단어 학습</span><b>Set {h.wordSets} / {h.sets}</b></div>
              <div><span>문장 연습</span><b>Set {h.sentSets} / {h.sets}</b></div>
              <div><span>정답률</span><b>{h.accuracy == null ? "—" : `${h.accuracy}%`}</b></div>
              <div><span>수업 참석</span><b>{[h.class1, h.class2].filter(Boolean).length} / 2</b></div>
              <div><span>다시 쓰기</span><b>{tries7 ? `${tries7}번` : "—"}</b></div>
            </div>

            {h.proofs.length ? (
              <div className="histgrid">
                {h.proofs.map((p) => {
                  const r = result(p);
                  return (
                    <div key={p.id} className="col" style={{ gap: 6 }}>
                      <div className="row" style={{ gap: 6, justifyContent: "space-between" }}>
                        <b className="small">{STEP_NAME[p.step]}{p.attempt > 1 ? ` · ${p.attempt}번째` : ""}</b>
                        <span className="small muted">{md(p.created_at)}</span>
                      </div>
                      {p.photo && (
                        <Link href={`/view/${p.id}`} className="photo" style={p.markup ? { border: "2px solid var(--red)" } : undefined}>
                          <img src={p.photo} alt="" />
                          {p.markup && <img className="overlay" src={p.markup} alt="" />}
                        </Link>
                      )}
                      <span className={`chip ${r.cls}`} style={{ alignSelf: "flex-start" }}>{r.text}</span>
                      {p.comment && <div className="small" style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>쌤: {p.comment}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="small muted">올린 사진이 아직 없어요.</div>
            )}
          </details>
        );
      })}
    </div>
  );
}
