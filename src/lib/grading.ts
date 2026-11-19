export type Item = {
  id: string;
  unit_id: string;
  activity: string;
  activity_label: string | null;
  no: number;
  prompt: string;
  answer: string | null;
  alt_answers: string | null;
  error_code: string | null;
  grading: string | null;
  purpose: string | null;
  choices?: string | null;
  picture?: string | null;
  memo?: string | null;
};

/** 학생 화면으로 보낼 때 정답은 빼요 */
export type PublicItem = Pick<Item, "id" | "unit_id" | "activity" | "no" | "prompt"> & { kind: Kind; choices: string[]; picture: string | null };
export type Kind = "arrange" | "blank" | "ko" | "fix" | "transform" | "answer" | "choose";

const HANGUL = /[가-힣]/;

export function activityFromLabel(label: string): string {
  const l = label.replace(/\s/g, "");
  if (l.includes("손으로") || l.includes("손글씨")) return "hand"; // 확인 테스트 2부 (사진 · 쌤 첨삭)
  if (l.includes("고르기")) return "choose"; // PREP 보기 고르기
  if (l.includes("직접쓰기")) return "answer"; // PREP 직접 쓰기 (쌤 첨삭)
  if (l.includes("배열")) return "arrange";
  if (l.includes("틀린")) return "find";
  if (l.includes("한글") || l.includes("영어")) return "ko2en";
  if (l.includes("대답") || l.includes("질문")) return "answer";
  if (l.includes("테스트")) return "test";
  return l;
}

export function kindOf(item: Pick<Item, "activity" | "prompt"> & { choices?: string | null }): Kind {
  if (item.activity === "answer") return "answer";
  if (item.choices && item.choices.includes("/")) return "choose";
  if (item.activity === "arrange") return "arrange";
  if (item.prompt.includes("___")) return "blank";
  if (item.prompt.includes("→")) return "transform";
  if (HANGUL.test(item.prompt.replace(/\(.*?\)/g, ""))) return "ko";
  if (item.prompt.includes(" / ")) return "arrange";
  return "fix";
}

export function toPublic(i: Item): PublicItem {
  return { id: i.id, unit_id: i.unit_id, activity: i.activity, no: i.no, prompt: i.prompt, kind: kindOf(i), choices: splitChoices(i.choices), picture: i.picture ?? null };
}

export function splitChoices(c?: string | null): string[] {
  return (c || "").split("/").map((x) => x.trim()).filter(Boolean);
}

export function isAutoGraded(i: Pick<Item, "activity" | "grading">): boolean {
  if (i.activity === "answer") return false;
  return !(i.grading || "").includes("첨삭");
}

export function normalize(s: string): string {
  return s
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/[.?!]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function acceptedAnswers(i: Pick<Item, "answer" | "alt_answers">): string[] {
  const out: string[] = [];
  for (const src of [i.answer, i.alt_answers]) {
    if (!src) continue;
    for (const part of src.split(/\s+\/\s+|\n/)) {
      const p = part.trim();
      if (p && p !== "–" && p !== "-") out.push(p);
    }
  }
  return out;
}

export function isCorrect(i: Item, response: string): boolean {
  const r = normalize(response || "");
  if (!r) return false;
  return acceptedAnswers(i).some((a) => normalize(a) === r);
}

/** 단어 카드 순서를 문장으로 */
export function sentenceFromCards(cards: string[], answer?: string | null): string {
  let s = cards.join(" ").trim();
  if (!s) return s;
  s = s[0].toUpperCase() + s.slice(1);
  const end = answer && /[?!]\s*$/.test(answer) ? answer.trim().slice(-1) : ".";
  return s + end;
}

/** 오류 코드가 학생의 실제 실수와 거의 맞는 문제 (빈칸 · 고르기 · 틀린 문장 고치기) */
export function isSureKind(kind: Kind): boolean {
  return kind === "blank" || kind === "choose" || kind === "fix";
}

export type Mark = { w: string; bad: boolean };

const toks = (s: string) =>
  s
    .replace(/[’‘`]/g, "'")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
const bare = (w: string) => w.toLowerCase().replace(/[.,!?;:"]/g, "");

/**
 * 학생 답에서 정답과 다른 단어 표시 (정답은 보여 주지 않음)
 * 가장 비슷한 정답과 단어 단위 LCS로 맞춰 보고, 맞지 않는 학생 단어에 bad 표시
 */
export function diffMarks(response: string, answers: string[]): { marks: Mark[]; missing: boolean } {
  const r = toks(response);
  let best: { marks: Mark[]; missing: boolean; score: number } | null = null;
  for (const a of answers) {
    const t = toks(a);
    const n = r.length,
      m = t.length;
    const L: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = bare(r[i]) === bare(t[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const keep = new Set<number>();
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (bare(r[i]) === bare(t[j])) {
        keep.add(i);
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    const marks = r.map((w, k) => ({ w, bad: !keep.has(k) }));
    const score = L[0][0] * 2 - n - m;
    if (!best || score > best.score) best = { marks, missing: L[0][0] < m, score };
  }
  return best ? { marks: best.marks, missing: best.missing } : { marks: r.map((w) => ({ w, bad: false })), missing: false };
}
