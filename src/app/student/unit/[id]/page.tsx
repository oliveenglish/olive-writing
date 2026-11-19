import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { position } from "@/lib/data";
import { toPublic, type Item, type PublicItem } from "@/lib/grading";
import UnitPlayer from "@/components/UnitPlayer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

export default async function UnitPage({ params }: { params: { id: string } }) {
  const me = await requireStudent();
  const id = decodeURIComponent(params.id);
  const { data: unit } = await db().from("units").select("*").eq("id", id).maybeSingle();
  if (!unit) notFound();
  const { data: prog } = await db().from("unit_progress").select("*").eq("student_id", me.id).eq("unit_id", id).maybeSingle();
  // 잠긴 유닛은 못 들어가요 (이미 통과한 유닛은 다시 볼 수 있어요)
  const pos = await position(me.id);
  if (!prog?.passed && !(pos.type === "unit" && pos.unit.id === id)) redirect("/student");

  const [{ data: words }, { data: cards }, { data: items }] = await Promise.all([
    db().from("words").select("grp,word,meaning").eq("unit_id", id),
    db().from("unit_cards").select("ord,title,body,audio_url,check_q,check_a,check_choices").eq("unit_id", id).order("ord"),
    db().from("items").select("*").eq("unit_id", id).eq("purpose", "연습").order("no"),
  ]);
  const { data: handSubs } = await db().from("submissions").select("id").eq("student_id", me.id).eq("kind", "hand").eq("ref", id).limit(1);
  const by: Record<string, PublicItem[]> = {};
  for (const it of (items as Item[]) ?? []) (by[it.activity] ??= []).push(toPublic(it));

  return (
    <UnitPlayer
      unit={{ id: unit.id, title: unit.title, stage: unit.stage, pass_score: unit.pass_score ?? 6 }}
      words={words ?? []}
      cards={cards ?? []}
      items={by}
      startStep={prog?.passed ? 0 : prog?.step ?? 0}
      passed={!!prog?.passed}
      handSent={!!handSubs?.length}
    />
  );
}
