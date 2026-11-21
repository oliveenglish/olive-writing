/**
 * 예문 → 덩어리 (덩어리 배열용)
 * 작은 말(a, the, my, to, in …)은 뒤 단어에 붙이고, 숫자는 뒤 단어와 묶어요.
 * 짧은 문장(4단어 이하)은 단어 하나씩, 덩어리가 너무 많으면(7개 넘게) 짧은 것끼리 합쳐요.
 */
const GLUE = new Set([
  "a", "an", "the", "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
  "to", "of", "in", "on", "at", "from", "with", "for", "by", "about", "into", "very", "too", "so", "some", "any",
  "no", "not", "don't", "doesn't", "didn't", "can't", "won't", "every", "each", "one", "two", "three", "many", "much", "a lot",
]);

export function chunkSentence(sentence: string, max = 7): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words;
  const out: string[] = [];
  let buf: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const bare = w.toLowerCase().replace(/[^a-z0-9']/g, "");
    buf.push(w);
    const isLast = i === words.length - 1;
    const glue = (GLUE.has(bare) || /^\d+$/.test(bare)) && !/[,.!?]$/.test(w);
    if (isLast || !glue) {
      out.push(buf.join(" "));
      buf = [];
    }
  }
  // 덩어리가 많으면 가장 짧은 이웃끼리 합치기
  while (out.length > max) {
    let best = 0;
    for (let i = 1; i < out.length - 1; i++) if (out[i].length + out[i + 1].length < out[best].length + out[best + 1].length) best = i;
    out.splice(best, 2, `${out[best]} ${out[best + 1]}`);
  }
  return out;
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** 섞었는데 원래 순서와 같으면 한 번 더 섞기 */
export function shuffleNotSame<T>(a: T[]): T[] {
  if (a.length < 2) return [...a];
  for (let k = 0; k < 5; k++) {
    const b = shuffle(a);
    if (b.some((x, i) => x !== a[i])) return b;
  }
  return [...a].reverse();
}
