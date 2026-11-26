/** 학생 학습 기록: 유닛별 진행 + 지난 과제 (서버 전용) */
import { db, BUCKET } from "./supabase";
import { getUnit, setCount, type Unit } from "./content";
import { SENT_ACTS, WORD_ACTS } from "./steps";
import type { Proof } from "./progress";

export type HistProof = Proof & { photo: string | null; markup: string | null; attempt: number };
export type UnitHistory = {
  unit: Unit;
  state: "now" | "done" | "left";
  sets: number;
  wordSets: number;
  sentSets: number;
  /** 단어 · 문장 활동 정답률 (점수가 남은 것만) */
  accuracy: number | null;
  class1: string | null;
  class2: string | null;
  video: string | null;
  proofs: HistProof[];
  from: string | null;
  to: string | null;
  finishedAt: string | null;
};

type Check = { unit_id: string; key: string; score: number | null; total: number | null; done_at: string };

export async function historyOf(studentId: string, currentUnit: string): Promise<UnitHistory[]> {
  const [{ data: cData }, { data: pData }] = await Promise.all([
    db().from("app_checks").select("unit_id,key,score,total,done_at").eq("student_id", studentId),
    db().from("proofs").select("*").eq("student_id", studentId).order("created_at", { ascending: true }),
  ]);
  const checks = (cData as Check[]) ?? [];
  const proofs = (pData as Proof[]) ?? [];

  // 사진 주소를 한 번에
  const paths = Array.from(new Set(proofs.flatMap((p) => [p.photo_path, p.markup_path]).filter(Boolean) as string[]));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await db().storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    for (const r of data ?? []) if (r.path && r.signedUrl) urls.set(r.path, r.signedUrl);
  }

  const ids = new Set<string>([currentUnit, ...checks.map((c) => c.unit_id), ...proofs.map((p) => p.unit_id)]);
  const out: UnitHistory[] = [];
  for (const id of Array.from(ids)) {
    const unit = getUnit(id);
    if (!unit) continue;
    const cs = checks.filter((c) => c.unit_id === id);
    const has = new Set(cs.map((c) => c.key));
    const sets = setCount(id);
    const setsDone = (prefix: string, acts: readonly { key: string }[]) =>
      Array.from({ length: sets }, (_, i) => acts.every((a) => has.has(`${prefix}${i + 1}-${a.key}`))).filter(Boolean).length;
    const scored = cs.filter((c) => c.total && c.score != null);
    const sum = scored.reduce((a, c) => [a[0] + (c.score as number), a[1] + (c.total as number)], [0, 0]);
    const counts = new Map<number, number>();
    const ps: HistProof[] = proofs
      .filter((p) => p.unit_id === id)
      .map((p) => {
        const n = (counts.get(p.step) ?? 0) + 1;
        counts.set(p.step, n);
        return { ...p, photo: urls.get(p.photo_path) ?? null, markup: p.markup_path ? urls.get(p.markup_path) ?? null : null, attempt: n };
      });
    const finish = ps.find((p) => p.step === 7 && p.decision === "ok");
    const times = [...cs.map((c) => c.done_at), ...ps.map((p) => p.created_at)].filter(Boolean).sort();
    out.push({
      unit,
      state: id === currentUnit ? "now" : finish ? "done" : "left",
      sets,
      wordSets: setsDone("w", WORD_ACTS),
      sentSets: setsDone("s", SENT_ACTS),
      accuracy: sum[1] ? Math.round((sum[0] / sum[1]) * 100) : null,
      class1: cs.find((c) => c.key === "class1")?.done_at ?? null,
      class2: cs.find((c) => c.key === "class2")?.done_at ?? null,
      video: cs.find((c) => c.key === "video" || c.key === "class1")?.done_at ?? null,
      proofs: ps,
      from: times[0] ?? null,
      to: times[times.length - 1] ?? null,
      finishedAt: finish?.returned_at ?? null,
    });
  }
  // 지금 유닛 먼저, 그다음 최근 유닛부터
  return out.sort((a, b) => (a.state === "now" ? -1 : b.state === "now" ? 1 : b.unit.ord - a.unit.ord));
}
