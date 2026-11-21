/**
 * 이번 주 할 일 7단계 (모든 학생 같아요 · 수업 요일만 학생마다 달라요)
 * 월 ①② · 화 ③ · 수 ④⑤ · 목 ⑥ · 금 ⑦
 */
export type StepType = "app" | "proof" | "class";
export type Step = { n: 1 | 2 | 3 | 4 | 5 | 6 | 7; day: string; type: StepType; title: string; sub: string };

export const STEPS: Step[] = [
  { n: 1, day: "월", type: "app", title: "앱 단어 학습", sub: "10개씩 · 플래시 카드 · 매칭 · 단어 고르기 · 뜻 고르기" },
  { n: 2, day: "월", type: "proof", title: "워크북 단어 학습 인증", sub: "워크북에 단어를 쓰고 사진 올리기" },
  { n: 3, day: "화", type: "class", title: "수업 참석", sub: "문장 규칙 배우기" },
  { n: 4, day: "수", type: "app", title: "앱 문장 연습", sub: "10문장씩 · 듣고 쉐도잉 · 덩어리 배열" },
  { n: 5, day: "수", type: "proof", title: "쌤 숙제 인증", sub: "쌤이 낸 숙제를 하고 사진 올리기" },
  { n: 6, day: "목", type: "class", title: "수업 참석", sub: "글쓰기 · 서술형 확장" },
  { n: 7, day: "금", type: "proof", title: "첨삭 확인 · 다시 쓰기 인증", sub: "쌤 첨삭을 보고 다시 써서 사진 올리기" },
];
export const DAYS = ["월", "화", "수", "목", "금"];
export const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

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

/** app_checks 키: w1-flash · s2-chunk · class1 */
export const wordKey = (set: number, act: string) => `w${set}-${act}`;
export const sentKey = (set: number, act: string) => `s${set}-${act}`;

export type StepState = {
  n: number;
  status: "done" | "wait" | "again" | "todo" | "doing" | "locked" | "new";
  note: string;
};
