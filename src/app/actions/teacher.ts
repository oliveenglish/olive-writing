"use server";
import { revalidatePath } from "next/cache";
import { requireTeacher, studentEmail, studentPassword } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase";
import { allUnits, pickItemsForCodes, position, recordedWeakCodes, taughtCodes } from "@/lib/data";
import { parseWorkbook, type Parsed } from "@/lib/importer";
import { recordWritingCodes } from "@/lib/submit";
import { aiCorrect } from "@/lib/ai";
import { addDays, iso, todayKST } from "@/lib/dates";
import type { Item } from "@/lib/grading";

/* ───── 반 ───── */
export async function createClass(fd: FormData) {
  const me = await requireTeacher();
  const name = String(fd.get("name") || "").trim() || "새 반";
  const code = "OLIVE-" + Math.floor(1000 + Math.random() * 9000);
  await db().from("classes").insert({ name, code, teacher_id: me.id });
  revalidatePath("/teacher");
}

/* ───── 학생 ───── */
export type MakeStudentState = { error?: string; made?: { name: string; username: string; pin: string } } | undefined;

/** 학생 이름 · 학년 · 별명 고치기 */
export async function updateStudentInfo(studentId: string, fd: FormData) {
  await requireTeacher();
  const name = String(fd.get("name") || "").trim();
  const patch: Record<string, string | null> = { grade: String(fd.get("grade") || "").trim() || null, nickname: String(fd.get("nickname") || "").trim() || null };
  if (name) patch.name = name;
  await db().from("profiles").update(patch).eq("id", studentId);
  revalidatePath(`/teacher/students/${studentId}`);
}

/** 쌤이 학생 아이디 · PIN을 직접 만들어 주기 (반 코드 없이) */
export async function makeStudent(_: MakeStudentState, fd: FormData): Promise<MakeStudentState> {
  const me = await requireTeacher();
  const name = String(fd.get("name") || "").trim();
  const grade = String(fd.get("grade") || "").trim();
  const nickname = String(fd.get("nickname") || "").trim() || null;
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const pin = String(fd.get("pin") || "").trim();
  let classId = String(fd.get("class_id") || "");
  const start = String(fd.get("unit") || "");
  if (!name || !username || !pin) return { error: "이름 · 아이디 · PIN을 채워 주세요." };
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: "아이디는 영어 소문자 · 숫자 3~20자로 만들어요. (예: minji01)" };
  if (!/^\d{4}$/.test(pin)) return { error: "PIN은 숫자 4자리예요." };
  const { data: taken } = await db().from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { error: `'${username}'은(는) 이미 있는 아이디예요. 다른 아이디로 해 주세요.` };
  if (!classId) {
    // 반을 안 고르면 '내 학생' 반에 넣어요 (없으면 만들어요)
    const { data: c } = await db().from("classes").select("id").eq("teacher_id", me.id).order("created_at").limit(1).maybeSingle();
    if (c) classId = c.id;
    else {
      const { data: nc, error } = await db().from("classes").insert({ name: "내 학생", code: "OLIVE-" + Math.floor(1000 + Math.random() * 9000), teacher_id: me.id }).select("id").single();
      if (error || !nc) return { error: "반을 만들지 못했어요: " + (error?.message ?? "") };
      classId = nc.id;
    }
  }
  const { data: created, error } = await db().auth.admin.createUser({ email: studentEmail(username), password: studentPassword(pin), email_confirm: true });
  if (error || !created.user) return { error: "계정을 만들지 못했어요: " + (error?.message ?? "") };
  const { error: e2 } = await db().from("profiles").insert({ id: created.user.id, role: "student", name, grade, nickname, username, class_id: classId });
  if (e2) {
    await db().auth.admin.deleteUser(created.user.id);
    return { error: "학생 정보를 저장하지 못했어요: " + e2.message };
  }
  if (start) {
    const f = new FormData();
    f.set("unit", start);
    await setStartUnit(created.user.id, f);
  }
  revalidatePath("/teacher");
  return { made: { name, username, pin } };
}

