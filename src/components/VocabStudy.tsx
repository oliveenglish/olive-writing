"use client";
import { useMemo, useState } from "react";
import { speak, stopSpeak } from "./Speak";
import Olly from "./Olly";
import { choicesFor, shuffle, spellAnswers, spellOk, type Word } from "@/lib/vocab";

const STAGES = ["듣고 익히기", "뜻 맞히기", "듣고 고르기", "철자 쓰기"];
const say = (t: string) => speak(t.replace(/\(.*?\)/g, "").replace(/~/g, ""), "en-US");

/**
 * 📱 앱 단어 학습 (월요일 · 워크시트 1~2쪽 쓰기 전에)
 * 듣고 익히기 → 뜻 맞히기 → 듣고 고르기 → 철자 쓰기
 * 틀린 단어는 그 단계 끝에 다시 나와요. 다 맞히면 끝.
 */
export default function VocabStudy({ words, onFinish }: { words: Word[]; onFinish: (score: number, total: number) => Promise<void> }) {
  const [stage, setStage] = useState(0);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [firstSpell, setFirstSpell] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!words.length) return <div className="card muted">이 유닛은 아직 단어가 없어요. 쌤이 단어를 넣으면 열려요.</div>;

  const hear = (w: string) => { say(w); setHeard((h) => new Set(h).add(w)); };
  const playAll = () => {
    stopSpeak();
    words.forEach((w, k) => setTimeout(() => say(w.word), k * 1400));
    setHeard(new Set(words.map((w) => w.word)));
  };

  let body: React.ReactNode;
  if (finished) {
    body = (
      <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
        <Olly size={110} mood="happy" />
        <div className="title" style={{ fontSize: 22 }}>단어 학습 끝!</div>
        <div className="muted">철자 쓰기 한 번에 맞힌 단어 {firstSpell} / {words.length}</div>
        <div className="card tint small">✏️ 이제 워크시트 1~2쪽에 단어를 세 번씩 쓰고 📷 사진을 올려요.</div>
      </div>
    );
  } else if (stage === 0) {
    body = (
      <div className="col">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="small muted">단어를 눌러서 듣고, 예문도 눌러 들어요. 들은 단어 {heard.size} / {words.length}</div>
          <button className="btn ghost sm" onClick={playAll}>🔊 전체 듣기</button>
        </div>
        <div className="wordgrid">
          {words.map((w) => (
            <div key={w.word} className={`card wordcard ${heard.has(w.word) ? "heard" : ""}`}>
              <button type="button" className="wordbtn en" onClick={() => hear(w.word)}>
                {w.word} <span aria-hidden style={{ fontSize: 16 }}>🔈</span>
              </button>
              <div className="small muted">{w.pos ? `${w.pos} · ` : ""}{w.meaning}</div>
              {w.example && (
                <button type="button" className="exbtn en" onClick={() => say(w.example!)}>
                  {w.example} <span aria-hidden>🔈</span>
                </button>
              )}
              {w.example_ko && <div className="small muted">{w.example_ko}</div>}
            </div>
          ))}
        </div>
        <button className="btn" disabled={heard.size < words.length} onClick={() => { stopSpeak(); setStage(1); window.scrollTo(0, 0); }}>
          {heard.size < words.length ? `단어를 다 들어 봐요 (${words.length - heard.size}개 남음)` : "다 들었어요 → 뜻 맞히기"}
        </button>
      </div>
    );
  } else if (stage === 1) {
    body = <ChoiceRound key="m" words={words} mode="meaning" onDone={() => { setStage(2); window.scrollTo(0, 0); }} />;
  } else if (stage === 2) {
    body = <ChoiceRound key="l" words={words} mode="listen" onDone={() => { setStage(3); window.scrollTo(0, 0); }} />;
  } else {
    body = (
      <SpellRound
        words={words}
        onDone={async (first) => {
          setFirstSpell(first);
          setBusy(true);
          await onFinish(first, words.length);
          setBusy(false);
          setFinished(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <div className="col">
      <div className="steps">
        {STAGES.map((s, k) => (
          <span key={s} className={finished || k < stage ? "done" : k === stage ? "now" : ""}>{k + 1} {s}</span>
        ))}
      </div>
      {busy && <div className="small muted">저장하는 중…</div>}
      {body}
    </div>
  );
}

/** 뜻 맞히기 (영어 → 뜻) · 듣고 고르기 (소리 → 영어). 틀리면 끝에 다시 */
function ChoiceRound({ words, mode, onDone }: { words: Word[]; mode: "meaning" | "listen"; onDone: () => void }) {
  const [queue, setQueue] = useState<Word[]>(() => shuffle(words));
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [turn, setTurn] = useState(0); // 문제마다 보기 순서를 새로 섞어요 (같은 단어가 다시 나와도)
  const w = queue[0];
  const answer = mode === "meaning" ? w?.meaning ?? "" : w?.word ?? "";
  const pool = mode === "meaning" ? words.map((x) => x.meaning ?? "") : words.map((x) => x.word);
  const choices = useMemo(() => (w ? choicesFor(pool, answer) : []), [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  const ok = picked !== null && picked === answer;
  const next = () => {
    const rest = queue.slice(1);
    if (!ok) rest.push(w); // 틀린 단어는 끝에 다시
    else setRight((r) => r + 1);
    setPicked(null);
    setTurn((t) => t + 1);
    if (!rest.length) onDone();
    else {
      setQueue(rest);
      if (mode === "listen") setTimeout(() => say(rest[0].word), 150);
    }
  };
  return (
    <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
      <div className="label">{mode === "meaning" ? "뜻 맞히기 · 알맞은 뜻을 골라요" : "듣고 고르기 · 들은 단어를 골라요"} · 맞힌 단어 {right} / {words.length}</div>
      {mode === "meaning" ? (
        <button type="button" className="wordbtn en" style={{ fontSize: 40 }} onClick={() => say(w.word)}>{w.word} <span style={{ fontSize: 20 }}>🔈</span></button>
      ) : (
        <button type="button" className="btn" style={{ minWidth: 200, fontSize: 22 }} onClick={() => say(w.word)}>🔊 다시 듣기</button>
      )}
      <div className="choicegrid">
        {choices.map((c) => {
          const cls = picked === null ? "" : c === answer ? "right" : c === picked ? "wrong" : "dim";
          return (
            <button key={c} type="button" className={`choice ${mode === "listen" ? "en" : ""} ${cls}`} disabled={picked !== null} onClick={() => { setPicked(c); if (mode === "meaning") say(w.word); }}>
              {c}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <div className={`bubble ${ok ? "ok" : "no"}`} style={{ alignSelf: "stretch" }}>
            {ok ? "맞았어요!" : <span>정답은 <b className={mode === "listen" ? "en" : ""}>{answer}</b> · 이 단어는 끝에 한 번 더 나와요.</span>}
          </div>
          <button className="btn" autoFocus onClick={next}>다음</button>
        </>
      )}
      {mode === "listen" && picked === null && <div className="small muted">🔊 버튼을 눌러 듣고 골라요.</div>}
    </div>
  );
}

/** 철자 쓰기: 뜻 + 소리를 보고 영어로 쓰기. 틀리면 정답을 보고 끝에 다시 */
function SpellRound({ words, onDone }: { words: Word[]; onDone: (firstTry: number) => void }) {
  const [queue, setQueue] = useState<Word[]>(() => shuffle(words));
  const [v, setV] = useState("");
  const [res, setRes] = useState<null | boolean>(null);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [right, setRight] = useState(0);
  const w = queue[0];
  if (!w) return null;
  const check = () => {
    if (!v.trim()) return;
    const ok = spellOk(w.word, v);
    setRes(ok);
    say(w.word);
    if (!ok) setMissed((m) => new Set(m).add(w.word));
  };
  const next = () => {
    const rest = queue.slice(1);
    if (!res) rest.push(w);
    else setRight((r) => r + 1);
    setV("");
    setRes(null);
    if (!rest.length) onDone(words.length - missed.size);
    else setQueue(rest);
  };
  return (
    <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
      <div className="label">철자 쓰기 · 뜻을 보고 영어로 써요 · 맞힌 단어 {right} / {words.length}</div>
      <div className="title" style={{ fontSize: 28 }}>{w.meaning}</div>
      {w.pos && <div className="small muted">{w.pos}</div>}
      <button type="button" className="btn ghost sm" onClick={() => say(w.word)}>🔊 소리 힌트</button>
      <input
        className="input en"
        style={{ maxWidth: 420, textAlign: "center", fontSize: 24 }}
        value={v}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={res !== null}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") (res === null ? check() : next()); }}
      />
      {res === null ? (
        <button className="btn" disabled={!v.trim()} onClick={check}>확인</button>
      ) : (
        <>
          <div className={`bubble ${res ? "ok" : "no"}`} style={{ alignSelf: "stretch" }}>
            {res ? "맞았어요!" : <span>정답: <b className="en">{spellAnswers(w.word)[0]}</b> · 끝에 한 번 더 써 봐요.</span>}
          </div>
          <button className="btn" autoFocus onClick={next}>다음</button>
        </>
      )}
    </div>
  );
}
