"use client";
import { Pic } from "./Speak";
import { useEffect, useState } from "react";
import type { PublicItem } from "@/lib/grading";

const HINT: Record<string, string> = {
  arrange: "카드를 순서대로 눌러 문장을 만들어요.",
  blank: "빈칸에 들어갈 말을 써요.",
  ko: "영어 문장으로 써요.",
  fix: "틀린 곳을 고쳐서 문장 전체를 다시 써요.",
  transform: "화살표(→) 뒤의 모양으로 바꿔서 문장 전체를 써요.",
  answer: "질문에 영어 문장으로 대답해요.",
  choose: "알맞은 것을 골라요.",
};

function shuffle<T>(a: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 문제 하나 입력칸 (배열 카드 · 빈칸 · 한글→영어 · 고치기 · 대답) */
export default function ItemInput({
  item,
  value,
  onChange,
  disabled,
}: {
  item: PublicItem;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  // 끝에 붙은 안내 (배열) · (문장 순서)는 카드에서 빼고 따로 보여 줘요
  const note = item.kind === "arrange" ? (item.prompt.match(/\s*\(([^)]*)\)\s*$/)?.[1] ?? "") : "";
  const cards = item.kind === "arrange" ? item.prompt.replace(/\s*\([^)]*\)\s*$/, "").split(" / ").map((s) => s.trim()) : [];
  const [order] = useState(() => shuffle(cards.map((_, i) => i), item.id));
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (item.kind !== "arrange") return;
    let s = picked.map((i) => cards[i]).join(" ");
    if (s) s = s[0].toUpperCase() + s.slice(1);
    onChange(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  return (
    <div className="col">
      <div className="muted" style={{ fontWeight: 700 }}>{HINT[item.kind]}{note && ` · ${note}`}</div>
      <Pic v={item.picture} />
      {item.kind !== "arrange" && <div className="prompt en">{item.prompt}</div>}
      {item.kind === "choose" ? (
        <div className="row">
          {item.choices.map((c) => (
            <button key={c} type="button" className={"wcard" + (value === c ? " on" : "")} disabled={disabled} onClick={() => onChange(c)}>
              {c}
            </button>
          ))}
        </div>
      ) : item.kind === "arrange" ? (
        <>
          <div className="tray">
            {picked.length === 0 && <span className="muted small">여기에 문장이 만들어져요</span>}
            {picked.map((i, k) => (
              <button key={k} type="button" className="wcard on" disabled={disabled} onClick={() => setPicked(picked.filter((_, x) => x !== k))}>
                {cards[i]}
              </button>
            ))}
          </div>
          <div className="row">
            {order
              .filter((i) => !picked.includes(i))
              .map((i) => (
                <button key={i} type="button" className="wcard" disabled={disabled} onClick={() => setPicked([...picked, i])}>
                  {cards[i]}
                </button>
              ))}
          </div>
        </>
      ) : item.kind === "answer" ? (
        <textarea className="textarea en" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="I am …" />
      ) : (
        <input
          className="input en"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          autoCapitalize="sentences"
          autoComplete="off"
          spellCheck={false}
          placeholder={item.kind === "blank" ? "빈칸에 들어갈 말" : "영어 문장"}
        />
      )}
    </div>
  );
}