export async function setStartUnit(studentId: string, fd: FormData) {
  await requireTeacher();
  const target = String(fd.get("unit") || "");
  const units = await allUnits();
  const t = units.find((u) => u.id === target);
  if (!t) return;
  const { data: prog } = await db().from("unit_progress").select("*").eq("student_id", studentId);
  const pm = new Map((prog ?? []).map((p) => [p.unit_id, p]));
  for (const u of units) {
    const p = pm.get(u.id);
    if (u.ord < t.ord && !p?.passed) {
      await db().from("unit_progress").upsert({ student_id: studentId, unit_id: u.id, passed: true, skipped: true, step: 7 }, { onConflict: "student_id,unit_id" });
    } else if (u.ord >= t.ord && p?.skipped) {
      await db().from("unit_progress").update({ passed: false, skipped: false, step: 0 }).eq("student_id", studentId).eq("unit_id", u.id);
    }
  }
  // 앞 단계의 최종 점검도 건너뛰기 처리
  const stages = Array.from(new Set(units.filter((u) => u.ord < t.ord && u.stage !== t.stage).map((u) => u.stage)));
  for (const st of stages) {
    const { data: fc } = await db().from("final_checks").select("id").eq("student_id", studentId).eq("stage", st).eq("status", "passed").limit(1);
    if (!fc?.length) await db().from("final_checks").insert({ student_id: studentId, stage: st, status: "passed" });
  }
  await db().from("profiles").update({ start_unit: target }).eq("id", studentId);
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function saveMemo(studentId: string, fd: FormData) {
  await requireTeacher();
  await db().from("profiles").update({ memo: String(fd.get("memo") || "") }).eq("id", studentId);
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function resetPin(studentId: string, fd: FormData) {
  await requireTeacher();
  const pin = String(fd.get("pin") || "").trim();
  if (!/^\d{4}$/.test(pin)) return;
  await db().auth.admin.updateUserById(studentId, { password: studentPassword(pin) });
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function weeklyPostpone(studentId: string, weekStart: string) {
  await requireTeacher();
  await db().from("weekly_runs").update({ available_from: iso(addDays(todayKST(), 2)) }).eq("student_id", studentId).eq("week_start", weekStart);
  revalidatePath(`/teacher/students/${studentId}`);
}
export async function weeklySkip(studentId: string, weekStart: string) {
  await requireTeacher();
  await db().from("weekly_runs").update({ status: "skipped" }).eq("student_id", studentId).eq("week_start", weekStart);
  revalidatePath(`/teacher/students/${studentId}`);
}

/* ───── 첨삭 · 채점 ───── */
export async function setAutosend(on: boolean) {
  const me = await requireTeacher();
  await db().from("profiles").update({ ai_autosend: on }).eq("id", me.id);
  revalidatePath("/teacher/grading");
}

export async function rerunAi(submissionId: string) {
  await requireTeacher();
  const { data: s } = await db().from("submissions").select("*").eq("id", submissionId).single();
  if (!s) return;
  const pos = await position(s.student_id);
  const level = pos.type === "unit" ? `${pos.unit.stage} · ${pos.unit.title}` : pos.type === "final" ? pos.stage : "초급";
  let photo = null;
  if (s.photo_path) {
    const { data } = await db().storage.from(BUCKET).download(s.photo_path);
    if (data) photo = { base64: Buffer.from(await data.arrayBuffer()).toString("base64"), mediaType: (data.type || "image/jpeg") as "image/jpeg" };
  }
  const draft = await aiCorrect({ task: s.title, text: s.text_content, photo, codes: await taughtCodes(s.student_id), level });
  if (draft) await db().from("submissions").update({ ai_draft: draft }).eq("id", submissionId);
  revalidatePath(`/teacher/grading/${submissionId}`);
}

export async function returnSubmission(submissionId: string, fd: FormData) {
  await requireTeacher();
  const { data: s } = await db().from("submissions").select("*").eq("id", submissionId).single();
  if (!s) return;
  let markup_path: string | null = s.markup_path;
  const markup = fd.get("markup");
  if (markup instanceof File && markup.size) {
    markup_path = `${s.student_id}/markup-${submissionId}-${Date.now()}.png`;
    await db().storage.from(BUCKET).upload(markup_path, markup, { contentType: "image/png", upsert: true });
  }
  const codes = fd.getAll("codes").map(String).filter(Boolean);
  const rubric: Record<string, unknown> = { ...(s.rubric ?? {}) };
  for (const [k, v] of Array.from(fd.entries())) if (k.startsWith("rubric_")) rubric[k.slice(7)] = Number(v);
  const decision = String(fd.get("decision") || "") || null;
  await db()
    .from("submissions")
    .update({
      status: "returned",
      corrected_text: String(fd.get("corrected") || "") || null,
      teacher_comment: String(fd.get("comment") || "") || null,
      error_codes: codes,
      rubric,
      decision,
      markup_path,
      rewrite_wanted: fd.get("rewrite") === "1",
      seen: false,
      returned_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (s.status !== "returned") await recordWritingCodes(s.student_id, codes, s.ref ?? "");
  if (s.kind === "final" && decision) {
    // 고쳐 쓴 최종 점검이면 원래 제출에 연결된 최종 점검을 바꿔요
    const ids = [submissionId, s.parent_id].filter(Boolean) as string[];
    await db().from("final_checks").update({ status: decision === "pass" ? "passed" : "redo" }).in("submission_id", ids);
  }
  revalidatePath("/teacher/grading");
}

/* ───── 문항 DB ───── */
export type ImportSummary = {
  ok: boolean;
  counts: { units: number; cards: number; words: number; items: number; codes: number; topics: number };
  newItems: number;
  changedItems: number;
  newCodes: string[];
  problems: string[];
};

async function readFile(fd: FormData): Promise<Parsed | null> {
  const f = fd.get("file");
  if (!(f instanceof File)) return null;
  return parseWorkbook(await f.arrayBuffer());
}

export async function previewImport(fd: FormData): Promise<ImportSummary | null> {
  await requireTeacher();
  const p = await readFile(fd);
  if (!p) return null;
  const { data: old } = await db().from("items").select("*");
  const om = new Map(((old as Item[]) ?? []).map((i) => [i.id, i]));
  let newItems = 0;
  let changedItems = 0;
  for (const it of p.items) {
    const o = om.get(it.id);
    if (!o) newItems++;
    else if (o.prompt !== it.prompt || o.answer !== it.answer || o.alt_answers !== it.alt_answers || o.error_code !== it.error_code) changedItems++;
  }
  const { data: oc } = await db().from("error_codes").select("code");
  const have = new Set((oc ?? []).map((c) => c.code));
  return {
    ok: p.problems.length === 0,
    counts: { units: p.units.length, cards: p.cards.length, words: p.words.length, items: p.items.length, codes: p.codes.length, topics: p.topics.length },
    newItems,
    changedItems,
    newCodes: p.codes.filter((c) => !have.has(c.code)).map((c) => c.code),
    problems: p.problems,
  };
}

export async function applyImport(fd: FormData): Promise<{ ok: boolean; message: string }> {
  await requireTeacher();
  const p = await readFile(fd);
  if (!p) return { ok: false, message: "파일을 읽지 못했어요." };
  if (p.problems.length) return { ok: false, message: "확인 필요 항목을 먼저 고쳐 주세요." };
  const d = db();
  const steps: [string, () => PromiseLike<{ error: { message: string } | null }>][] = [
    ["유닛", () => d.from("units").upsert(uniq(p.units, (r) => r.id))],
    ["오류 코드", () => d.from("error_codes").upsert(uniq(p.codes, (r) => r.code))],
    ["설명 카드", () => d.from("unit_cards").upsert(uniq(p.cards, (r) => `${r.unit_id}|${r.ord}`))],
    ["단어", () => d.from("words").upsert(uniq(p.words, (r) => `${r.unit_id}|${r.word}`))],
    ["문항", () => d.from("items").upsert(uniq(p.items, (r) => r.id))],
    ["점검 소재", () => d.from("stage_topics").upsert(uniq(p.topics, (r) => `${r.stage}|${r.no}`))],
  ];
  for (const [name, run] of steps) {
    const { error } = await run();
    if (error) return { ok: false, message: `${name} 저장 중 문제: ${error.message}` };
  }
  // 엑셀에서 지운 카드 · 문항은 사이트에서도 지우기 (학습 기록은 그대로)
  const unitIds = p.units.map((u) => u.id);
  const { data: curItems } = await d.from("items").select("id").in("unit_id", unitIds);
  const keep = new Set(p.items.map((i) => i.id));
  const gone = (curItems ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (gone.length) await d.from("items").delete().in("id", gone);
  revalidatePath("/teacher/db");
  return { ok: true, message: `반영했어요. 문항 ${p.items.length}개 · 유닛 ${p.units.length}개` };
}

/* ───── 추가 과제 ───── */
export async function createTask(fd: FormData) {
  const me = await requireTeacher();
  const students = fd.getAll("students").map(String);
  if (!students.length) return;
  const mode = String(fd.get("mode") || "units");
  const unitIds = fd.getAll("units").map(String);
  const count = Number(fd.get("count") || 10);
  const writing = String(fd.get("writing") || "").trim() || null;
  const title =
    String(fd.get("title") || "").trim() ||
    (mode === "weakness" ? `헷갈리는 것 모아 풀기 · ${count}문제` : mode === "writing" ? "글쓰기 과제" : `${unitIds.join(" · ")} 다시 풀기 · ${count}문제`);
  const { data: task } = await db()
    .from("tasks")
    .insert({
      teacher_id: me.id,
      title,
      mode,
      unit_ids: unitIds,
      count,
      writing_prompt: writing,
      message: String(fd.get("message") || "") || null,
      due_date: String(fd.get("due") || "") || null,
    })
    .select("id")
    .single();
  if (!task) return;
  let unitItems: Item[] = [];
  if (mode === "units" && unitIds.length) {
    const { data } = await db().from("items").select("*").in("unit_id", unitIds).neq("activity", "answer");
    unitItems = (data as Item[]) ?? [];
  }
  for (const sid of students) {
    let items: Item[] = [];
    if (mode === "weakness") items = await pickItemsForCodes(sid, await recordedWeakCodes(sid), count);
    else if (mode === "units") {
      const pref = (i: Item) => (i.purpose === "복습" ? 0 : i.purpose === "점검" ? 1 : 2) + Math.random();
      items = [...unitItems].sort((a, b) => pref(a) - pref(b)).slice(0, count);
    }
    await db().from("task_assignees").insert({ task_id: task.id, student_id: sid, item_ids: items.map((i) => i.id) });
  }
  revalidatePath("/teacher/tasks");
}

/* ───── 학부모 리포트 ───── */
export async function saveReport(studentId: string, month: string, fd: FormData) {
  await requireTeacher();
  await db().from("reports").upsert({ student_id: studentId, month, comment: String(fd.get("comment") || "") }, { onConflict: "student_id,month" });
  revalidatePath(`/teacher/report/${studentId}`);
}
export async function markReportSent(studentId: string, month: string) {
  await requireTeacher();
  await db().from("reports").update({ sent_at: new Date().toISOString() }).eq("student_id", studentId).eq("month", month);
  revalidatePath(`/teacher/report/${studentId}`);
}



/** 엑셀에 같은 줄(같은 키)이 두 번 있으면 첫 줄만 남겨요 — 저장할 때 충돌 방지 */
function uniq<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; });
}
