"use client";
import { useEffect, useRef, useState } from "react";
import { speak, stopSpeak, Tap } from "./Speak";

export type Card = { ord: number; title: string; body: string; audio_url?: string | null; check_q?: string | null; check_a?: string | null; check_choices?: string | null };

/** 한글 없이 영어 문장이면 눌러서 듣는 예문 */
const isEn = (t: string) => /[A-Za-z]{2,}/.test(t) && !/[가-힣]/.test(t) && t.trim().split(/\s+/).length >= 2;

/** 설명 카드 내용: 줄 = 문단, 'a | b' 줄 = 표, **굵게** */
export function CardBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const blocks: React.ReactNode[] = [];
  let table: string[][] = [];
  const bold = (s: string) =>
    s.split(/(\*\*.*?\*\*)/).map((part, k) => (part.startsWith("**") ? <b key={k}>{part.slice(2, -2)}</b> : <span key={k}>{part}</span>));
  const flush = () => {
    if (!table.length) return;
    blocks.push(
      <table className="gtable" key={blocks.length}>
        <tbody>{table.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{isEn(c) ? <Tap text={c}>{bold(c)}</Tap> : bold(c)}</td>)}</tr>)}</tbody>
      </table>
    );
    table = [];
  };
  for (const l of lines) {
    if (l.includes(" | ") || l.startsWith(" | ")) table.push(l.split("|").map((c) => c.trim()));
    else {
      flush();
      if (l.trim()) blocks.push(<p key={blocks.length}>{isEn(l) ? <Tap text={l}>{bold(l)}</Tap> : bold(l)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

/** 설명 카드 넘겨 보기 (3쪽 문장 규칙을 앱에서 다시 보기) */
export function ExplainCards({ cards, onDone, doneLabel = "다 봤어요" }: { cards: Card[]; onDone: () => void; doneLabel?: string }) {
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const c = cards[idx];
  if (!c) return (
    <div className="col">
      <div className="card muted">설명 카드가 아직 없어요.</div>
      <button className="btn" onClick={onDone}>{doneLabel}</button>
    </div>
  );
  return (
    <div className="col">
      <div className="card gcard">
        <div className="label">설명 {idx + 1} / {cards.length} · 워크시트 3쪽 문장 규칙</div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>{c.title}</h3>
          <ListenButton card={c} />
        </div>
        <CardBody body={c.body} />
        {c.check_q && <CardCheck key={c.ord} card={c} done={!!checked[c.ord]} onDone={() => setChecked({ ...checked, [c.ord]: true })} />}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" disabled={idx === 0} onClick={() => { stopSpeak(); setIdx(idx - 1); }}>이전</button>
        {idx < cards.length - 1 ? (
          <button className="btn" disabled={!!c.check_q && !checked[c.ord]} onClick={() => { stopSpeak(); setIdx(idx + 1); window.scrollTo(0, 0); }}>다음 설명</button>
        ) : (
          <button className="btn" disabled={!!c.check_q && !checked[c.ord]} onClick={() => { stopSpeak(); onDone(); }}>{doneLabel}</button>
        )}
      </div>
    </div>
  );
}

/** 🔊 듣기 ↔ ⏹ 멈추기: 쌤 음성 파일이 있으면 그것, 없으면 AI 음성 */
function ListenButton({ card }: { card: Card }) {
  const [on, setOn] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); stopSpeak(); }, [card.ord]);
  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    stopSpeak();
    setOn(false);
  };
  const play = () => {
    stop();
    setOn(true);
    if (card.audio_url) {
      const a = new Audio(card.audio_url);
      audio.current = a;
      a.onended = () => setOn(false);
      a.play().catch(() => speak(`${card.title}. ${card.body}`, undefined, () => setOn(false)));
    } else speak(`${card.title}. ${card.body}`, undefined, () => setOn(false));
  };
  return on ? (
    <button type="button" className="btn" style={{ padding: "6px 12px" }} onClick={stop}>⏹ 멈추기</button>
  ) : (
    <button type="button" className="btn ghost" style={{ padding: "6px 12px" }} onClick={play}>🔊 듣기</button>
  );
}

/** 카드 끝 확인 한 문제 — 맞혀야 다음 설명으로 */
function CardCheck({ card, done, onDone }: { card: Card; done: boolean; onDone: () => void }) {
  const [v, setV] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const choices = (card.check_choices ?? "").split("/").map((x) => x.trim()).filter(Boolean);
  const norm = (t: string) => t.toLowerCase().replace(/[.!?,'’]/g, "").replace(/\s+/g, " ").trim();
  const answers = (card.check_a ?? "").split("|").map(norm);
  const submit = (val: string) => {
    if (answers.includes(norm(val))) { setMsg("맞았어요! 다음 설명으로 가요."); onDone(); }
    else setMsg("다시 한번 카드를 읽고 골라 봐요.");
  };
  return (
    <div className="card" style={{ marginTop: 12, background: "#F6F8EE" }}>
      <div className="label">확인 한 문제</div>
      <p style={{ fontWeight: 600 }}>{card.check_q}</p>
      {done ? <p>✓ 확인 완료</p> : choices.length ? (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {choices.map((c) => <button key={c} type="button" className="btn ghost" onClick={() => submit(c)}>{c}</button>)}
        </div>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(v)} />
          <button type="button" className="btn" onClick={() => submit(v)}>확인</button>
        </div>
      )}
      {msg && !done && <p className="muted">{msg}</p>}
    </div>
  );
}
