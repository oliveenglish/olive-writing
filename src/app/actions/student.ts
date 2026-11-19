"use server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { acceptedAnswers, diffMarks, isAutoGraded, isCorrect, isSureKind, kindOf, toPublic, type Item, type Mark, type PublicItem } from "@/lib/grading";
import { dueReviews, scheduleReviews } from "@/lib/data";
import { createSubmission } from "@/lib/submit";

/**
 * correct: 맞음 · 틀림 · (쌤 채점이면) null
 * sure: 오류 코드가 실제 실수와 거의 맞는 문제 (빈칸 · 고르기 · 고치기) → 말풍선 + 왜 한 줄
 * retry: 문장 쓰기류 첫 오답 → 규칙 설명 + 다른 단어 밑줄 + 다시 풀기 (정답은 숨김)
 */
export type CheckResult = {
  correct: boolean | null;
  answers: string[];
  bubble: string | null;
  why: string | null;
  sure: boolean;
  retry: boolean;
  marks?: Mark[];
  missing?: boolean;
};
export type Resp = { id: string; response: string; reason?: string };
export type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  message: string;
  wrong: { prompt: string; response: string; answer: string; bubble: string | null; why: string | null }[];
  next?: "next" | "retest" | "redo";
  redo?: PublicItem[]; // 확인 테스트를 못 넘었을 때: 틀린 것과 같은 오류의 연습 문제
};

async function getItems(ids: string[]): Promise<Map<string, Item>> {
  const { data } = await db().from("items").select("*").in("id", ids);
  return new Map(((data as Item[]) ?? []).map((i) => [i.id, i]));
}
type CodeText = { bubble: string | null; why: string | null };
async function codeTexts(codes: string[]): Promise<Map<string, CodeText>> {
  if (!codes.length) return new Map();
  const { data } = await db().from("error_codes").select("code,bubble,why").in("code", codes);
  return new Map((data ?? []).map((r) => [r.code as string, { bubble: (r.bubble as string) ?? null, why: (r.why as string) ?? null }]));
}

/**
 * 문제 하나 바로 채점 (유닛 연습 · 복습)
 * attempt 1 = 첫 답 (기록은 이것만) / attempt 2 = 다시 풀기 (기록 안 함)
 */
export async function checkItem(
  itemId: string,
  response: string,
  context: "unit" | "review",
  reason?: string,
  attempt = 1
): Promise<CheckResult> {
  const [me, found] = await Promise.all([requireStudent(), getItems([itemId])]);
  const item = found.get(itemId);
  const empty: CheckResult = { correct: null, answers: [], bubble: null, why: null, sure: true, retry: false };
  if (!item) return empty;
  const correct = isAutoGraded(item) ? isCorrect(item, response) : null;
  const save =
    attempt === 1
      ? db().from("attempts").insert({
      student_id: me.id,
      item_id: item.id,
      unit_id: item.unit_id,
      activity: item.activity,
      context,
      response,
      reason: reason || null,
      correct,
      error_code: correct === false ? item.error_code : null,
    })
      : Promise.resolve(null);
  // 기록 저장과 설명 찾기를 동시에 해서 빨리 돌려줘요
  const [, texts] = await Promise.all([save, correct === false && item.error_code ? codeTexts([item.error_code]) : Promise.resolve(null)]);
  if (correct !== false) return { ...empty, correct, answers: acceptedAnswers(item) };
  const sure = isSureKind(kindOf(item));
  const t = item.error_code ? texts?.get(item.error_code) : undefined;
  const answers = acceptedAnswers(item);
  if (!sure && attempt === 1) {
    // 문장 쓰기류: 이유를 단정하지 않고, 규칙 설명 + 다른 단어 밑줄 → 다시 풀기
    const d = diffMarks(response, answers);
    return { correct, answers: [], bubble: null, why: t?.why ?? null, sure, retry: true, marks: d.marks, missing: d.missing };
  }
  return { correct, answers, bubble: sure ? t?.bubble ?? null : null, why: t?.why ?? null, sure, retry: false };
}

export async function saveStep(unitId: string, step: number) {
  const me = await requireStudent();
  await db()
    .from("unit_progress")
    .upsert({ student_id: me.id, unit_id: unitId, step, updated_at: new Date().toISOString() }, { onConflict: "student_id,unit_id" });
}

