/**
 * 유닛 한 개 = 워크시트 맨 앞 '이번 주 할 일'과 같은 체크리스트
 * (서버 · 학생 화면 · 쌤 화면이 같이 써요)
 *
 * 요일은 학생 수업 요일 두 개를 기준으로 정해요.
 *   0 수업 1 전날 · 1 수업 1 · 2 수업 1 다음 날 · 3 수업 2 전날 · 4 수업 2 · 5 수업 2 다음 날
 *   수업이 화 · 금이면 → 월 화 수 목 금 토 (워크시트와 같아요)
 */
export type TaskKey = "vocab" | "p12" | "warmup" | "class1" | "practice" | "p67" | "p8" | "class2" | "p9" | "feedback" | "p10" | "test";
/** app = 앱에서 함 · sheet = 워크시트 쓰고 사진 · class = 수업 · feedback = 첨삭 확인 */
export type TaskType = "app" | "sheet" | "class" | "feedback";

export type PlanTask = {
  key: TaskKey;
  slot: 0 | 1 | 2 | 3 | 4 | 5;
  type: TaskType;
  icons: string;
  title: string;
  hint: string;
  /** 쌤이 빨간 펜으로 첨삭하는 쪽 (나머지 사진은 확인만) */
  correct?: boolean;
};

export const ICONS = [
  ["📱", "앱"],
  ["✏️", "워크시트"],
  ["📷", "사진 제출"],
  ["👩‍🏫", "수업 시간"],
] as const;

export const PLAN: PlanTask[] = [
  { key: "vocab", slot: 0, type: "app", icons: "📱", title: "앱 단어 학습", hint: "듣고 익히기 → 뜻 맞히기 → 철자 쓰기" },
  { key: "p12", slot: 0, type: "sheet", icons: "✏️ 📷", title: "1~2쪽 단어 쓰기", hint: "앱에서 먼저 듣고 익힌 뒤 쓰기 · 다 쓰면 사진 올리기" },
  { key: "warmup", slot: 1, type: "app", icons: "📱", title: "Warming Up Test", hint: "수업 전에 단어 점검" },
  { key: "class1", slot: 1, type: "class", icons: "👩‍🏫", title: "수업", hint: "문장 규칙 · 덩어리 배열 · 문장 만들기" },
  { key: "practice", slot: 2, type: "app", icons: "📱", title: "앱 문장 연습", hint: "설명 다시 보기 → 단어 배열 → 틀린 표현 → 한글 → 영어" },
  { key: "p67", slot: 2, type: "sheet", icons: "✏️ 📷", title: "6~7쪽 문장 쓰기 · 영작 연습", hint: "앱 문장 연습을 먼저 하고 풀기 · 다 쓰면 사진 올리기" },
  { key: "p8", slot: 3, type: "sheet", icons: "✏️ 📷", title: "8쪽 생각 정리 (Organizer)", hint: "질문을 읽고 생각을 칸에 채우기 · 사진 올리기" },
  { key: "class2", slot: 4, type: "class", icons: "👩‍🏫", title: "수업", hint: "숙제 검사 · 서술형 확장" },
  { key: "p9", slot: 4, type: "sheet", icons: "✏️ 📷", title: "9쪽 내 글 쓰기", hint: "다 쓰면 사진 올리기 · 쌤이 첨삭해 줘요", correct: true },
  { key: "feedback", slot: 5, type: "feedback", icons: "👀", title: "첨삭 확인", hint: "9쪽에 쌤이 고친 곳 보기" },
  { key: "p10", slot: 5, type: "sheet", icons: "✏️ 📷", title: "10쪽 다시 쓰기", hint: "첨삭을 보고 고쳐 쓰기 · 사진 올리기" },
  { key: "test", slot: 5, type: "app", icons: "📱", title: "확인 테스트", hint: "마지막으로 앱 확인 테스트!" },
];

export const SHEET_PAGES = PLAN.filter((t) => t.type === "sheet").map((t) => t.key);
export const taskOf = (key: string) => PLAN.find((t) => t.key === key);
export const pageLabel = (key: string | null | undefined) => taskOf(key ?? "")?.title ?? key ?? "";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const weekdayName = (d: number) => WD[((d % 7) + 7) % 7];

/** 수업 요일 두 개 (0 일 ~ 6 토). 없으면 화 · 금 */
export function normDays(days: number[] | null | undefined): [number, number] {
  const d = (days ?? []).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6).sort((a, b) => a - b);
  if (d.length >= 2) return [d[0], d[1]];
  return [2, 5];
}

/** 칸(0~5)의 요일 */
export function slotDay(slot: number, days: [number, number]): number {
  const [a, b] = days;
  const base = slot < 3 ? a : b;
  const off = slot % 3 === 0 ? -1 : slot % 3 === 1 ? 0 : 1;
  return (((base + off) % 7) + 7) % 7;
}

export type TaskState = {
  key: TaskKey;
  done: boolean;
  /** 화면에 보일 짧은 상태 */
  status: string;
  tone: "todo" | "done" | "wait" | "again" | "new";
  /** 사진 쪽: 지금 제출 id (쌤 확인 중 · 돌려받음) */
  submissionId?: string | null;
  score?: string | null;
};
