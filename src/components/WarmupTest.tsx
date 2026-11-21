"use client";
import { useEffect, useState } from "react";
import { speak } from "./Speak";
import Olly from "./Olly";
import { blankOut, choicesFor, shuffle, spellOk, type Word } from "@/lib/vocab";

type Q = { w: Word; kind: "pick" | "spell" | "blank"; sentence?: string; choices?: string[] };
const say = (t: string) => speak(t.replace(/\(.*?\)/g, "").replace(/~/g, ""), "en-US");

/**
 * 📱 Warming Up Test (수업 1 하는 날 · 수업 전에)
 * 이 유닛 단어 중 10개: 뜻 보고 고르기 · 예문 빈칸 · 철자 쓰기를 섞어요. 다 풀고 한꺼번에 채점.
 */
export default function WarmupTest({ words, last, onFinish }: { words: Word[]; last: string | null; onFinish: (score: number, total: number) => Promise<void> }) {
  const [round, setRound] = useState(0);
  // 문제 섞기는 화면이 뜬 다음에 (서버 화면과 어긋나지 않게)
  const [qs, setQs] = useState<Q[] | null>(null);
  useEffect(() => {
    const pick = shuffle(words).slice(0, Math.min(10, words.length));
    const all = words.map((w) => w.word);
    setQs(
      pick.map((w, k) => {
        const kind: Q["kind"] = k % 3 === 2 ? "spell" : k % 3 === 1 && w.example && blankOut(w.example, w.word) ? "blank" : "pick";
        if (kind === "spell") return { w, kind };
        return { w, kind, sentence: kind === "blank" ? blankOut(w.example!, w.word)! : undefined, choices: choicesFor(all, w.word) };
      })
    );
  }, [words, round]);
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; total: number; wrong: { q: Q; a: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  if (words.length < 3) return <div className="card muted">단어가 부족해서 Warming Up Test를 만들 수 없어요. 쌤이 단어를 넣으면 열려요.</div>;

  if (result) {
    return (
      <div className="col">
        <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
          <Olly size={110} mood={result.score >= result.total * 0.7 ? "happy" : "think"} />
          <div className="big">{result.score} / {result.total}</div>
          <div className="title" style={{ fontSize: 22 }}>{result.score === result.total ? "완벽해요! 수업에서 만나요." : result.score >= result.total * 0.7 ? "좋아요! 틀린 단어만 한 번 더 봐요." : "단어를 한 번 더 익히고 다시 봐도 돼요."}</div>
          <div className="small muted">점수는 쌤에게 전달돼요 · 다시 보면 새 점수로 바뀌어요</div>
        </div>
        {result.wrong.length > 0 && (
          <div className="card col">
            <h3>틀린 단어</h3>
            {result.wrong.map(({ q, a }, k) => (
              <div key={k} className="bubble no col" style={{ alignItems: "flex-start", gap: 4 }}>
                <div><b className="en">{q.w.word}</b> · {q.w.meaning}</div>
                <div className="small">내 답: <span className="en">{a || "(빈칸)"}</span></div>
              </div>
            ))}
          </div>
        )}
        <button className="btn ghost" onClick={() => { setResult(null); setAns({}); setI(0); setRound((r) => r + 1); }}>다시 보기</button>
      </div>
    );
  }

  if (!qs) return <div className="card muted">문제 준비 중…</div>;
  const q = qs[i];
  const v = ans[i] ?? "";
  const set = (x: string) => setAns({ ...ans, [i]: x });
  const finish = async () => {
    let score = 0;
    const wrong: { q: Q; a: string }[] = [];
    qs.forEach((qq, k) => {
      const a = ans[k] ?? "";
      const ok = qq.kind === "spell" ? spellOk(qq.w.word, a) : a === qq.w.word;
      if (ok) score++;
      else wrong.push({ q: qq, a });
    });
    setBusy(true);
    await onFinish(score, qs.length);
    setBusy(false);
    setResult({ score, total: qs.length, wrong });
    window.scrollTo(0, 0);
  };

  return (
    <div className="col">
      {last && i === 0 && <div className="card tint small">지난번 점수 {last} · 다시 보면 새 점수로 바뀌어요.</div>}
      <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
        <div className="label">Warming Up Test · {i + 1} / {qs.length} · {q.kind === "spell" ? "뜻을 보고 영어로 써요" : q.kind === "blank" ? "빈칸에 알맞은 단어" : "뜻에 맞는 단어"}</div>
        {q.kind === "blank" ? (
          <div className="prompt en">{q.sentence}</div>
        ) : null}
        <div className="title" style={{ fontSize: q.kind === "blank" ? 18 : 28 }}>{q.kind === "blank" ? q.w.example_ko ?? q.w.meaning : q.w.meaning}</div>
        {q.kind === "spell" ? (
          <>
            <button type="button" className="btn ghost sm" onClick={() => say(q.w.word)}>🔊 소리 힌트</button>
            <input
              className="input en"
              style={{ maxWidth: 420, textAlign: "center", fontSize: 24 }}
              value={v}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) (i < qs.length - 1 ? setI(i + 1) : finish()); }}
            />
          </>
        ) : (
          <div className="choicegrid">
            {(q.choices ?? []).map((c) => (
              <button key={c} type="button" className={`choice en ${v === c ? "picked" : ""}`} onClick={() => set(c)}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>이전</button>
        {i < qs.length - 1 ? (
          <button className="btn" disabled={!v.trim()} onClick={() => setI(i + 1)}>다음</button>
        ) : (
          <button className="btn" disabled={!v.trim() || busy} onClick={finish}>{busy ? "채점 중…" : "다 풀었어요 · 채점"}</button>
        )}
      </div>
      <div className="small muted" style={{ textAlign: "center" }}>정답은 다 풀고 나서 한꺼번에 알려 줘요.</div>
    </div>
  );
}
