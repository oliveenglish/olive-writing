/** 학생 진행 상황 (서버 전용) */
import { db, BUCKET } from "./supabase";
import { firstUnit, getUnit, setCount, type Unit } from "./content";
import { SENT_ACTS, VIDEO_KEY, WORD_ACTS, sentKey, wordKey, type StepState } from "./steps";

export type Proof = {
  id: string;
  student_id: string;
  unit_id: string;
  step: number;
  photo_path: string;
  status: "submitted" | "returned";
  decision: string | null;
  markup_path: string | null;
  comment: string | null;
  seen: boolean;
  created_at: string;
  returned_at: string | null;
};

export type Guide = {
  unit_id: string;
  video_url: string | null;
  video_title: string | null;
  video_note: string | null;
  homework: string | null;
  must_watch: boolean | null;
  updated_at: string | null;
};

/** 유닛 안내 (영상 강의 · 숙제 안내) — 쌤 '영상 강의' 메뉴에서 넣어요. 표가 아직 없으면 null */
export async function guideOf(unitId: string): Promise<Guide | null> {
  const { data, error } = await db().from("unit_guides").select("*").eq("unit_id", unitId).maybeSingle();
  if (error) return null;
  return (data as Guide) ?? null;
}

/** 학생이 지금 하는 유닛 (쌤이 안 정했으면 첫 유닛) */
export function unitOf(p: { current_unit: string | null }): Unit {
  return getUnit(p.current_unit) ?? firstUnit();
}

export async function checksOf(studentId: string, unitId: string): Promise<Map<string, { score: number | null; total: number | null }>> {
  const { data } = await db().from("app_checks").select("key,score,total").eq("student_id", studentId).eq("unit_id", unitId);
  return new Map((data ?? []).map((r) => [r.key as string, { score: r.score as number | null, total: r.total as number | null }]));
}

/** 단계별 가장 최근 인증 */
export async function latestProofs(studentId: string, unitId: string): Promise<Map<number, Proof>> {
  const { data } = await db().from("proofs").select("*").eq("student_id", studentId).eq("unit_id", unitId).order("created_at", { ascending: false });
  const m = new Map<number, Proof>();
  for (const p of (data as Proof[]) ?? []) if (!m.has(p.step)) m.set(p.step, p);
  return m;
}

/** 7단계 상태 */
export async function stepStates(studentId: string, unitId: string): Promise<StepState[]> {
  const [checks, proofs, guide] = await Promise.all([checksOf(studentId, unitId), latestProofs(studentId, unitId), guideOf(unitId)]);
  const sets = setCount(unitId);
  const count = (keys: string[]) => keys.filter((k) => checks.has(k)).length;
  const wordKeys = Array.from({ length: sets }, (_, i) => WORD_ACTS.map((a) => wordKey(i + 1, a.key))).flat();
  const sentKeys = Array.from({ length: sets }, (_, i) => SENT_ACTS.map((a) => sentKey(i + 1, a.key))).flat();
  const setsDone = (prefix: "w" | "s", acts: readonly { key: string }[]) =>
    Array.from({ length: sets }, (_, i) => acts.every((a) => checks.has(`${prefix}${i + 1}-${a.key}`))).filter(Boolean).length;

  const app = (n: number, keys: string[], prefix: "w" | "s", acts: readonly { key: string }[]): StepState => {
    const c = count(keys);
    if (c === keys.length) return { n, status: "done", note: `Set ${sets}개 모두 끝` };
    if (c > 0) return { n, status: "doing", note: `Set ${setsDone(prefix, acts)} / ${sets} 끝` };
    return { n, status: "todo", note: "" };
  };
  const proof = (n: number): StepState => {
    const p = proofs.get(n);
    if (!p) return { n, status: "todo", note: "" };
    if (p.status === "submitted") return { n, status: "wait", note: n === 5 ? "쌤이 첨삭 중" : "쌤 확인 중" };
    const fresh = !p.seen;
    if (p.decision === "redo") return { n, status: "again", note: "다시 써서 올려요", fresh };
    return { n, status: "done", note: n === 5 ? "첨삭 완료" : "쌤 확인 ✓", fresh };
  };

  // ③ 영상 강의: 다 봤어요 (예전 수업 참석 체크 class1도 인정) · 영상이 없으면 건너뛰어요
  const hasVideo = !!guide?.video_url;
  const step3: StepState =
    checks.has(VIDEO_KEY) || checks.has("class1")
      ? { n: 3, status: "done", note: "다 봤어요" }
      : hasVideo
        ? { n: 3, status: "todo", note: guide?.video_title || "" }
        : { n: 3, status: "done", note: "이번 유닛은 영상이 없어요" };

  // ④ 문장 연습: 영상을 꼭 봐야 하는 유닛이면 영상 뒤에 열려요
  let step4 = app(4, sentKeys, "s", SENT_ACTS);
  if (hasVideo && guide?.must_watch !== false && step3.status !== "done" && step4.status === "todo")
    step4 = { n: 4, status: "locked", note: "영상 강의를 먼저 봐요" };

  // ⑥ 쌤 첨삭 확인: ⑤ 첨삭이 오면 열리고, 첨삭을 열어 보면 끝
  const p5 = proofs.get(5);
  let step6: StepState;
  if (!p5) step6 = { n: 6, status: "locked", note: "⑤ 숙제를 올리면 쌤이 첨삭해요" };
  else if (p5.status === "submitted") step6 = { n: 6, status: "locked", note: "쌤이 첨삭 중이에요" };
  else if (!p5.seen) step6 = { n: 6, status: "new", note: "첨삭 도착! 열어서 확인해요", fresh: true };
  else step6 = { n: 6, status: "done", note: "확인했어요" };

  // ⑦ 다시 쓰기: 첨삭을 확인한 뒤에 열려요
  let step7 = proof(7);
  if (step7.status === "todo" && step6.status !== "done") step7 = { n: 7, status: "locked", note: "첨삭을 확인하면 열려요" };

  return [app(1, wordKeys, "w", WORD_ACTS), proof(2), step3, step4, proof(5), step6, step7];
}

/** 쌤이 확인 · 첨삭했는데 학생이 아직 안 본 것 (지난 유닛 것도 포함) */
export async function unseenFeedback(studentId: string): Promise<Proof[]> {
  const { data } = await db().from("proofs").select("*").eq("student_id", studentId).eq("status", "returned").eq("seen", false).order("returned_at", { ascending: false });
  return (data as Proof[]) ?? [];
}

/** 알림 문구 */
export function feedbackText(p: Proof): { title: string; tone: "ok" | "redo" | "red" } {
  if (p.decision === "redo") return p.markup_path ? { title: "빨간 펜 첨삭 · 다시 써 와요", tone: "red" } : { title: "다시 써 와요", tone: "redo" };
  if (p.decision === "corrected") return { title: "빨간 펜 첨삭이 왔어요", tone: "red" };
  return { title: p.step === 7 ? "잘했어요! 다음 유닛이 열렸어요" : "잘했어요! 쌤이 확인했어요", tone: "ok" };
}

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
