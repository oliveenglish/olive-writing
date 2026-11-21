/** 단어 학습 · Warming Up Test 공통 도구 (브라우저에서 써요) */
export type Word = { word: string; pos: string | null; meaning: string | null; colloc?: string | null; example: string | null; example_ko: string | null };

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const base = (t: string) =>
  t
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[~…]/g, " ")
    .replace(/[.!?,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** 철자로 인정하는 답: "color / colour", "get up (early)" → get up early · get up */
export function spellAnswers(word: string): string[] {
  const out = new Set<string>();
  for (const part of word.split(/\s*\/\s*/)) {
    out.add(base(part.replace(/[()]/g, "")));
    out.add(base(part.replace(/\(.*?\)/g, "")));
  }
  return Array.from(out).filter(Boolean);
}

export const spellOk = (word: string, typed: string) => spellAnswers(word).includes(base(typed));

/** 보기 4개 (정답 + 같은 유닛의 다른 단어) */
export function choicesFor(all: string[], right: string, n = 4): string[] {
  const others = shuffle(Array.from(new Set(all.filter((x) => x && x !== right))));
  return shuffle([right, ...others.slice(0, n - 1)]);
}

/** 문장에서 그 단어를 ___ 로 가리기 (예문 빈칸 문제) */
export function blankOut(sentence: string, word: string): string | null {
  const w = word.replace(/\(.*?\)/g, "").replace(/[~]/g, "").split("/")[0].trim();
  if (!w) return null;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`\\b${esc}\\w*`, "i");
  return re.test(sentence) ? sentence.replace(re, "_____") : null;
}
