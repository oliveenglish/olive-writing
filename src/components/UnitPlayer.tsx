"use client";
import { useState } from "react";
import Link from "next/link";
import QuizRunner from "./QuizRunner";
import Olly from "./Olly";
import { PhotoPicker } from "./Photo";
import HandPart from "./HandPart";
import { speak, stopSpeak, Tap } from "./Speak";
import type { PublicItem } from "@/lib/grading";
import { checkItem, saveStep, submitAnswers, submitTest, type QuizResult } from "@/app/actions/student";

const STEPS = ["단어", "설명", "단어 배열", "틀린 문장", "한글 → 영어", "대답 쓰기", "확인 테스트"];

type Card = { ord: number; title: string; body: string; audio_url?: string | null; check_q?: string | null; check_a?: string | null; check_choices?: string | null };
type Word = { grp: string | null; word: string; meaning: string | null };

/** 설명 카드 내용: 줄 = 문단, 'a | b' 줄 = 표, **굵게** */
/** 한글 없이 영어 문장이면 눌러서 듣는 예문 */
const isEn = (t: string) => /[A-Za-z]{2,}/.test(t) && !/[가-힣]/.test(t) && t.trim().split(/\s+/).length >= 2;

function CardBody({ body }: { body: string }) {
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

export default function UnitPlayer({
  unit,
  words,
  cards,
  items,
  startStep,
  passed = false,
  handSent = false,
}: {
  unit: { id: string; title: string; stage: string; pass_score: number };
  words: Word[];
  cards: Card[];
  items: Record<string, PublicItem[]>;
  startStep: number;
  passed?: boolean;
  handSent?: boolean;
}) {
  const hand = items.hand?.[0];
  const [step, setStepState] = useState(Math.min(Math.max(startStep, 0), 6));
  const [cardIdx, setCardIdx] = useState(0);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<QuizResult | null>(null);
  const [round, setRound] = useState(0);
  const [sent, setSent] = useState(startStep >= 6);

  const go = (s: number) => {
    setStepState(s);
    setRound((r) => r + 1);
    saveStep(unit.id, s);
    window.scrollTo(0, 0);
  };
  // 2단계: PREP은 고르기 + 단어 배열, 기초부터는 단어 배열
  const practice: Record<number, string[]> = { 2: ["choose", "arrange"], 3: ["find"], 4: ["ko2en"] };

  let body: React.ReactNode = null;
  if (step === 0) {
    const groups = Array.from(new Set(words.map((w) => w.grp ?? "")));
    body = (
      <div className="col">
        {groups.map((g) => (
          <div key={g} className="card col">
            {g && <div className="label">{g}</div>}
            <div className="row">
              {words.filter((w) => (w.grp ?? "") === g).map((w) => (
                <div key={w.word} className="card tint" style={{ padding: "10px 16px" }}>
                  <div className="en" style={{ fontSize: 22, fontWeight: 800 }}>{w.word}</div>
                  <div className="muted">{w.meaning}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!words.length && <div className="card muted">이 유닛은 새 단어가 없어요.</div>}
        {passed && hand && !handSent && <HandPart unitId={unit.id} item={hand} sent={false} />}
        <button className="btn" onClick={() => go(1)}>설명 보러 가기</button>
      </div>
    );
  } else if (step === 1) {
    const c = cards[cardIdx];
    body = (
      <div className="col">
        {c ? (
          <div className="card gcard">
            <div className="label">설명 {cardIdx + 1} / {cards.length}</div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>{c.title}</h3>
              <ListenButton card={c} />
            </div>
            <CardBody body={c.body} />
            {c.check_q && <CardCheck key={`${unit.id}-${c.ord}`} card={c} done={!!checked[c.ord]} onDone={() => setChecked({ ...checked, [c.ord]: true })} />}
          </div>
        ) : (
          <div className="card muted">설명 카드가 아직 없어요.</div>
        )}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn ghost" disabled={cardIdx === 0} onClick={() => { stopSpeak(); setCardIdx(cardIdx - 1); }}>이전</button>
          {cardIdx < cards.length - 1 ? (
            <button className="btn" disabled={!!c?.check_q && !checked[c.ord]} onClick={() => { stopSpeak(); setCardIdx(cardIdx + 1); }}>다음 설명</button>
          ) : (
            <button className="btn" onClick={() => { const re = !!testResult && !testResult.passed; setTestResult(null); go(re ? 6 : 2); }}>
              {testResult && !testResult.passed ? "다시 확인 테스트" : "연습 시작"}
            </button>
          )}
        </div>
      </div>
    );
  } else if (step in practice) {
    const list = practice[step].flatMap((a) => items[a] ?? []);
    body = list.length ? (
      <QuizRunner
        key={`${step}-${round}`}
        items={list}
        instant
        showReason={step === 3}
        check={(id, r, reason, attempt) => checkItem(id, r, "unit", reason, attempt)}
        onDone={() => go(step + 1)}
      />
    ) : (
      <button className="btn" onClick={() => go(step + 1)}>이 활동은 없어요 · 다음으로</button>
    );
  } else if (step === 5) {
    const list = items.answer ?? [];
    body = sent ? (
      <div className="col">
        <div className="card tint">대답은 이미 쌤에게 보냈어요.</div>
        <button className="btn" onClick={() => go(6)}>확인 테스트로</button>
      </div>
    ) : list.length ? (
      <form
        className="col"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const fd = new FormData();
          list.forEach((q) => { fd.append("id", q.id); fd.append("answer", answers[q.id] ?? ""); });
          if (photo) fd.append("photo", photo);
          await submitAnswers(unit.id, fd);
          setBusy(false);
          setSent(true);
          go(6);
        }}
      >
        <div className="card tint">질문에 영어 문장으로 대답해요. 쌤이 읽고 첨삭해 줄 거예요. 종이에 써서 사진으로 올려도 돼요.</div>
        {list.map((q, k) => (
          <div key={q.id} className="card col">
            <div className="prompt en" style={{ fontSize: 22 }}>{k + 1}. {q.prompt}</div>
            <textarea className="textarea en" style={{ minHeight: 70 }} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          </div>
        ))}
        <PhotoPicker onPick={setPhoto} />
        <button className="btn" disabled={busy}>{busy ? "보내는 중…" : "쌤에게 보내고 확인 테스트로"}</button>
      </form>
    ) : (
      <button className="btn" onClick={() => go(6)}>확인 테스트로</button>
    );
  } else if (step === 6) {
    body = testResult ? (
      <div className="col">
        <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
          <Olly size={110} mood={testResult.passed ? "happy" : "think"} />
          <div className="big">{testResult.score} / {testResult.total}</div>
          <div className="title" style={{ fontSize: 22 }}>{testResult.message}</div>
          <div className="muted small">통과 기준 {unit.pass_score}개</div>
        </div>
        {testResult.wrong.length > 0 && (
          <div className="card col">
            <h3>다시 볼 문제</h3>
            {testResult.wrong.map((w, k) => (
              <div key={k} className="bubble no col" style={{ alignItems: "flex-start", gap: 4 }}>
                <div className="en" style={{ fontWeight: 800 }}>{w.prompt}</div>
                <div className="small">내 답: <span className="en">{w.response || "(빈칸)"}</span> → 정답: <b className="en">{w.answer}</b></div>
                {w.bubble && <div className="small">올리: {w.bubble}</div>}
                {w.why && <div className="small"><b>왜?</b> {w.why}</div>}
              </div>
            ))}
          </div>
        )}
        {hand && <HandPart unitId={unit.id} item={hand} sent={handSent} />}
        {testResult.passed ? (
          <Link href="/student" className="btn">홈으로 · 다음 유닛</Link>
        ) : testResult.next === "cards" ? (
          <button className="btn" onClick={() => { setCardIdx(0); go(1); }}>설명 다시 보기</button>
        ) : (
          <button className="btn" onClick={() => { setTestResult(null); go(2); }}>연습부터 다시</button>
        )}
      </div>
    ) : (
      <QuizRunner
        key={`test-${round}`}
        items={items.test ?? []}
        finish={(r) => submitTest(unit.id, r)}
        onDone={(r) => setTestResult(r)}
      />
    );
  }

  return (
    <>
      <header className="top">
        <div className="row">
          <Link href="/student" className="btn ghost sm">←</Link>
          <div>
            <div className="label">{unit.stage} · {unit.id}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--head)" }}>{unit.title}</div>
          </div>
        </div>
        <div className="steps">
          {STEPS.map((s, k) => (
            <span key={s} className={k < step ? "done" : k === step ? "now" : ""}>{k + 1} {s}</span>
          ))}
        </div>
      </header>
      <main className="wrap" style={{ maxWidth: 860 }}>{body}</main>
    </>
  );
}


/** 🔊 듣기: 쌤 음성 파일이 있으면 그것, 없으면 AI 음성 */
function ListenButton({ card }: { card: Card }) {
  const play = () => {
    if (card.audio_url) {
      stopSpeak();
      new Audio(card.audio_url).play().catch(() => speak(`${card.title}. ${card.body}`));
    } else speak(`${card.title}. ${card.body}`);
  };
  return <button type="button" className="btn ghost" style={{ padding: "6px 12px" }} onClick={play}>🔊 듣기</button>;
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
