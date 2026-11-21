import * as XLSX from "xlsx";
import { activityFromLabel } from "./grading";

export type Parsed = {
  units: { id: string; stage: string; ord: number; title: string; scope: string | null; pass_score: number; status: string }[];
  cards: { unit_id: string; ord: number; title: string; body: string; audio_url: string | null; check_q: string | null; check_a: string | null; check_choices: string | null }[];
  words: { unit_id: string; ord: number; grp: string | null; word: string; pos: string | null; meaning: string | null; colloc: string | null; example: string | null; example_ko: string | null }[];
  items: {
    id: string;
    unit_id: string;
    activity: string;
    activity_label: string;
    no: number;
    prompt: string;
    answer: string | null;
    alt_answers: string | null;
    error_code: string | null;
    grading: string | null;
    purpose: string;
    choices: string | null;
    picture: string | null;
    memo: string | null;
  }[];
  codes: { code: string; first_unit: string | null; name: string; bubble: string | null; why: string | null }[];
  topics: { stage: string; no: number; format: string | null; topic: string; link: string | null }[];
  problems: string[];
  /** 막지는 않지만 알려 줄 것 (예: PREP 줄은 건너뜀) */
  notes: string[];
  wordsOnly: boolean;
  /** 문항 시트가 있는 파일인지 (없으면 기존 문항은 그대로 둬요) */
  hasItems: boolean;
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const n = (v: unknown, d = 0) => (Number.isFinite(Number(v)) && s(v) !== "" ? Number(v) : d);
/** 머리 칸 이름이 조금 달라도 읽어요 (띄어쓰기 무시) */
const pick = (r: Row, names: string[]) => {
  const keys = Object.keys(r);
  for (const nm of names) {
    const k = keys.find((x) => x.replace(/\s/g, "") === nm.replace(/\s/g, ""));
    if (k && s(r[k])) return s(r[k]);
  }
  return "";
};
/** PREP 유닛은 이제 쓰지 않아요 (be동사 문장을 만들 수 있는 학생부터 Basic으로 시작) */
export const isPrep = (id: string) => /^P[-\s]?Unit/i.test(id.trim());

/**
 * 유닛 ID로 전체 순서 만들기: Basic(B-Unit) → STEP 1(S1-Unit) → STEP 2(S2-Unit) …
 * 중간에 쪼갠 유닛은 B-Unit 3-1, B-Unit 3-2처럼 써요. 형식이 다르면 맨 뒤로 (순서 칸 기준).
 */
export function unitOrder(id: string, fallback = 0): number {
  const m = id.replace(/\(.*?\)/g, "").replace(/\s+/g, "").match(/^(B|S(\d+))-?Unit(\d+)(?:[-.](\d+))?$/i);
  if (!m) return 9_000_000 + fallback;
  const rank = m[1].toUpperCase() === "B" ? 1 : 1 + Number(m[2]);
  return rank * 100_000 + Number(m[3]) * 100 + Number(m[4] ?? 0);
}

function sheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
}

