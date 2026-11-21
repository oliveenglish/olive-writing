"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { speak, stopSpeak } from "./Speak";
import { ISpeaker } from "./Icons";
import { saveCheck } from "@/app/actions/student";
import { shuffle } from "@/lib/chunks";
import { WORD_ACTS, wordKey, type WordAct } from "@/lib/steps";

export type W = { word: string; pos: string; meaning: string; colloc: string; example: string; example_ko: string };

const say = (t: string, rate?: number) => speak(t.replace(/\(.*?\)/g, "").replace(/~/g, ""), "en-US", undefined, rate);

/** 예문에서 그 단어를 빈칸으로 */
function blankOut(sentence: string, word: string): string | null {
  const w = word.replace(/\(.*?\)/g, "").replace(/~/g, "").split("/")[0].trim();
  if (!w || !sentence) return null;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`\\b${esc}\\w*`, "i");
  return re.test(sentence) ? sentence.replace(re, "_____") : null;
}
/** 보기 4개: 정답 + 같은 유닛의 다른 것 */
function choices(pool: string[], right: string, n = 4) {
  return shuffle([right, ...shuffle(Array.from(new Set(pool.filter((x) => x && x !== right)))).slice(0, n - 1)]);
}

/**
 * 단어 학습 한 활동 (Set 하나 = 10개)
 * 틀린 단어는 그 활동 끝에 한 번만 다시 나와요.
 */
export default function WordActivity({ unitId, set, act, words, pool }: { unitId: string; set: number; act: WordAct; words: W[]; pool: W[] }) {
  // 섞기는 화면이 뜬 다음에 (서버 화면과 어긋나지 않게)
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<null | { score: number; total: number }>(null);
  useEffect(() => { setReady(true); return () => stopSpeak(); }, []);
  const label = WORD_ACTS.find((a) => a.key === act)?.label ?? "";
  const idx = WORD_ACTS.findIndex((a) => a.key === act);
  const nextAct = WORD_ACTS[idx + 1];

  const finish = async (score: number, total: number) => {
    await saveCheck(unitId, wordKey(set, act), score, total);
    setDone({ score, total });
    window.scrollTo(0, 0);
  };

  if (!words.length) return <div className="card muted">이 세트에 단어가 없어요.</div>;
  if (done) {
    return (
      <div className="qcard">
        <div className="title">Set {set} · {label} 끝!</div>
        {act !== "flash" && <div className="muted">한 번에 맞힌 것 {done.score} / {done.total}</div>}
        <div className="col" style={{ width: "100%", maxWidth: 360 }}>
          {nextAct ? (
            <Link href={`/student/words/${set}/${nextAct.key}`} className="btn block">다음: {nextAct.label}</Link>
          ) : (
            <div className="bubble ok">Set {set} 네 가지를 다 했어요!</div>
          )}
          <Link href="/student/words" className="btn ghost block">세트 목록으로</Link>
        </div>
      </div>
    );
  }
  if (!ready) return <div className="card muted">준비 중…</div>;
  if (act === "flash") return <Flash words={words} onDone={() => finish(words.length, words.length)} />;
  if (act === "match") return <Match words={words} onDone={finish} />;
  return <Pick mode={act} words={words} pool={pool} onDone={finish} />;
}

function Progress({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{label}</span>
        <b className="small" style={{ color: "var(--olive)" }}>{n} / {total}</b>
      </div>
      <div className="pbar"><span style={{ width: `${Math.round((n / total) * 100)}%` }} /></div>
    </div>
  );
}

