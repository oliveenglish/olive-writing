import { db } from "./supabase";
import { addDays, iso, todayKST, weekStart } from "./dates";
import type { Item } from "./grading";
import { PLAN, type TaskState } from "./plan";

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

export type Position =
  | { type: "unit"; unit: Unit; progress?: Progress }
  | { type: "waiting"; stage: string } // 다음 유닛 준비 중
  | { type: "done" };

/** 학생이 지금 있어야 할 자리: 아직 통과 못 한 첫 유닛 (단계 끝 최종 점검은 없어요) */
export async function position(studentId: string): Promise<Position> {
  const [units, prog] = await Promise.all([allUnits(), progressMap(studentId)]);
  if (!units.length) return { type: "waiting", stage: "" };
  for (const u of units) {
    const p = prog.get(u.id);
    if (p?.passed) continue;
    if (u.status !== "published") return { type: "waiting", stage: u.stage };
    return { type: "unit", unit: u, progress: p };
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

/** 오류 코드에 맞는 문제 고르기 (점검용 새 문장 먼저, 최근에 푼 건 뒤로) */
export async function pickItemsForCodes(studentId: string, codes: string[], count: number): Promise<Item[]> {
  if (!codes.length) return [];
  const { data } = await db()
    .from("items")
    .select("*")
    .in("error_code", codes)
    .in("activity", ["choose", "arrange", "find", "ko2en"]);
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
    .eq("context", "test") // 확인 테스트까지 본 유닛만 (유닛 연습만 한 주는 주간 점검이 안 생겨요)
    .gte("created_at", new Date(ws.getTime() - 9 * 3600 * 1000).toISOString()); // 한국 시간 월요일 0시부터
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

/**
 * 유닛 한 개의 '이번 주 할 일' 상태
 * 앱 · 수업 칸 = unit_checks / 사진 칸 = 가장 최근 워크시트 제출 / 확인 테스트 = unit_progress
 */
export async function planState(studentId: string, unitId: string): Promise<TaskState[]> {
  const [{ data: checks }, { data: subs }, { data: prog }] = await Promise.all([
    db().from("unit_checks").select("task,score,total").eq("student_id", studentId).eq("unit_id", unitId),
    db().from("submissions").select("id,page,status,decision,seen,created_at").eq("student_id", studentId).eq("kind", "ws").eq("ref", unitId).order("created_at", { ascending: false }),
    db().from("unit_progress").select("passed,test_tries,test_score").eq("student_id", studentId).eq("unit_id", unitId).maybeSingle(),
  ]);
  const ck = new Map((checks ?? []).map((c) => [c.task as string, c]));
  const latest = new Map<string, { id: string; status: string; decision: string | null; seen: boolean }>();
  for (const x of subs ?? []) if (x.page && !latest.has(x.page)) latest.set(x.page as string, x as never);
  return PLAN.map((t): TaskState => {
    if (t.type === "app" && t.key === "test") {
      if (prog?.passed) return { key: t.key, done: true, status: "통과", tone: "done", score: prog.test_score != null ? `${prog.test_score} / 8` : null };
      if ((prog?.test_tries ?? 0) > 0) return { key: t.key, done: false, status: "다시 도전", tone: "again" };
      return { key: t.key, done: false, status: "", tone: "todo" };
    }
    if (t.type === "app" || t.type === "class") {
      const c = ck.get(t.key);
      const score = c && c.total ? `${c.score} / ${c.total}` : null;
      return c ? { key: t.key, done: true, status: score ?? "했어요", tone: "done", score } : { key: t.key, done: false, status: "", tone: "todo" };
    }
    if (t.type === "feedback") {
      const p9 = latest.get("p9");
      if (!p9) return { key: t.key, done: false, status: "9쪽을 올리면 와요", tone: "todo" };
      if (p9.status !== "returned") return { key: t.key, done: false, status: "쌤이 첨삭 중", tone: "wait", submissionId: p9.id };
      return p9.seen
        ? { key: t.key, done: true, status: "봤어요", tone: "done", submissionId: p9.id }
        : { key: t.key, done: false, status: "첨삭 도착!", tone: "new", submissionId: p9.id };
    }
    const sub = latest.get(t.key);
    if (!sub) return { key: t.key, done: false, status: "", tone: "todo" };
    if (sub.status !== "returned") return { key: t.key, done: true, status: t.correct ? "쌤이 첨삭 중" : "쌤 확인 중", tone: "wait", submissionId: sub.id };
    if (sub.decision === "redo") return { key: t.key, done: false, status: "다시 써 와요", tone: "again", submissionId: sub.id };
    return { key: t.key, done: true, status: t.correct ? "첨삭 완료" : "쌤 확인 ✓", tone: "done", submissionId: sub.id };
  });
}
