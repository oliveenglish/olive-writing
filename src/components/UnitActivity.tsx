"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import QuizRunner from "./QuizRunner";
import Olly from "./Olly";
import VocabStudy from "./VocabStudy";
import WarmupTest from "./WarmupTest";
import { ExplainCards, type Card } from "./Explain";
import { stopSpeak } from "./Speak";
import type { PublicItem } from "@/lib/grading";
import type { Word } from "@/lib/vocab";
import { checkItem, saveCheck, submitTest, type QuizResult } from "@/app/actions/student";

export type Mode = "vocab" | "warmup" | "practice" | "explain" | "test";
const TITLE: Record<Mode, string> = {
  vocab: "📱 앱 단어 학습",
  warmup: "📱 Warming Up Test",
  practice: "📱 앱 문장 연습",
  explain: "📱 문장 규칙 설명 다시 보기 (워크시트 3쪽)",
  test: "📱 확인 테스트",
};

export default function UnitActivity({
  mode,
  unit,
  words,
  cards,
  items,
  last,
}: {
  mode: Mode;
  unit: { id: string; title: string; stage: string; pass_score: number };
  words: Word[];
  cards: Card[];
  items: Record<string, PublicItem[]>;
  last: string | null;
}) {
  const router = useRouter();
  const hub = `/student/unit/${encodeURIComponent(unit.id)}`;
  const back = () => { stopSpeak(); router.push(hub); router.refresh(); };

  let body: React.ReactNode;
  if (mode === "vocab") body = <VocabStudy words={words} onFinish={(sc, t) => saveCheck(unit.id, "vocab", sc, t)} />;
  else if (mode === "warmup") body = <WarmupTest words={words} last={last} onFinish={(sc, t) => saveCheck(unit.id, "warmup", sc, t)} />;
  else if (mode === "explain") body = <ExplainCards cards={cards} onDone={back} doneLabel="다 봤어요 · 이번 주 할 일로" />;
  else if (mode === "practice") body = <Practice unitId={unit.id} cards={cards} items={items} />;
  else body = <UnitTest unit={unit} items={items.test ?? []} />;

  return (
    <>
      <header className="top">
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button type="button" className="btn ghost sm" onClick={back}>←</button>
          <div>
            <div className="label">{unit.stage} · {unit.id} {unit.title}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--head)" }}>{TITLE[mode]}</div>
          </div>
        </div>
        <Link href={hub} className="btn ghost sm" onClick={() => stopSpeak()}>이번 주 할 일</Link>
      </header>
      <main className="wrap" style={{ maxWidth: 900 }}>{body}</main>
    </>
  );
}

/**
 * 📱 앱 문장 연습 (수업 1 다음 날 · 워크시트 6~7쪽 전에)
 * 설명 다시 보기 → 단어 배열 → 틀린 표현 고치기 → 한글 → 영어 (틀려도 괜찮아요, 다 풀면 체크)
 */
const PRACTICE = [
  { name: "설명 다시 보기", acts: [] as string[] },
  { name: "단어 배열", acts: ["choose", "arrange"] },
  { name: "틀린 표현 고치기", acts: ["find"] },
  { name: "한글 → 영어", acts: ["ko2en"] },
];
function Practice({ unitId, cards, items }: { unitId: string; cards: Card[]; items: Record<string, PublicItem[]> }) {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const go = async (s: number) => {
    window.scrollTo(0, 0);
    setRound((r) => r + 1);
    if (s >= PRACTICE.length) {
      await saveCheck(unitId, "practice");
      setDone(true);
      return;
    }
    setStep(s);
  };
  let body: React.ReactNode;
  if (done) {
    body = (
      <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
        <Olly size={110} />
        <div className="title" style={{ fontSize: 22 }}>문장 연습 끝!</div>
        <div className="card tint small">✏️ 이제 워크시트 6~7쪽(문장 쓰기 · 영작 연습)을 풀고 📷 사진을 올려요.</div>
        <Link href={`/student/unit/${encodeURIComponent(unitId)}`} className="btn">이번 주 할 일로</Link>
      </div>
    );
  } else if (step === 0) {
    body = (
      <div className="col">
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost sm" onClick={() => go(1)}>설명은 봤어요 · 연습부터</button>
        </div>
        <ExplainCards cards={cards} onDone={() => go(1)} doneLabel="연습 시작" />
      </div>
    );
  } else {
    const list = PRACTICE[step].acts.flatMap((a) => items[a] ?? []);
    body = list.length ? (
      <div className="col">
        <div className="small muted">연습이에요 · 틀려도 괜찮아요. 다 풀면 다음 연습으로 가요. (점수는 마지막 확인 테스트로만 봐요)</div>
        <QuizRunner key={`${step}-${round}`} items={list} instant check={(id, r, reason, attempt) => checkItem(id, r, "unit", reason, attempt)} onDone={() => go(step + 1)} />
      </div>
    ) : (
      <button className="btn" onClick={() => go(step + 1)}>이 연습은 없어요 · 다음으로</button>
    );
  }
  return (
    <div className="col">
      {!done && (
        <div className="steps">
          {PRACTICE.map((p, k) => <span key={p.name} className={k < step ? "done" : k === step ? "now" : ""}>{k + 1} {p.name}</span>)}
        </div>
      )}
      {body}
    </div>
  );
}

/** 📱 확인 테스트: 통과 기준 이상이면 다음 유닛. 못 넘으면 비슷한 문제 몇 개 → 확인 테스트만 다시 */
function UnitTest({ unit, items }: { unit: { id: string; pass_score: number }; items: PublicItem[] }) {
  const [result, setResult] = useState<QuizResult | null>(null);
  const [redo, setRedo] = useState<PublicItem[]>([]);
  const [round, setRound] = useState(0);
  if (!items.length) return <div className="card muted">확인 테스트 문제가 아직 없어요.</div>;
  if (redo.length && !result) {
    return (
      <div className="col">
        <div className="card tint col" style={{ gap: 4 }}>
          <b>확인 테스트 · 다시 도전 준비 ({redo.length}문제)</b>
          <span className="small">방금 틀린 것과 비슷한 문제만 골랐어요. 이것만 풀면 바로 확인 테스트를 다시 봐요.</span>
        </div>
        <QuizRunner key={`redo-${round}`} items={redo} instant check={(id, r, reason, attempt) => checkItem(id, r, "retry", reason, attempt)} onDone={() => { setRedo([]); setRound((x) => x + 1); window.scrollTo(0, 0); }} />
      </div>
    );
  }
  if (result) {
    return (
      <div className="col">
        <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
          <Olly size={110} mood={result.passed ? "happy" : "think"} />
          <div className="big">{result.score} / {result.total}</div>
          <div className="title" style={{ fontSize: 22 }}>{result.message}</div>
          <div className="muted small">통과 기준 {unit.pass_score}개</div>
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
        {result.passed ? (
          <Link href="/student" className="btn">홈으로 · 다음 유닛</Link>
        ) : result.next === "redo" && result.redo?.length ? (
          <button className="btn" onClick={() => { setRedo(result.redo ?? []); setResult(null); window.scrollTo(0, 0); }}>확인 테스트 이어서 하기</button>
        ) : (
          <button className="btn" onClick={() => { setResult(null); setRound((x) => x + 1); window.scrollTo(0, 0); }}>확인 테스트 다시 보기</button>
        )}
      </div>
    );
  }
  return <QuizRunner key={`test-${round}`} items={items} finish={(r) => submitTest(unit.id, r)} onDone={(r) => setResult(r)} />;
}