/** 여러 문제 한꺼번에 채점하고 기록 */
async function gradeBatch(studentId: string, responses: Resp[], context: string, record = true) {
  const items = await getItems(responses.map((r) => r.id));
  const rows: Record<string, unknown>[] = [];
  const wrong: { item: Item; response: string }[] = [];
  let score = 0;
  let total = 0;
  const writing: { item: Item; response: string }[] = [];
  for (const r of responses) {
    const it = items.get(r.id);
    if (!it) continue;
    if (!isAutoGraded(it)) {
      writing.push({ item: it, response: r.response });
      rows.push({ student_id: studentId, item_id: it.id, unit_id: it.unit_id, activity: it.activity, context, response: r.response, correct: null });
      continue;
    }
    total++;
    const ok = isCorrect(it, r.response);
    if (ok) score++;
    else wrong.push({ item: it, response: r.response });
    rows.push({
      student_id: studentId,
      item_id: it.id,
      unit_id: it.unit_id,
      activity: it.activity,
      context,
      response: r.response,
      reason: r.reason || null,
      correct: ok,
      error_code: ok ? null : it.error_code,
    });
  }
  if (record && rows.length) await db().from("attempts").insert(rows);
  const b = await codeTexts(wrong.map((w) => w.item.error_code).filter(Boolean) as string[]);
  return {
    score,
    total,
    writing,
    wrongCodes: wrong.map((w) => w.item.error_code).filter(Boolean) as string[],
    wrong: wrong.map((w) => ({
      prompt: w.item.prompt,
      response: w.response,
      answer: acceptedAnswers(w.item)[0] ?? "",
      // 빈칸 · 고르기 · 고치기만 말풍선 (나머지는 규칙 설명만)
      bubble: w.item.error_code && isSureKind(kindOf(w.item)) ? b.get(w.item.error_code)?.bubble ?? null : null,
      why: w.item.error_code ? b.get(w.item.error_code)?.why ?? null : null,
    })),
  };
}

/** 확인 테스트 */
export async function submitTest(unitId: string, responses: Resp[]): Promise<QuizResult> {
  const me = await requireStudent();
  const g = await gradeBatch(me.id, responses, "test");
  const { data: unit } = await db().from("units").select("pass_score").eq("id", unitId).single();
  const pass = unit?.pass_score ?? 6;
  const { data: prog } = await db().from("unit_progress").select("*").eq("student_id", me.id).eq("unit_id", unitId).maybeSingle();
  const passed = g.score >= Math.min(pass, g.total);
  const fails = passed ? 0 : (prog?.fails_in_row ?? 0) + 1;
  // 못 넘으면: 처음부터 다시가 아니라, 틀린 것과 같은 오류 코드의 연습 문제 몇 개 → 확인 테스트만 다시
  let redo: PublicItem[] = [];
  if (!passed && g.wrongCodes.length) {
    const { data: similar } = await db()
      .from("items")
      .select("*")
      .eq("unit_id", unitId)
      .in("activity", ["choose", "arrange", "find", "ko2en"])
      .in("error_code", Array.from(new Set(g.wrongCodes)));
    redo = ((similar as Item[]) ?? [])
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(6, Math.max(3, g.wrongCodes.length * 2)))
      .map(toPublic);
  }
  const next: QuizResult["next"] = passed ? "next" : redo.length ? "redo" : "retest";
  await db()
    .from("unit_progress")
    .upsert(
      {
        student_id: me.id,
        unit_id: unitId,
        step: passed ? 7 : 6,
        test_score: g.score,
        test_tries: (prog?.test_tries ?? 0) + 1,
        fails_in_row: fails,
        passed: passed || prog?.passed || false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,unit_id" }
    );
  await scheduleReviews(me.id, g.wrongCodes);
  revalidatePath("/student");
  return {
    score: g.score,
    total: g.total,
    passed,
    next,
    redo,
    wrong: g.wrong,
    message: passed
      ? "통과! 다음 유닛이 열렸어요."
      : next === "redo"
      ? `아깝다! 비슷한 문제 ${redo.length}개만 더 풀고 확인 테스트를 다시 봐요.`
      : "아깝다! 아래 '왜?'를 읽고 확인 테스트를 다시 봐요.",
  };
}

