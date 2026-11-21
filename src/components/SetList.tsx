import Link from "next/link";

/** 단어 학습 · 문장 연습 세트 목록 (10개씩) */
export default function SetList({
  base,
  sets,
  acts,
  done,
  preview,
  label,
}: {
  base: string;
  sets: number;
  acts: readonly { key: string; label: string }[];
  done: (set: number, act: string) => boolean;
  preview: (set: number) => string;
  label: (set: number) => string;
}) {
  // 지금 할 차례: 앞에서부터 아직 안 한 첫 칸
  let next: string | null = null;
  for (let s = 1; s <= sets && !next; s++) for (const a of acts) if (!done(s, a.key)) { next = `${s}-${a.key}`; break; }
  return (
    <>
      {Array.from({ length: sets }, (_, i) => i + 1).map((s) => {
        const n = acts.filter((a) => done(s, a.key)).length;
        const now = next?.startsWith(`${s}-`);
        return (
          <section key={s} className={`setcard ${now ? "now" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 18, fontWeight: 900 }}>{label(s)}</h2>
              <span className="small" style={{ fontWeight: 800, color: n === acts.length ? "var(--olive)" : "#6b7560" }}>{n === acts.length ? "끝 ✓" : `${n} / ${acts.length}`}</span>
            </div>
            <div className="small en muted" style={{ lineHeight: 1.6 }}>{preview(s)}</div>
            <div className="acts">
              {acts.map((a) => {
                const d = done(s, a.key);
                const isNext = next === `${s}-${a.key}`;
                return (
                  <Link key={a.key} href={`${base}/${s}/${a.key}`} className={`act ${d ? "done" : isNext ? "next" : ""}`}>
                    <span className="k">{d ? "완료 · 다시 하기" : isNext ? "지금 할 차례" : "아직"}</span>
                    <span className="v">{a.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
