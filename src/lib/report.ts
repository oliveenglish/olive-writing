import { db } from "./supabase";
import { position } from "./data";

/** 한 달 리포트 숫자 · 글 비교 (기록에서 자동) */
export async function buildReport(studentId: string, month: string) {
  const start = new Date(`${month}-01T00:00:00+09:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const [{ data: s }, { data: att }, { data: subs }, { data: passed }, pos] = await Promise.all([
    db().from("profiles").select("name,grade").eq("id", studentId).single(),
    db().from("attempts").select("correct,error_code,activity,created_at").eq("student_id", studentId).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    db().from("submissions").select("title,text_content,corrected_text,created_at,status").eq("student_id", studentId).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at"),
    db().from("unit_progress").select("unit_id,updated_at").eq("student_id", studentId).eq("passed", true).eq("skipped", false).gte("updated_at", start.toISOString()).lt("updated_at", end.toISOString()),
    position(studentId),
  ]);
  const a = att ?? [];
  const acc = (list: typeof a) => {
    const g = list.filter((x) => x.correct !== null);
    return g.length ? Math.round((g.filter((x) => x.correct).length / g.length) * 100) : null;
  };
  const first = a.filter((x) => new Date(x.created_at) < mid);
  const second = a.filter((x) => new Date(x.created_at) >= mid);
  const codeCount = (list: typeof a) => {
    const m = new Map<string, number>();
    list.filter((x) => x.correct === false && x.error_code).forEach((x) => m.set(x.error_code!, (m.get(x.error_code!) ?? 0) + 1));
    return m;
  };
  const c1 = codeCount(first);
  const c2 = codeCount(second);
  const allCodes = Array.from(new Set([...Array.from(c1.keys()), ...Array.from(c2.keys())]));
  const { data: names } = allCodes.length ? await db().from("error_codes").select("code,name").in("code", allCodes) : { data: [] };
  const nm = new Map((names ?? []).map((r) => [r.code, r.name as string]));
  const improved = allCodes
    .map((c) => ({ name: nm.get(c) ?? c, before: c1.get(c) ?? 0, after: c2.get(c) ?? 0 }))
    .filter((x) => x.before >= 2 && x.after < x.before)
    .sort((x, y) => y.before - y.after - (x.before - x.after))
    .slice(0, 3);
  const focus = Array.from(c2.entries()).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([c]) => nm.get(c) ?? c);
  const writing = (subs ?? []).filter((x) => x.text_content);
  return {
    name: s?.name ?? "",
    grade: s?.grade ?? "",
    where: pos.type === "unit" ? `${pos.unit.id} ${pos.unit.title}` : "—",
    unitsDone: (passed ?? []).length,
    days: new Set(a.map((x) => String(x.created_at).slice(0, 10))).size,
    accFirst: acc(first),
    accSecond: acc(second),
    sentences: a.filter((x) => ["ko2en", "answer", "find"].includes(x.activity as string)).length,
    improved,
    focus,
    firstWriting: writing[0] ?? null,
    lastWriting: writing.length > 1 ? writing[writing.length - 1] : null,
  };
}
export type ReportData = Awaited<ReturnType<typeof buildReport>>;
