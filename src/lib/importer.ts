import * as XLSX from "xlsx";
import { activityFromLabel } from "./grading";

export type Parsed = {
  units: { id: string; stage: string; ord: number; title: string; scope: string | null; pass_score: number; status: string }[];
  cards: { unit_id: string; ord: number; title: string; body: string; audio_url: string | null; check_q: string | null; check_a: string | null; check_choices: string | null }[];
  words: { unit_id: string; grp: string | null; word: string; meaning: string | null }[];
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
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const n = (v: unknown, d = 0) => (Number.isFinite(Number(v)) && s(v) !== "" ? Number(v) : d);

/**
 * 유닛 ID로 전체 순서 만들기: PREP(P-Unit) → Basic(B-Unit) → STEP 1(S1-Unit) → STEP 2(S2-Unit) …
 * 중간에 쪼갠 유닛은 B-Unit 3-1, B-Unit 3-2처럼 써요. 형식이 다르면 맨 뒤로 (순서 칸 기준).
 */
export function unitOrder(id: string, fallback = 0): number {
  const m = id.replace(/\s+/g, "").match(/^(P|B|S(\d+))-?Unit(\d+)(?:[-.](\d+))?$/i);
  if (!m) return 9_000_000 + fallback;
  const rank = m[1].toUpperCase() === "P" ? 0 : m[1].toUpperCase() === "B" ? 1 : 1 + Number(m[2]);
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
  for (const need of ["유닛", "문항"]) if (!wb.Sheets[need]) problems.push(`'${need}' 시트가 없어요.`);

  const units = sheet(wb, "유닛")
    .filter((r) => s(r["유닛 ID"]))
    .map((r, i) => {
      const pass = s(r["통과 기준"]).match(/(\d+)\s*개/);
      return {
        id: s(r["유닛 ID"]),
        stage: s(r["단계"]) || "기초 과정",
        ord: unitOrder(s(r["유닛 ID"]), n(r["순서"], i + 1)),
        title: s(r["유닛 이름"]),
        scope: s(r["범위"]) || null,
        pass_score: pass ? Number(pass[1]) : 7,
        status: s(r["상태"]) === "준비 중" ? "draft" : "published",
      };
    });
  const unitIds = new Set(units.map((u) => u.id));

  const cards = sheet(wb, "설명 카드")
    .filter((r) => s(r["유닛"]) && s(r["제목"]))
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

  const words = sheet(wb, "단어")
    .filter((r) => s(r["유닛"]) && s(r["단어"]))
    .map((r) => ({ unit_id: s(r["유닛"]), grp: s(r["묶음"]) || null, word: s(r["단어"]), meaning: s(r["뜻"]) || null }));

  const codes = sheet(wb, "오류 코드")
    .filter((r) => s(r["코드"]))
    .map((r) => ({
      code: s(r["코드"]),
      first_unit: s(r["처음 나온 유닛"]) || null,
      name: s(r["오류"]) || s(r["코드"]),
      bubble: s(r["캐릭터 말풍선"]) || null,
      why: s(r["왜 틀렸는지 한 줄"]) || null,
    }));
  const codeSet = new Set(codes.map((c) => c.code));

  const itemRows = sheet(wb, "문항");
  const items: Parsed["items"] = [];
  itemRows.forEach((r, idx) => {
    const line = idx + 2;
    if (!s(r["유닛"]) && !s(r["문제"])) return;
    const unit_id = s(r["유닛"]);
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

  return { units, cards, words, items, codes, topics, problems };
}
