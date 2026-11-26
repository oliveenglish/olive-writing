/**
 * 한 유닛 7단계 (순서는 모든 학생 같아요 · 요일 없이 과제 목록으로 보여요)
 *   ① 앱 단어 학습 → ② 단어 쓰기 인증 → ③ 영상 강의 → ④ 앱 문장 연습
 *   → ⑤ 숙제 · 내 글 쓰기 인증 → ⑥ 쌤 첨삭 확인 → ⑦ 다시 쓰기 인증
 * Zoom 수업은 학생 화면에서 뺐어요 (나중에 챌린지 기능으로 따로 넣어요).
 */
export type StepType = "app" | "proof" | "video" | "check";
export type Step = { n: 1 | 2 | 3 | 4 | 5 | 6 | 7; type: StepType; title: string; sub: string; rule: string; where: string };

export const STEPS: Step[] = [
  { n: 1, type: "app", where: "앱", title: "앱 단어 학습", sub: "10개씩 · 플래시 카드 · 매칭 · 단어 고르기 · 뜻 고르기", rule: "세트마다 4가지 활동을 모두 끝내요" },
  { n: 2, type: "proof", where: "워크북", title: "워크북 단어 쓰기 인증", sub: "워크북에 단어를 세 번씩 쓰고 사진 올리기", rule: "세 번씩 쓰고 사진으로 인증해요" },
  { n: 3, type: "video", where: "영상", title: "영상 강의", sub: "이번 유닛 문장 규칙 설명 영상 보기", rule: "문장 규칙 영상을 끝까지 봐요" },
  { n: 4, type: "app", where: "앱", title: "앱 문장 연습", sub: "10문장씩 · 듣고 쉐도잉 · 덩어리 배열", rule: "듣고 따라 말한 뒤 덩어리를 배열해요" },
  { n: 5, type: "proof", where: "워크북", title: "숙제 · 내 글 쓰기 인증", sub: "워크북 숙제와 내 글 쓰기를 하고 사진 올리기", rule: "마감 날 밤 10시까지 사진을 올려요" },
  { n: 6, type: "check", where: "첨삭", title: "쌤 첨삭 확인", sub: "내 사진과 쌤 첨삭본을 나란히 보고 왜 틀렸는지 확인", rule: "원본과 첨삭본을 비교해 틀린 이유를 찾아요" },
  { n: 7, type: "proof", where: "워크북", title: "다시 쓰기 인증", sub: "쌤 첨삭을 보고 다시 써서 사진 올리기", rule: "고친 글을 다시 써서 인증하면 유닛 끝!" },
];
export const CIRCLED = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦"];
export const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** 예전 수업 반 (화 · 목 / 월 · 수) — 학생 정보에 남아 있어요. 화면에는 쓰지 않아요. */
export type Group = "tt" | "mw";
export const GROUPS: { key: Group; label: string; days: number[] }[] = [
  { key: "tt", label: "화 · 목 반", days: [2, 4] },
  { key: "mw", label: "월 · 수 반", days: [1, 3] },
];
export function groupOf(days: number[] | null | undefined): Group | null {
  const d = [...(days ?? [])].sort((a, b) => a - b).join(",");
  return d === "2,4" ? "tt" : d === "1,3" ? "mw" : null;
}
export const groupLabel = (g: Group | null) => GROUPS.find((x) => x.key === g)?.label ?? "수업 반 미정";

export const WORD_ACTS = [
  { key: "flash", label: "① 플래시 카드" },
  { key: "match", label: "② 매칭 게임" },
  { key: "word", label: "③ 단어 고르기" },
  { key: "meaning", label: "④ 뜻 고르기" },
] as const;
export const SENT_ACTS = [
  { key: "shadow", label: "① 듣고 쉐도잉" },
  { key: "chunk", label: "② 덩어리 배열" },
] as const;
export type WordAct = (typeof WORD_ACTS)[number]["key"];
export type SentAct = (typeof SENT_ACTS)[number]["key"];

/** app_checks 키: w1-flash · s2-chunk · video (③ 영상 강의 · 예전 class1도 인정) */
export const wordKey = (set: number, act: string) => `w${set}-${act}`;
export const sentKey = (set: number, act: string) => `s${set}-${act}`;
export const VIDEO_KEY = "video";

export type StepState = {
  n: number;
  status: "done" | "wait" | "again" | "todo" | "doing" | "locked" | "new";
  note: string;
  /** 쌤 확인 · 첨삭이 왔는데 아직 안 봄 */
  fresh?: boolean;
};