/** ① 플래시 카드: 앞면 단어 → 눌러서 뒷면(뜻 · 같이 쓰는 말 · 예문). '한 번 더'는 끝에 한 번 다시 */
function Flash({ words, onDone }: { words: W[]; onDone: () => void }) {
  const [queue, setQueue] = useState<W[]>(words);
  const [again, setAgain] = useState<Set<string>>(new Set());
  const [back, setBack] = useState(false);
  const [known, setKnown] = useState(0);
  const w = queue[0];
  useEffect(() => { if (w) say(w.word); }, [w]);
  if (!w) return null;
  const next = (ok: boolean) => {
    const rest = queue.slice(1);
    if (!ok && !again.has(w.word)) { rest.push(w); setAgain(new Set(again).add(w.word)); }
    if (ok || again.has(w.word)) setKnown((k) => k + 1);
    setBack(false);
    if (!rest.length) onDone();
    else setQueue(rest);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <Progress n={known} total={words.length} label="① 플래시 카드 · 카드를 누르면 뒤집혀요" />
      <button type="button" className="qcard" style={{ border: "none", cursor: "pointer", minHeight: 380, boxShadow: "0 6px 24px rgba(30,42,14,0.10)", font: "inherit", color: "inherit" }} onClick={() => setBack(!back)}>
        {w.pos && <span className="chip">{w.pos}</span>}
        <div className="en" style={{ fontSize: 48, fontWeight: 900, color: "var(--head)", lineHeight: 1.1 }}>{w.word}</div>
        <span className="speak" role="presentation" onClick={(e) => { e.stopPropagation(); say(w.word); }}><ISpeaker /></span>
        {back ? (
          <>
            <div style={{ width: "100%", borderTop: "2px dashed var(--line)", margin: "6px 0" }} />
            <div style={{ fontSize: 25, fontWeight: 900, color: "var(--head)" }}>{w.meaning}</div>
            {w.colloc && (
              <div className="col" style={{ gap: 2, alignItems: "center" }}>
                <span className="label">같이 쓰는 말</span>
                <span className="en" style={{ fontSize: 17, fontWeight: 800, color: "var(--olive)" }}>{w.colloc}</span>
              </div>
            )}
            {w.example && (
              <span role="presentation" onClick={(e) => { e.stopPropagation(); say(w.example); }} style={{ background: "var(--bg)", borderRadius: 14, padding: "12px 14px", width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="en" style={{ fontSize: 18, fontWeight: 800, color: "var(--head)" }}>{w.example} 🔈</span>
                <span className="small muted">{w.example_ko}</span>
              </span>
            )}
          </>
        ) : (
          <div className="small muted" style={{ marginTop: 20 }}>뜻이 생각나면 카드를 눌러 확인해요</div>
        )}
      </button>
      <div className="grid2">
        <button type="button" className="btn ghost" onClick={() => next(false)}>한 번 더 볼래요</button>
        <button type="button" className="btn" onClick={() => next(true)}>알아요</button>
      </div>
    </div>
  );
}

/** ② 매칭 게임: 한 판에 5쌍 (10개 = 2판) */
function Match({ words, onDone }: { words: W[]; onDone: (score: number, total: number) => void }) {
  const rounds = useMemo(() => {
    const r: W[][] = [];
    for (let i = 0; i < words.length; i += 5) r.push(words.slice(i, i + 5));
    return r;
  }, [words]);
  const [round, setRound] = useState(0);
  const [left, setLeft] = useState(() => shuffle(rounds[0]));
  const [right, setRight] = useState(() => shuffle(rounds[0]));
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pickL, setPickL] = useState<string | null>(null);
  const [pickR, setPickR] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [miss, setMiss] = useState(0);

  const tryPair = (l: string | null, r: string | null) => {
    if (!l || !r) return;
    if (l === r) {
      const g = new Set(gone).add(l);
      say(l);
      setGone(g);
      setPickL(null);
      setPickR(null);
      setWrong(null);
      if (g.size === rounds[round].length) {
        if (round + 1 < rounds.length) {
          setTimeout(() => {
            const nr = round + 1;
            setRound(nr);
            setLeft(shuffle(rounds[nr]));
            setRight(shuffle(rounds[nr]));
            setGone(new Set());
          }, 600);
        } else setTimeout(() => onDone(Math.max(0, words.length - miss), words.length), 500);
      }
    } else {
      setMiss((m) => m + 1);
      setWrong(r);
      setTimeout(() => { setPickL(null); setPickR(null); setWrong(null); }, 700);
    }
  };
  const matched = rounds.slice(0, round).reduce((a, r) => a + r.length, 0) + gone.size;
  return (
    <div className="col" style={{ gap: 14 }}>
      <Progress n={matched} total={words.length} label={`② 매칭 게임 · ${round + 1}판 / ${rounds.length}판`} />
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--head)", textAlign: "center" }}>영어 단어와 뜻을 짝지어요</div>
      <div className="grid2">
        <div className="col" style={{ gap: 10 }}>
          {left.map((w) => {
            const g = gone.has(w.word);
            return (
              <button key={w.word} type="button" disabled={g} className={`choice en ${g ? "gone" : pickL === w.word ? "sel" : ""}`} onClick={() => { setPickL(w.word); say(w.word); tryPair(w.word, pickR); }}>
                {w.word}{g ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <div className="col" style={{ gap: 10 }}>
          {right.map((w) => {
            const g = gone.has(w.word);
            return (
              <button key={w.word} type="button" disabled={g} className={`choice ${g ? "gone" : wrong === w.word ? "wrong" : pickR === w.word ? "sel" : ""}`} style={{ fontSize: 15 }} onClick={() => { setPickR(w.word); tryPair(pickL, w.word); }}>
                {w.meaning}{g ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </div>
      {wrong && <div className="bubble no" style={{ textAlign: "center" }}>앗, 짝이 아니에요. 다시 골라 봐요!</div>}
      <div className="row small muted" style={{ justifyContent: "space-between" }}><span>짝 맞춘 것 {gone.size} / {rounds[round].length}</span><span>틀린 횟수 {miss}</span></div>
    </div>
  );
}

/** ③ 단어 고르기 (뜻 · 예문 빈칸 → 영어) · ④ 뜻 고르기 (영어 · 소리 → 뜻) */
function Pick({ mode, words, pool, onDone }: { mode: "word" | "meaning"; words: W[]; pool: W[]; onDone: (score: number, total: number) => void }) {
  const [queue, setQueue] = useState<W[]>(() => shuffle(words));
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [turn, setTurn] = useState(0);
  const [finished, setFinished] = useState(0);
  const w = queue[0];
  const answer = mode === "word" ? w?.word ?? "" : w?.meaning ?? "";
  const opts = useMemo(
    () => (w ? choices(mode === "word" ? pool.map((x) => x.word) : pool.map((x) => x.meaning), answer) : []),
    [turn] // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => { if (w && mode === "meaning") say(w.word); }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  const ok = picked !== null && picked === answer;
  const blank = mode === "word" ? blankOut(w.example, w.word) : null;
  const next = () => {
    const rest = queue.slice(1);
    if (!ok && !retried.has(w.word)) { rest.push(w); setRetried(new Set(retried).add(w.word)); }
    else setFinished((f) => f + 1);
    setPicked(null);
    setTurn((t) => t + 1);
    if (!rest.length) onDone(score, words.length);
    else setQueue(rest);
  };
  const pick = (c: string) => {
    if (picked !== null) return;
    setPicked(c);
    if (c === answer && !retried.has(w.word)) setScore((s) => s + 1);
    say(mode === "word" && blank ? w.example : w.word);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <Progress n={finished} total={words.length} label={mode === "word" ? "③ 단어 고르기 · 뜻에 맞는 영어 단어" : "④ 뜻 고르기 · 단어를 듣고 알맞은 뜻"} />
      <div className="qcard">
        {mode === "word" ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--head)" }}>{w.meaning}</div>
            {blank && (
              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="en" style={{ fontSize: 19, fontWeight: 800, color: "var(--head)" }}>{blank}</span>
                <span className="small muted">{w.example_ko}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="en" style={{ fontSize: 46, fontWeight: 900, color: "var(--head)" }}>{w.word}</div>
            <button type="button" className="speak" aria-label="단어 듣기" onClick={() => say(w.word)}><ISpeaker /></button>
          </>
        )}
      </div>
      <div className={mode === "word" ? "grid2" : "col"} style={mode === "meaning" ? { gap: 10 } : undefined}>
        {opts.map((c) => {
          const cls = picked === null ? "" : c === answer ? "right" : c === picked ? "wrong" : "";
          return (
            <button key={c} type="button" className={`choice ${mode === "word" ? "en" : ""} ${cls}`} style={mode === "meaning" ? { textAlign: "left", padding: "0 18px" } : undefined} disabled={picked !== null} onClick={() => pick(c)}>
              {c}{picked !== null && c === answer ? " ✓" : ""}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <div className={`bubble ${ok ? "ok" : "no"}`}>
            {ok ? (
              <span>맞았어요! <span className="en">{w.example}</span></span>
            ) : (
              <span><b className="en">{w.word}</b> = {w.meaning}{!retried.has(w.word) ? " · 이 단어는 끝에 한 번 더 나와요." : ""}</span>
            )}
          </div>
          <button type="button" className="btn block" autoFocus onClick={next}>다음</button>
        </>
      )}
    </div>
  );
}
