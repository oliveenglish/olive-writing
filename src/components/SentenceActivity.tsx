"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { speak, stopSpeak } from "./Speak";
import { IMic, IPlay, ISpeaker, IStop } from "./Icons";
import { saveCheck } from "@/app/actions/student";
import { chunkSentence, shuffle, shuffleNotSame } from "@/lib/chunks";
import { SENT_ACTS, sentKey, type SentAct } from "@/lib/steps";

export type S = { word: string; example: string; example_ko: string };

const sayEn = (t: string, rate?: number, onEnd?: () => void) => speak(t, "en-US", onEnd, rate);

/** 문장 연습 한 활동 (Set 하나 = 예문 10개) */
export default function SentenceActivity({ unitId, set, act, items }: { unitId: string; set: number; act: SentAct; items: S[] }) {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<null | { score: number; total: number }>(null);
  useEffect(() => { setReady(true); return () => stopSpeak(); }, []);
  const list = items.filter((x) => x.example);
  const label = SENT_ACTS.find((a) => a.key === act)?.label ?? "";
  const nextAct = SENT_ACTS[SENT_ACTS.findIndex((a) => a.key === act) + 1];
  const finish = async (score: number, total: number) => {
    await saveCheck(unitId, sentKey(set, act), score, total);
    setDone({ score, total });
    window.scrollTo(0, 0);
  };
  if (!list.length) return <div className="card muted">이 세트에 예문이 없어요.</div>;
  if (done) {
    return (
      <div className="qcard">
        <div className="title">Set {set} · {label} 끝!</div>
        {act === "chunk" && <div className="muted">한 번에 맞힌 문장 {done.score} / {done.total}</div>}
        <div className="col" style={{ width: "100%", maxWidth: 360 }}>
          {nextAct ? (
            <Link href={`/student/sentences/${set}/${nextAct.key}`} className="btn block">다음: {nextAct.label}</Link>
          ) : (
            <div className="bubble ok">Set {set} 문장 연습을 다 했어요!</div>
          )}
          <Link href="/student/sentences" className="btn ghost block">세트 목록으로</Link>
        </div>
      </div>
    );
  }
  if (!ready) return <div className="card muted">준비 중…</div>;
  return act === "shadow" ? <Shadow items={list} onDone={() => finish(list.length, list.length)} /> : <Chunks items={list} onDone={finish} />;
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

/** 오늘의 단어를 문장 안에서 진하게 */
function Highlight({ s, word }: { s: string; word: string }) {
  const w = word.replace(/\(.*?\)/g, "").replace(/~/g, "").split("/")[0].trim();
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const m = w ? s.match(new RegExp(`\\b${esc}\\w*`, "i")) : null;
  if (!m || m.index === undefined) return <>{s}</>;
  return <>{s.slice(0, m.index)}<span style={{ color: "var(--olive)" }}>{m[0]}</span>{s.slice(m.index + m[0].length)}</>;
}

/** ① 듣고 쉐도잉: 듣기 → 따라 말하기(녹음) → 내 목소리 듣기. 한 번 이상 따라 말하면 다음 */
function Shadow({ items, onDone }: { items: S[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const [heard, setHeard] = useState(false);
  const [rec, setRec] = useState<"idle" | "on" | "off">("idle");
  const [clip, setClip] = useState<string | null>(null);
  const [noMic, setNoMic] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const it = items[i];
  useEffect(() => { setHeard(false); setCount(0); setClip(null); setRec("idle"); const t = setTimeout(() => { sayEn(it.example); setHeard(true); }, 300); return () => clearTimeout(t); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const parts: Blob[] = [];
      r.ondataavailable = (e) => parts.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setClip(URL.createObjectURL(new Blob(parts, { type: r.mimeType || "audio/webm" })));
        setCount((c) => c + 1);
        setRec("off");
      };
      mr.current = r;
      r.start();
      setRec("on");
    } catch {
      setNoMic(true);
    }
  };
  const stopRec = () => mr.current?.state === "recording" && mr.current.stop();
  const next = () => {
    stopSpeak();
    if (i + 1 >= items.length) onDone();
    else setI(i + 1);
    window.scrollTo(0, 0);
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Progress n={i} total={items.length} label="① 듣고 쉐도잉 · 듣고 똑같이 따라 말해요" />
      <div className="qcard">
        <div className="en" style={{ fontSize: 28, fontWeight: 900, color: "var(--head)", lineHeight: 1.35 }}><Highlight s={it.example} word={it.word} /></div>
        <div className="muted">{it.example_ko}</div>
        <div className="small muted">오늘의 단어 <b className="en" style={{ color: "var(--olive2)" }}>{it.word}</b></div>
      </div>

      <div className="card row" style={{ flexWrap: "nowrap", background: heard ? "var(--tint)" : "#fff", border: "none" }}>
        <button type="button" className="speak" aria-label="원어민 문장 듣기" onClick={() => { sayEn(it.example); setHeard(true); }}><ISpeaker /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--head)" }}>1. 잘 듣기</div>
          <button type="button" className="go ghost" style={{ marginTop: 4 }} onClick={() => { sayEn(it.example, 0.6); setHeard(true); }}>느리게 듣기</button>
        </div>
      </div>

      <div className="card row" style={{ flexWrap: "nowrap", border: "2px solid var(--olive)" }}>
        {rec === "on" ? (
          <button type="button" className="speak" style={{ background: "var(--red)" }} aria-label="녹음 멈추기" onClick={stopRec}><IStop /></button>
        ) : (
          <button type="button" className="speak" style={{ background: "var(--warn)" }} aria-label="따라 말하기 녹음" onClick={startRec}><IMic /></button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--head)" }}>2. 따라 말하기</div>
          <div className="small muted">{rec === "on" ? "녹음 중… 다 말하면 ■ 를 눌러요" : "버튼을 누르고 소리 내어 말해요"}</div>
          {noMic && (
            <div className="col" style={{ gap: 6, marginTop: 6 }}>
              <span className="small" style={{ color: "var(--warnink)" }}>마이크를 쓸 수 없어요. 소리 내어 따라 말하고 아래를 눌러요.</span>
              <button type="button" className="go" onClick={() => setCount((c) => c + 1)}>따라 말했어요</button>
            </div>
          )}
        </div>
      </div>

      <div className="card row" style={{ flexWrap: "nowrap" }}>
        <button type="button" className="speak" style={{ background: "#fff", color: "var(--olive)", border: "2px solid var(--line2)" }} aria-label="내 목소리 듣기" disabled={!clip} onClick={() => clip && new Audio(clip).play()}><IPlay /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--head)" }}>3. 내 목소리 들어 보기</div>
          <div className="small muted">원어민과 비교해 봐요</div>
        </div>
      </div>

      <div className="row small muted" style={{ justifyContent: "center", gap: 8 }}>
        따라 말한 횟수
        <span className="dots">{[0, 1, 2].map((k) => <i key={k} className={count > k ? "on" : ""} />)}</span>
        {Math.min(count, 3)} / 3
      </div>
      <button type="button" className="btn block" disabled={count < 1 || rec === "on"} onClick={next}>
        {count < 1 ? "한 번은 따라 말해야 넘어가요" : i + 1 >= items.length ? "끝내기" : "다음 문장"}
      </button>
    </div>
  );
}

/** ② 덩어리 배열: 우리말 뜻을 보고 덩어리를 눌러 문장 만들기. 틀린 문장은 끝에 한 번 더 */
function Chunks({ items, onDone }: { items: S[]; onDone: (score: number, total: number) => void }) {
  const [queue, setQueue] = useState<S[]>(() => shuffle(items));
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(0);
  const [score, setScore] = useState(0);
  const it = queue[0];
  const parts = it ? chunkSentence(it.example) : [];
  const [order, setOrder] = useState<number[]>(() => shuffleNotSame(parts.map((_, k) => k)));
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  if (!it) return null;
  const answer = parts.join(" ");
  const built = placed.map((k) => parts[k]).join(" ");
  const check = () => {
    const ok = built === answer;
    setResult(ok);
    if (ok && !retried.has(it.example)) setScore((s) => s + 1);
    sayEn(it.example);
  };
  const next = () => {
    const rest = queue.slice(1);
    if (!result && !retried.has(it.example)) { rest.push(it); setRetried(new Set(retried).add(it.example)); }
    else setFinished((f) => f + 1);
    setResult(null);
    setPlaced([]);
    if (!rest.length) return onDone(score, items.length);
    setQueue(rest);
    setOrder(shuffleNotSame(chunkSentence(rest[0].example).map((_, k) => k)));
    window.scrollTo(0, 0);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <Progress n={finished} total={items.length} label="② 덩어리 배열 · 덩어리를 눌러 문장을 만들어요" />
      <div className="qcard" style={{ padding: "18px" }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: "var(--head)" }}>{it.example_ko}</div>
        <button type="button" className="go ghost" onClick={() => sayEn(it.example)}>🔈 힌트로 듣기</button>
      </div>
      <div className="tray" aria-label="만든 문장">
        {placed.map((k) => (
          <button key={k} type="button" className="chunk on" disabled={result !== null} onClick={() => setPlaced(placed.filter((x) => x !== k))}>{parts[k]}</button>
        ))}
        {!placed.length && <span className="small muted" style={{ padding: 10 }}>아래 덩어리를 차례로 눌러요</span>}
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 8 }}>
        {order.map((k) => {
          const used = placed.includes(k);
          return (
            <button key={k} type="button" className={`chunk ${used ? "used" : ""}`} disabled={used || result !== null} onClick={() => setPlaced([...placed, k])}>{parts[k]}</button>
          );
        })}
      </div>
      {result === null ? (
        <button type="button" className="btn block" disabled={placed.length !== parts.length} onClick={check}>확인</button>
      ) : (
        <>
          <div className={`bubble ${result ? "ok" : "no"}`}>
            {result ? <span>맞았어요! <span className="en">{it.example}</span></span> : <span>정답: <b className="en">{it.example}</b>{!retried.has(it.example) ? " · 이 문장은 끝에 한 번 더 나와요." : ""}</span>}
          </div>
          <button type="button" className="btn block" autoFocus onClick={next}>다음</button>
        </>
      )}
    </div>
  );
}
