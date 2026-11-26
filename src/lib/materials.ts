/** 교재 폴더 · 영상 링크 · 내 위치 (서버 전용) */
import { db } from "./supabase";
import { allUnits, getUnit, type Unit } from "./content";

export const MAT_BUCKET = "materials";
export const COMMON = "common";

export type Material = {
  id: string;
  teacher_id: string;
  folder: string;
  title: string;
  file_path: string;
  size: number | null;
  visible: "all" | "teacher" | "some";
  student_ids: string[] | null;
  is_new: boolean | null;
  created_at: string;
};

export const folderName = (f: string) => (f === COMMON ? "공통 자료" : getUnit(f) ? `${f} · ${getUnit(f)!.title}` : f);

/** '새 자료' 표시: 쌤이 켜 두었고 2주 안에 올린 것 */
export const isFresh = (m: Material) => !!m.is_new && Date.now() - new Date(m.created_at).getTime() < 14 * 24 * 3600 * 1000;

export async function materialUrl(m: Material): Promise<string | null> {
  const { data } = await db().storage.from(MAT_BUCKET).createSignedUrl(m.file_path, 60 * 60, { download: m.title });
  return data?.signedUrl ?? null;
}

/** 학생이 볼 수 있는 자료 (그 학생 반 쌤이 올린 것 중 '전체' 또는 이 학생을 고른 것) */
export async function materialsFor(student: { id: string; class_id: string | null }): Promise<Material[]> {
  if (!student.class_id) return [];
  const { data: c } = await db().from("classes").select("teacher_id").eq("id", student.class_id).maybeSingle();
  if (!c) return [];
  const { data, error } = await db().from("materials").select("*").eq("teacher_id", c.teacher_id).neq("visible", "teacher").order("created_at", { ascending: false });
  if (error) return [];
  return ((data as Material[]) ?? []).filter((m) => m.visible === "all" || (m.student_ids ?? []).includes(student.id));
}

/** YouTube · Vimeo 주소 → 화면 안에서 재생하는 주소 (모르는 주소면 null) */
export function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?rel=0`;
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}?rel=0`;
    }
    if (host === "vimeo.com") {
      const m = u.pathname.match(/^\/(\d+)(?:\/([a-z0-9]+))?/);
      if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
    }
    if (host === "player.vimeo.com") return url;
  } catch {
    return null;
  }
  return null;
}

/** 내 위치: 전체 단계 중 몇 번째, 그 단계 유닛 중 몇 번째 */
export function positionOf(unit: Unit) {
  const units = allUnits();
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const stageIdx = stages.indexOf(unit.stage);
  const inStage = units.filter((u) => u.stage === unit.stage);
  const unitIdx = inStage.findIndex((u) => u.id === unit.id);
  return {
    stages: stages.map((s, i) => ({ name: s, count: units.filter((u) => u.stage === s).length, state: i < stageIdx ? "done" : i === stageIdx ? "now" : "left" })),
    stageNo: stageIdx + 1,
    stageTotal: stages.length,
    inStage,
    unitNo: unitIdx + 1,
    unitTotal: inStage.length,
  };
}
