"use client";
import { useState } from "react";
import Link from "next/link";
import ItemInput from "./ItemInput";
import Olly from "./Olly";
import type { PublicItem } from "@/lib/grading";
import type { CheckResult, QuizResult, Resp } from "@/app/actions/student";

/**
 * 문제 풀기 공통 화면
 * - instant: 한 문제씩 바로 채점 (유닛 연습 · 복습)
 * - batch: 다 풀고 한꺼번에 채점 (확인 테스트 · 주간 점검 · 과제 · 최종 점검)
 */
export default function QuizRunner({
  items,
  instant,
  check,
  finish,
  showReason,
  doneHref = "/student",
  onDone,
  extra,
}: {
  items: PublicItem[];
  instant?: boolean;
  check?: (id: string, response: string, reason?: string, attempt?: number) => Promise<CheckResult>;
  finish?: (responses: Resp[], fd?: FormData) => Promise<QuizResult>;
  showReason?: boolean;
  doneHref?: string;
  onDone?: (r: QuizResult | null) => void;
  extra?: { render: () => React.ReactNode; collect: () => FormData };
}) {
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [fb, setFb] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [atExtra, setAtExtra] = useState(false);
  const [attempt, setAttempt] = useState(1); // 문장 쓰기류 다시 풀기용 (기록은 첫 답만)

  const item = items[i];
  const val = item ? values[item.id] ?? "" : "";
  const last = i === items.length - 1;

  async function submitAll() {
    setBusy(true);
    const responses = items.map((it) => ({ id: it.id, response: values[it.id] ?? "", reason: reasons[it.id] }));
    const r = finish ? await finish(responses, extra?.collect()) : null;
    setBusy(false);
    if (onDone) onDone(r);
    else setResult(r);
  }

  async function next() {
    if (instant && check && !fb) {
      setBusy(true);
      setFb(await check(item.id, val, reasons[item.id], attempt));
      setBusy(false);
      return;
    }
    if (fb?.retry) {
      // 다시 풀기: 같은 문제를 한 번 더 (정답은 아직 안 보여 줌)
      setFb(null);
      setAttempt(2);
      return;
    }
    setFb(null);
    setAttempt(1);
    if (!last) return setI(i + 1);
    if (extra) return setAtExtra(true);
    await submitAll();
  }

  if (result)
    return (
      <div className="col">
        <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
          <Olly size={110} mood={result.passed ? "happy" : "think"} />
          {result.total > 0 && <div className="big">{result.score} / {result.total}</div>}
          <div className="title" style={{ fontSize: 22 }}>{result.message}</div>
        </div>
        {result.wrong.length > 0 && (
          <div className="card col">
            <h3>다시 볼 문제</h3>
            {result.wrong.map((w, k) => (
              <div key={k} className="bubble no col" style={{ alignItems: "flex-start", gap: 4 }}>
                <div className="en" style={{ fontWeight: 800 }}>{w.prompt}</div>
                <div className="small">내 답: <span className="en">{w.response || "(빈칸)"}</span> → 정답: <b className="en">{w.answer}</b></div>
                {w.bubble && <div className="small">올리: {w.bubble}</div>}
                {w.why && <div className="small"><b>왜?</b> {w.why}</div>}
              </div>
            ))}
          </div>
        )}
        <Link href={doneHref} className="btn">확인</Link>
      </div>
    );

  if (atExtra && extra)
    return (
      <div className="col">
        {extra.render()}
        <button className="btn" disabled={busy} onClick={submitAll}>{busy ? "보내는 중…" : "제출하기"}</button>
      </div>
    );

  if (!item) return <div className="card">문제가 아직 없어요.</div>;

  return (
    <div className="col">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="chip">문제 {i + 1} / {items.length}</span>
        {!instant && <span className="muted small">다 풀고 한꺼번에 채점해요</span>}
      </div>
      <div className="card col" style={{ gap: 18 }}>
        <ItemInput key={item.id} item={item} value={val} onChange={(v) => setValues({ ...values, [item.id]: v })} disabled={!!fb} />
        {showReason && item.activity === "find" && (
          <label className="field">
            <span>왜 틀렸을까? (우리말로 짧게)</span>
            <input className="input" value={reasons[item.id] ?? ""} disabled={!!fb} onChange={(e) => setReasons({ ...reasons, [item.id]: e.target.value })} />
          </label>
        )}
        {attempt === 2 && !fb && <div className="small muted">한 번 더! 밑줄 친 곳을 고쳐서 다시 확인해 봐.</div>}
        {fb && <Feedback fb={fb} />}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" disabled={i === 0 || !!fb || instant} onClick={() => setI(i - 1)}>이전</button>
        <button className="btn" disabled={busy || (!val.trim() && !fb)} onClick={next}>
          {busy ? "잠깐만요…" : instant && !fb ? "확인" : fb?.retry ? "다시 풀기" : last ? (extra ? "다음" : instant ? "끝내기" : "제출하기") : "다음 문제"}
        </button>
      </div>
    </div>
  );
}

/** 채점 결과 상자: 맞음 · 쌤 확인 · 틀림 (말풍선 + 왜) · 다시 풀기 (규칙 설명 + 밑줄) */
function Feedback({ fb }: { fb: CheckResult }) {
  if (fb.correct !== false)
    return (
      <div className="bubble ok">
        <Olly size={56} mood="happy" />
        <b>{fb.correct ? "완벽해!" : "쌤이 확인해 줄 거야."}</b>
      </div>
    );
  if (fb.retry)
    return (
      <div className="bubble no">
        <Olly size={56} mood="think" />
        <div className="col" style={{ gap: 6 }}>
          <b>아깝다! 다른 곳을 찾아볼까?</b>
          {fb.marks && fb.marks.length > 0 && (
            <div className="en" style={{ fontSize: 18 }}>
              {fb.marks.map((m, k) => (
                <span key={k} style={m.bad ? { textDecoration: "underline wavy #D0342C", textUnderlineOffset: 4, color: "#B3261E", fontWeight: 800 } : undefined}>
                  {m.w}{" "}
                </span>
              ))}
            </div>
          )}
          {fb.missing && <span className="small">빠진 단어도 있을 수 있어요.</span>}
          {fb.why && <span className="small"><b>이 문제에서 보는 규칙:</b> {fb.why}</span>}
        </div>
      </div>
    );
  return (
    <div className="bubble no">
      <Olly size={56} mood="think" />
      <div className="col" style={{ gap: 4 }}>
        <b>{fb.bubble || "아깝다! 정답을 확인해 봐."}</b>
        {fb.why && <span className="small"><b>왜?</b> {fb.why}</span>}
        <span className="en">정답: {fb.answers[0]}</span>
      </div>
    </div>
  );
}
