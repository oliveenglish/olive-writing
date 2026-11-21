// 배포할 때마다 자동으로 돌아요: data 폴더의 엑셀(.xlsx) → src/data/units.json
// 엑셀을 고치면 GitHub의 data 폴더에 그 파일만 바꿔 올리면 돼요. (파일 이름은 달라도 돼요, .xlsx 한 개만 두세요)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const out = join(root, "src", "data", "units.json");

const files = readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"));
if (files.length !== 1) {
  console.error(`[단어 엑셀] data 폴더에 .xlsx 파일이 ${files.length}개 있어요. 한 개만 두세요: ${files.join(", ")}`);
  process.exit(1);
}
const wb = XLSX.read(readFileSync(join(dataDir, files[0])), { type: "buffer" });

const s = (v) => (v === null || v === undefined ? "" : String(v).trim());
const norm = (k) => k.replace(/\s/g, "");
const pick = (row, names) => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => norm(x) === norm(n));
    if (k && s(row[k])) return s(row[k]);
  }
  return "";
};
const sheet = (names) => {
  const n = Object.keys(wb.Sheets).find((x) => names.some((y) => norm(y) === norm(x)));
  return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }) : null;
};

/** 유닛 순서: B-Unit → S1-Unit → … → S8-Unit, "(선택)" 같은 꼬리는 무시 */
function order(id, i) {
  const m = id.replace(/\(.*?\)/g, "").replace(/\s+/g, "").match(/^(B|S(\d+))-?Unit(\d+)(?:[-.](\d+))?$/i);
  if (!m) return 9_000_000 + i;
  const rank = m[1].toUpperCase() === "B" ? 1 : 1 + Number(m[2]);
  return rank * 100_000 + Number(m[3]) * 100 + Number(m[4] ?? 0);
}

const unitRows = sheet(["유닛별 주제", "유닛"]);
const wordRows = sheet(["어휘 · 예문", "어휘·예문", "어휘", "단어"]);
if (!unitRows || !wordRows) {
  console.error("[단어 엑셀] '유닛별 주제' 시트와 '어휘 · 예문' 시트가 있어야 해요.");
  process.exit(1);
}

const units = unitRows
  .map((r, i) => ({
    id: pick(r, ["유닛 ID"]),
    stage: pick(r, ["단계"]),
    title: pick(r, ["유닛 문법", "유닛 이름"]),
    topic: pick(r, ["주제"]),
    level: pick(r, ["목표 수준", "수준"]),
    ord: 0,
    i,
  }))
  .filter((u) => u.id)
  .map((u) => ({ ...u, ord: order(u.id, u.i) }))
  .sort((a, b) => a.ord - b.ord)
  .map(({ i, ...u }) => u);

const ids = new Set(units.map((u) => u.id));
const words = {};
const problems = [];
wordRows.forEach((r, i) => {
  const unit = pick(r, ["유닛 ID", "유닛"]);
  const word = pick(r, ["단어 · 표현", "단어", "표현"]);
  if (!unit || !word) return;
  if (!ids.has(unit)) problems.push(`${i + 2}행: 유닛 "${unit}"이(가) 유닛 시트에 없어요`);
  (words[unit] ??= []).push({
    n: Number(pick(r, ["번호", "순서"])) || (words[unit]?.length ?? 0) + 1,
    word,
    pos: pick(r, ["품사"]),
    meaning: pick(r, ["뜻"]),
    colloc: pick(r, ["콜로케이션 · 덩어리", "콜로케이션"]),
    example: pick(r, ["예문"]),
    example_ko: pick(r, ["예문 뜻", "예문 해석"]),
  });
});
for (const k of Object.keys(words)) words[k].sort((a, b) => a.n - b.n);
if (problems.length) {
  console.error("[단어 엑셀] 확인 필요:\n" + problems.slice(0, 20).join("\n"));
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: files[0], units, words }));
const total = Object.values(words).reduce((a, w) => a + w.length, 0);
console.log(`[단어 엑셀] ${files[0]} → 유닛 ${units.length}개 · 단어 ${total}개`);