/** 엑셀 문항 DB 읽기 + 검사 */
export function parseWorkbook(buf: ArrayBuffer): Parsed {
  const wb = XLSX.read(buf, { type: "array" });
  const problems: string[] = [];
  const notes: string[] = [];
  const skipped = new Set<string>();
  // 유닛 시트: '유닛' 또는 '유닛별 주제' (어휘 · 예문 엑셀)
  const unitSheet = ["유닛", "유닛별 주제"].find((n) => wb.Sheets[n]);
  const wordSheets = ["단어", "어휘", "어휘 · 예문", "어휘·예문"].filter((n) => wb.Sheets[n]);
  const hasItems = !!wb.Sheets["문항"];
  // 단어 시트만 있는 파일도 올릴 수 있어요 → 이미 사이트에 있는 유닛에 단어만 넣어요
  const wordsOnly = !unitSheet && !hasItems && wordSheets.length > 0;
  if (!wordsOnly && !unitSheet) problems.push("'유닛' 시트(또는 '유닛별 주제' 시트)가 없어요.");
  if (unitSheet && !hasItems) notes.push("문항 시트가 없어요. 유닛 · 단어만 넣고, 앱 문장 연습 · 확인 테스트 문제는 나중에 문항 엑셀을 올리면 들어가요.");

  const units = sheet(wb, unitSheet ?? "유닛")
    .filter((r) => s(r["유닛 ID"]))
    .filter((r) => {
      if (!isPrep(s(r["유닛 ID"]))) return true;
      skipped.add(s(r["유닛 ID"]));
      return false;
    })
    .map((r, i) => {
      const pass = s(r["통과 기준"]).match(/(\d+)\s*개/);
      return {
        id: s(r["유닛 ID"]),
        stage: s(r["단계"]) || "기초 과정",
        ord: unitOrder(s(r["유닛 ID"]), n(r["순서"], i + 1)),
        title: s(r["유닛 이름"]) || s(r["유닛 문법"]),
        scope: s(r["범위"]) || [s(r["주제"]), s(r["목표 수준"])].filter(Boolean).join(" · ") || null,
        pass_score: pass ? Number(pass[1]) : 6,
        status: s(r["상태"]) === "준비 중" ? "draft" : "published",
      };
    });
  const unitIds = new Set(units.map((u) => u.id));

  const notPrep = (r: Row) => !isPrep(s(r["유닛"]));
  const cards = sheet(wb, "설명 카드")
    .filter((r) => s(r["유닛"]) && s(r["제목"]) && notPrep(r))
    .map((r, i) => ({
      unit_id: s(r["유닛"]),
      ord: n(r["순서"], i + 1),
      title: s(r["제목"]),
      body: s(r["내용"]),
      audio_url: s(r["음성 파일"]) || null, // 쌤 목소리 (선택)
      check_q: s(r["확인 문제"]) || null, // 카드 끝 확인 한 문제 (선택)
      check_a: s(r["확인 정답"]) || null,
      check_choices: s(r["확인 보기"]) || null,
    }));

  // 유닛별 익힐 단어 20개: 유닛 · 순서 · 묶음 · 단어 · 품사 · 뜻 · 예문 · 예문 뜻 ('어휘' 시트 이름도 돼요)
  const wordRows = wordSheets.flatMap((n) => sheet(wb, n));
  const words = wordRows
    .filter((r) => pick(r, ["유닛", "유닛 ID"]) && pick(r, ["단어", "표현", "단어 · 표현"]) && !isPrep(pick(r, ["유닛", "유닛 ID"])))
    .map((r, i) => ({
      unit_id: pick(r, ["유닛", "유닛 ID"]),
      ord: n(pick(r, ["순서", "번호"]), i + 1),
      grp: pick(r, ["묶음", "주제"]) || null,
      word: pick(r, ["단어", "표현", "단어 · 표현"]),
      pos: pick(r, ["품사"]) || null,
      meaning: pick(r, ["뜻", "우리말 뜻", "한국어 뜻"]) || null,
      colloc: pick(r, ["콜로케이션 · 덩어리", "콜로케이션", "덩어리"]) || null,
      example: pick(r, ["예문", "영어 예문"]) || null,
      example_ko: pick(r, ["예문 뜻", "예문 해석", "해석"]) || null,
    }));
  if (!wordsOnly) for (const w of words) if (!unitIds.has(w.unit_id)) problems.push(`단어 시트 · 유닛 "${w.unit_id}"이(가) 유닛 시트에 없어요. (${w.word})`);
  const perUnit = new Map<string, number>();
  words.forEach((w) => perUnit.set(w.unit_id, (perUnit.get(w.unit_id) ?? 0) + 1));
  const few = wordsOnly ? [] : units.filter((u) => (perUnit.get(u.id) ?? 0) < 8).map((u) => u.id);
  if (few.length) notes.push(`단어가 8개보다 적은 유닛 ${few.length}개: ${few.slice(0, 8).join(", ")}${few.length > 8 ? " …" : ""} (Warming Up Test가 짧아져요)`);

  const codes = sheet(wb, "오류 코드")
    .filter((r) => s(r["코드"]))
    .map((r) => ({
      code: s(r["코드"]),
      first_unit: s(r["처음 나온 유닛"]) || null,
      name: s(r["오류"]) || s(r["코드"]),
      bubble: s(r["캐릭터 말풍선"]) || null,
      why: s(r["왜 틀렸는지 한 줄"]) || null,
    }));
  // 같은 코드가 두 줄 있으면 처음 줄만 써요 (저장할 때 충돌 방지)
  const dupCodes: string[] = [];
  const codesUniq = codes.filter((c, i) => {
    const first = codes.findIndex((x) => x.code === c.code) === i;
    if (!first) dupCodes.push(c.code);
    return first;
  });
  codes.length = 0;
  codes.push(...codesUniq);
  const codeSet = new Set(codes.map((c) => c.code));

  const itemRows = sheet(wb, "문항");
  const items: Parsed["items"] = [];
  itemRows.forEach((r, idx) => {
    const line = idx + 2;
    if (!s(r["유닛"]) && !s(r["문제"])) return;
    const unit_id = s(r["유닛"]);
    if (isPrep(unit_id)) return;
    const label = s(r["활동"]);
    const activity = activityFromLabel(label);
    const it = {
      id: `${unit_id}|${activity}|${n(r["번호"])}|${s(r["용도"]) || "연습"}`,
      unit_id,
      activity,
      activity_label: label,
      no: n(r["번호"]),
      prompt: s(r["문제"]),
      answer: s(r["정답"]) || null,
      alt_answers: s(r["같이 인정하는 답"]) || null,
      error_code: s(r["오류 코드"]) || null,
      grading: s(r["채점"]) || null,
      purpose: s(r["용도"]) || "연습",
      choices: s(r["보기"]) || null,
      picture: s(r["그림"]) || null,
      memo: s(r["메모"]) || null,
    };
    if (!unitIds.has(unit_id)) problems.push(`문항 시트 ${line}행 · 유닛 "${unit_id}"이(가) 유닛 시트에 없어요.`);
    if (!it.prompt) problems.push(`문항 시트 ${line}행 · 문제 칸이 비어 있어요.`);
    if (!it.answer && activity !== "answer") problems.push(`문항 시트 ${line}행 · 정답 칸이 비어 있어요.`);
    if (!["arrange", "find", "ko2en", "answer", "test", "hand", "choose"].includes(activity))
      problems.push(`문항 시트 ${line}행 · 활동 "${label}"을(를) 알 수 없어요.`);
    if (it.error_code && !codeSet.has(it.error_code))
      problems.push(`문항 시트 ${line}행 · 오류 코드 "${it.error_code}"가 오류 코드 시트에 없어요.`);
    items.push(it);
  });
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) problems.push(`문항이 겹쳐요: ${it.unit_id} · ${it.activity_label} · ${it.no}번 (${it.purpose})`);
    ids.add(it.id);
  }

  const topics = sheet(wb, "점검 소재")
    .filter((r) => s(r["단계"]) && s(r["소재"]))
    .map((r, i) => ({
      stage: s(r["단계"]),
      no: n(r["번호"], i + 1),
      format: s(r["점검 형식"]) || null,
      topic: s(r["소재"]),
      link: s(r["연결 문법 · 표현"]) || null,
    }));

  if (skipped.size) notes.push(`PREP 유닛 ${skipped.size}개는 건너뛰었어요 (이제 Basic부터 시작해요).`);
  if (wordsOnly) notes.push(`단어만 있는 파일이에요. 사이트에 이미 있는 유닛에 단어 ${words.length}개를 넣어요.`);
  return { units, cards, words, items, codes, topics, problems, notes, wordsOnly, hasItems };
}
