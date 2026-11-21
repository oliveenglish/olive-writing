import { db } from "./supabase";
import { groupOf } from "./steps";

/** 학생 Zoom 링크: 학생 링크가 있으면 그것, 없으면 그 학생 반(화 · 목 / 월 · 수)의 링크 */
export async function zoomFor(p: { class_id: string | null; class_days: number[] | null; zoom_url: string | null }): Promise<string | null> {
  if (p.zoom_url) return p.zoom_url;
  if (!p.class_id) return null;
  const g = groupOf(p.class_days);
  if (!g) return null;
  const { data } = await db().from("classes").select("zoom_tt,zoom_mw").eq("id", p.class_id).maybeSingle();
  return (g === "tt" ? data?.zoom_tt : data?.zoom_mw) ?? null;
}

/** https:// 로 시작하는 주소만 (빈칸이면 지우기) */
export function cleanUrl(v: FormDataEntryValue | null): string | null | false {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^https:\/\/\S+$/.test(s) ? s : false;
}
