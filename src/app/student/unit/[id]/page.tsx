import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { planState, position } from "@/lib/data";
import { toPublic, type Item, type PublicItem } from "@/lib/grading";
import { normDays } from "@/lib/plan";
import { todayKST } from "@/lib/dates";
import StudentTop from "@/components/StudentTop";
import WeekPlan from "@/components/WeekPlan";
import UnitActivity, { type Mode } from "@/components/UnitActivity";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 9쪽 사진 AI 첨삭 초안 기다리는 시간

const MODES: Mode[] = ["vocab", "warmup", "practice", "explain", "test"];

export default async function UnitPage({ params, searchParams }: { params: { id: string }; searchParams: { do?: string } }) {
  const me = await requireStudent();
  const id = decodeURIComponent(params.id);
  const { data: unit } = await db().from("units").select("*").eq("id", id).maybeSingle();
  if (!unit) notFound();
  const { data: prog } = await db().from("unit_progress").select("passed").eq("student_id", me.id).eq("unit_id", id).maybeSingle();
  // 지금 유닛과 이미 통과한 유닛만 들어갈 수 있어요
  const pos = await position(me.id);
  if (!prog?.passed && !(pos.type === "unit" && pos.unit.id === id)) redirect("/student");

  const mode = MODES.find((m) => m === searchParams.do);
  if (mode) {
    const [{ data: words }, { data: cards }, { data: items }, { data: warm }] = await Promise.all([
      db().from("words").select("word,pos,meaning,colloc,example,example_ko,ord").eq("unit_id", id).order("ord"),
      db().from("unit_cards").select("ord,title,body,audio_url,check_q,check_a,check_choices").eq("unit_id", id).order("ord"),
      mode === "practice" || mode === "test" ? db().from("items").select("*").eq("unit_id", id).eq("purpose", "연습").order("no") : Promise.resolve({ data: [] }),
      mode === "warmup" ? db().from("unit_checks").select("score,total").eq("student_id", me.id).eq("unit_id", id).eq("task", "warmup").maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const by: Record<string, PublicItem[]> = {};
    for (const it of (items as Item[]) ?? []) (by[it.activity] ??= []).push(toPublic(it));
    const w = warm as { score: number | null; total: number | null } | null;
    return (
      <UnitActivity
        mode={mode}
        unit={{ id: unit.id, title: unit.title, stage: unit.stage, pass_score: unit.pass_score ?? 6 }}
        words={(words ?? []).map((x) => ({ word: x.word, pos: x.pos, meaning: x.meaning, colloc: x.colloc, example: x.example, example_ko: x.example_ko }))}
        cards={cards ?? []}
        items={by}
        last={w?.total ? `${w.score} / ${w.total}` : null}
      />
    );
  }

  const states = await planState(me.id, id);
  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
      <main className="wrap col" style={{ maxWidth: 900 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Link href="/student" className="small" style={{ fontWeight: 700 }}>← 홈</Link>
            <div className="label">{unit.stage} · {unit.id}</div>
            <h1 className="title">{unit.title} · 이번 주 할 일</h1>
          </div>
          <Link href={`/student/unit/${encodeURIComponent(id)}?do=explain`} className="btn ghost sm">📱 3쪽 문장 규칙 설명 다시 보기</Link>
        </div>
        <div className="card tint small">워크시트 첫 장과 같아요. 순서대로 안 해도 돼요. 📱 앱 활동과 📷 사진은 하면 저절로 체크되고, 👩‍🏫 수업은 직접 체크해요.</div>
        <WeekPlan unitId={id} states={states} days={normDays(me.class_days)} today={todayKST().getUTCDay()} />
      </main>
    </>
  );
}
