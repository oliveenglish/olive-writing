import { db } from "./supabase";
import { addDays, iso, todayKST, weekStart } from "./dates";
import type { Item } from "./grading";

export type Unit = {
  id: string;
  stage: string;
  ord: number;
  title: string;
  scope: string | null;
  pass_score: number;
  status: string;
};
export type Progress = {
  student_id: string;
  unit_id: string;
  step: number;
  test_score: number | null;
  test_tries: number;
  fails_in_row: number;
  passed: boolean;
  skipped: boolean;
  updated_at: string;
};

export async function allUnits(): Promise<Unit[]> {
  const { data } = await db().from("units").select("*").order("ord");
  return (data as Unit[]) ?? [];
}

export async function progressMap(studentId: string): Promise<Map<string, Progress>> {
  const { data } = await db().from("unit_progress").select("*").eq("student_id", studentId);
  return new Map(((data as Progress[]) ?? []).map((p) => [p.unit_id, p]));
}

export async function passedFinalStages(studentId: string): Promise<Set<string>> {
  const { data } = await db().from("final_checks").select("stage,status").eq("student_id", studentId);
  return new Set((data ?? []).filter((r) => r.status === "passed").map((r) => r.stage as string));
}

export type Position =
  | { type: "unit"; unit: Unit; progress?: Progress }
  | { type: "final"; stage: string; submitted: boolean }
  | { type: "waiting"; stage: string } // 다음 유닛 준비 중
  | { type: "done" };

/** 학생이 지금 있어야 할 자리 */
export async function position(studentId: string): Promise<Position> {
  const [units, prog, finals] = await Promise.all([allUnits(), progressMap(studentId), passedFinalStages(studentId)]);
  if (!units.length) return { type: "waiting", stage: "" };
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  for (const stage of stages) {
    const su = units.filter((u) => u.stage === stage);
    for (const u of su) {
      const p = prog.get(u.id);
      if (p?.passed) continue;
      if (u.status !== "published") return { type: "waiting", stage };
      return { type: "unit", unit: u, progress: p };
    }
    if (!finals.has(stage)) {
      const { data } = await db()
        .from("final_checks")
        .select("status")
        .eq("student_id", studentId)
        .eq("stage", stage)
        .eq("status", "submitted")
        .limit(1);
      return { type: "final", stage, submitted: (data ?? []).length > 0 };
    }
  }
  return { type: "done" };
}

/** 최근 N일 동안 틀린 오류 코드 횟수 */
export async function wrongCodeCounts(studentId: string, days = 30): Promise<Map<string, number>> {
  const since = addDays(todayKST(), -days).toISOString();
  const { data } = await db()
    .from("attempts")
    .select("error_code")
    .eq("student_id", studentId)
    .eq("correct", false)
    .not("error_code", "is", null)
    .gte("created_at", since);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.error_code as string, (m.get(r.error_code as string) ?? 0) + 1);
  return m;
}