/** 질문에 대답하기 (쌤 첨삭) */
export async function submitAnswers(unitId: string, fd: FormData) {
  const me = await requireStudent();
  const ids = fd.getAll("id").map(String);
  const answers = fd.getAll("answer").map(String);
  const items = await getItems(ids);
  const lines: string[] = [];
  const rows = ids.map((id, i) => {
    const it = items.get(id);
    lines.push(`Q${i + 1}. ${it?.prompt ?? ""}\nA. ${answers[i] ?? ""}`);
    return { student_id: me.id, item_id: id, unit_id: unitId, activity: "answer", context: "unit", response: answers[i] ?? "", correct: null };
  });
  if (rows.length) await db().from("attempts").insert(rows);
  const photo = fd.get("photo");
  const { data: unit } = await db().from("units").select("title").eq("id", unitId).single();
  await createSubmission({
    student: me,
    kind: "unit_answer",
    ref: unitId,
    title: `${unitId} ${unit?.title ?? ""} · 질문에 대답하기`,
    text: lines.join("\n\n"),
    photo: photo instanceof File ? photo : null,
    rubric: { memo: ids.map((id, i) => (items.get(id)?.memo ? `Q${i + 1}. ${items.get(id)?.memo}` : "")).filter(Boolean).join(" / ") || null, answers: ids.map((id) => items.get(id)?.answer ?? "") },
  });
  await saveStep(unitId, 6);
}

/** 오늘의 복습 끝 */
export async function finishReview(responses: Resp[]): Promise<QuizResult> {
  const me = await requireStudent();
  const g = await gradeBatch(me.id, responses, "review", false); // 한 문제씩 이미 기록함
  const due = await dueReviews(me.id);
  if (due.length) await db().from("reviews").update({ done: true }).in("id", due.map((d) => d.id));
  revalidatePath("/student");
  return { score: g.score, total: g.total, passed: true, wrong: g.wrong, message: "오늘 복습 끝! 틀린 건 며칠 뒤에 다시 나와요." };
}

/** 주간 점검 */
export async function finishWeekly(weekStart: string, responses: Resp[]): Promise<QuizResult> {
  const me = await requireStudent();
  const g = await gradeBatch(me.id, responses, "weekly");
  for (const w of g.writing) {
    await createSubmission({
      student: me,
      kind: "weekly",
      ref: weekStart,
      title: `주간 점검 (${weekStart} 주) · 질문에 대답하기`,
      text: `Q. ${w.item.prompt}\nA. ${w.response}`,
      photo: null,
    });
  }
  await db().from("weekly_runs").update({ status: "done", score: g.score, total: g.total }).eq("student_id", me.id).eq("week_start", weekStart);
  // 쌤 기준: 10문제 중 3개까지 틀리면 인정 (7 · 8 · 9 · 10개 맞음) / 4개 이상 틀리면 (6개 이하) 복습
  const wrongCount = g.total - g.score;
  const passed = wrongCount <= 3;
  if (!passed) await scheduleReviews(me.id, g.wrongCodes);
  revalidatePath("/student");
  return {
    score: g.score,
    total: g.total,
    passed,
    wrong: g.wrong,
    message: passed
      ? "주간 점검 통과! 이번 주도 잘했어요."
      : "틀린 문제가 4개 이상이라 복습이 생겼어요. 틀린 규칙을 다시 연습해요.",
  };
}