/** 3번 이상 틀린 코드 = 약점 */
export async function weaknesses(studentId: string) {
  const counts = await wrongCodeCounts(studentId);
  const codes = Array.from(counts.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  if (!codes.length) return [] as { code: string; name: string; count: number }[];
  const { data } = await db().from("error_codes").select("code,name").in("code", codes.map((c) => c[0]));
  const names = new Map((data ?? []).map((r) => [r.code, r.name]));
  return codes.map(([code, count]) => ({ code, name: (names.get(code) as string) ?? code, count }));
}

/** 틀린 코드 → 1 · 3 · 7일 뒤 복습 */
export async function scheduleReviews(studentId: string, codes: string[]) {
  const uniq = Array.from(new Set(codes.filter(Boolean)));
  if (!uniq.length) return;
  const { data: pending } = await db()
    .from("reviews")
    .select("error_code")
    .eq("student_id", studentId)
    .eq("done", false)
    .in("error_code", uniq);
  const has = new Set((pending ?? []).map((r) => r.error_code));
  const t = todayKST();
  const rows = uniq
    .filter((c) => !has.has(c))
    .flatMap((c) => [1, 3, 7].map((d) => ({ student_id: studentId, error_code: c, due_date: iso(addDays(t, d)) })));
  if (rows.length) await db().from("reviews").insert(rows);
}

export async function dueReviews(studentId: string) {
  const { data } = await db()
    .from("reviews")
    .select("*")
    .eq("student_id", studentId)
    .eq("done", false)
    .lte("due_date", iso(todayKST()));
  return data ?? [];
}

/** 오류 코드에 맞는 문제 고르기 (복습 · 점검용 새 문장 먼저, 최근에 푼 건 뒤로) */
export async function pickItemsForCodes(studentId: string, codes: string[], count: number): Promise<Item[]> {
  if (!codes.length) return [];
  const { data } = await db()
    .from("items")
    .select("*")
    .in("error_code", codes)
    .neq("activity", "answer");
  const items = (data as Item[]) ?? [];
  const since = addDays(todayKST(), -7).toISOString();
  const { data: recent } = await db()
    .from("attempts")
    .select("item_id")
    .eq("student_id", studentId)
    .gte("created_at", since);
  const seen = new Set((recent ?? []).map((r) => r.item_id));
  const score = (i: Item) => (i.purpose === "복습" ? 0 : i.purpose === "점검" ? 1 : 2) + (seen.has(i.id) ? 3 : 0) + Math.random();
  return items.sort((a, b) => score(a) - score(b)).slice(0, count);
}

/** 이번 주 주간 점검 (없으면 만들기) */
export async function weeklyRun(studentId: string) {
  const ws = weekStart(todayKST());
  const key = iso(ws);
  const { data: row } = await db().from("weekly_runs").select("*").eq("student_id", studentId).eq("week_start", key).maybeSingle();
  if (row) return row;
  const { data: touched } = await db()
    .from("attempts")
    .select("unit_id")
    .eq("student_id", studentId)
    .in("context", ["unit", "test"])
    .gte("created_at", ws.toISOString());
  const unitIds = Array.from(new Set((touched ?? []).map((r) => r.unit_id).filter(Boolean))) as string[];
  if (!unitIds.length) return null;
  const ins = {
    student_id: studentId,
    week_start: key,
    available_from: iso(addDays(ws, 4)), // 금요일
    unit_ids: unitIds,
  };
  await db().from("weekly_runs").insert(ins);
  return { ...ins, status: "pending", item_ids: null, score: null, total: null };
}

/** 주간 점검 문제 10개: 배열 3 · 고치기 3 · 한글→영어 3 · 대답 1 */
export async function buildWeeklyItems(studentId: string, unitIds: string[]): Promise<Item[]> {
  const { data } = await db().from("items").select("*").in("unit_id", unitIds).neq("activity", "test");
  const items = (data as Item[]) ?? [];
  const wrong = await wrongCodeCounts(studentId, 7);
  const pick = (act: string, n: number) =>
    items
      .filter((i) => i.activity === act || (act === "arrange" && i.activity === "choose"))
      .map((i) => ({ i, s: (i.purpose === "점검" ? 0 : 2) - (i.error_code ? wrong.get(i.error_code) ?? 0 : 0) * 0.5 + Math.random() }))
      .sort((a, b) => a.s - b.s)
      .slice(0, n)
      .map((x) => x.i);
  return [...pick("arrange", 3), ...pick("find", 3), ...pick("ko2en", 3), ...pick("answer", 1)];
}

/** 학생이 지금까지 배운 오류 코드 (배운 것만 채점) */
export async function taughtCodes(studentId: string) {
  const [units, prog, codes] = await Promise.all([
    allUnits(),
    progressMap(studentId),
    db().from("error_codes").select("*"),
  ]);
  const pos = await position(studentId);
  const limit = pos.type === "unit" ? pos.unit.ord : Infinity;
  const ordOf = new Map(units.map((u) => [u.id, u.ord]));
  void prog;
  return ((codes.data ?? []) as { code: string; first_unit: string; name: string; bubble: string }[]).filter(
    (c) => (ordOf.get(c.first_unit) ?? 0) <= limit
  );
}

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await db().storage.from("submissions").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** 과제용 약점 코드: 3번 이상 틀린 것, 없으면 최근에 틀린 것 */
export async function recordedWeakCodes(studentId: string): Promise<string[]> {
  const counts = await wrongCodeCounts(studentId);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const strong = sorted.filter(([, n]) => n >= 3).map(([c]) => c);
  return strong.length ? strong : sorted.slice(0, 3).map(([c]) => c);
}