/** 추가 과제 */
export async function finishTask(taskId: string, responses: Resp[], fd?: FormData): Promise<QuizResult> {
  const me = await requireStudent();
  const g = await gradeBatch(me.id, responses, "task");
  const { data: task } = await db().from("tasks").select("*").eq("id", taskId).single();
  const writing = fd ? String(fd.get("writing") || "").trim() : "";
  const photo = fd?.get("photo");
  if (task?.writing_prompt && (writing || (photo instanceof File && photo.size))) {
    await createSubmission({
      student: me,
      kind: "task",
      ref: taskId,
      title: `쌤 과제 · ${task.writing_prompt}`,
      text: writing || null,
      photo: photo instanceof File ? photo : null,
    });
  }
  await db()
    .from("task_assignees")
    .update({ status: "done", score: g.score, completed_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("student_id", me.id);
  await scheduleReviews(me.id, g.wrongCodes);
  revalidatePath("/student");
  return { score: g.score, total: g.total, passed: true, wrong: g.wrong, message: "과제 끝! 쌤에게 전달됐어요." };
}

/** 최종 점검 파트 1 (문법) */
export async function finishFinalPart1(stage: string, responses: Resp[]): Promise<QuizResult> {
  const me = await requireStudent();
  const g = await gradeBatch(me.id, responses, "final");
  await db().from("final_checks").insert({ student_id: me.id, stage, part1_score: g.score, part1_total: g.total, status: "part1" });
  await scheduleReviews(me.id, g.wrongCodes);
  return { score: g.score, total: g.total, passed: true, wrong: g.wrong, message: "파트 1 끝! 이제 글쓰기를 해요." };
}

/** 최종 점검 파트 2 (글쓰기) */
export async function submitFinalWriting(checkId: string, fd: FormData) {
  const me = await requireStudent();
  const { data: chk } = await db().from("final_checks").select("*").eq("id", checkId).eq("student_id", me.id).single();
  if (!chk) return;
  const topic = String(fd.get("topic") || "");
  const text = String(fd.get("writing") || "").trim();
  const photo = fd.get("photo");
  const subId = await createSubmission({
    student: me,
    kind: "final",
    ref: chk.stage,
    title: `${chk.stage} 최종 점검 · ${topic}`,
    text: text || null,
    photo: photo instanceof File ? photo : null,
    rubric: { part1: `${chk.part1_score} / ${chk.part1_total}` },
  });
  await db().from("final_checks").update({ status: "submitted", submission_id: subId }).eq("id", checkId);
  revalidatePath("/student");
}

export async function markSeen(submissionId: string) {
  const me = await requireStudent();
  await db().from("submissions").update({ seen: true }).eq("id", submissionId).eq("student_id", me.id);
}

/** 고쳐 쓰기 · 다시 내기: 쌤 첨삭을 보고 고친 글 (사진 또는 글) */
export async function submitRewrite(parentId: string, fd: FormData) {
  const me = await requireStudent();
  const { data: p } = await db().from("submissions").select("*").eq("id", parentId).eq("student_id", me.id).maybeSingle();
  if (!p || p.status !== "returned" || !p.rewrite_wanted || p.rewrite_done) return { ok: false, message: "이미 냈거나 고쳐 쓰기 요청이 없어요." };
  const text = String(fd.get("text") || "").trim() || null;
  const photo = fd.get("photo");
  const file = photo instanceof File && photo.size ? photo : null;
  if (!text && !file) return { ok: false, message: "고친 글을 쓰거나 사진을 올려 주세요." };
  await createSubmission({
    student: me,
    kind: p.kind,
    ref: p.ref ?? "",
    title: `고쳐 쓰기 · ${String(p.title ?? "").replace(/^고쳐 쓰기 · /, "")}`,
    text,
    photo: file,
    parentId: p.id,
  });
  await db().from("submissions").update({ rewrite_done: true, seen: true }).eq("id", p.id);
  revalidatePath("/student");
  return { ok: true, message: "고쳐 쓴 글을 쌤에게 보냈어요!" };
}

/** 확인 테스트 2부 · 손으로 쓰기 (사진) — 통과와는 상관없이 쌤이 첨삭 */
export async function submitHand(unitId: string, itemId: string, fd: FormData) {
  const me = await requireStudent();
  const item = (await getItems([itemId])).get(itemId);
  const photo = fd.get("photo");
  const file = photo instanceof File && photo.size ? photo : null;
  const text = String(fd.get("text") || "").trim() || null;
  if (!item || (!file && !text)) return { ok: false, message: "종이에 쓴 글 사진을 올려 주세요." };
  await db().from("attempts").insert({ student_id: me.id, item_id: item.id, unit_id: unitId, activity: "hand", context: "test", response: text ?? "(사진)", correct: null });
  await createSubmission({
    student: me,
    kind: "hand",
    ref: unitId,
    title: `${unitId} 확인 테스트 2부 · 손으로 쓰기`,
    text: text ? `과제: ${item.prompt}\n\n${text}` : `과제: ${item.prompt}`,
    photo: file,
    rubric: { memo: item.memo ?? null, example: item.answer ?? null },
  });
  revalidatePath("/student");
  return { ok: true, message: "쌤에게 보냈어요! 첨삭이 오면 홈에서 볼 수 있어요." };
}
