import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { buildWeeklyItems, weeklyRun } from "@/lib/data";
import { iso, todayKST } from "@/lib/dates";
import { toPublic, type Item } from "@/lib/grading";
import StudentTop from "@/components/StudentTop";
import QuizRunner from "@/components/QuizRunner";
import { finishWeekly } from "@/app/actions/student";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

export default async function Weekly() {
  const me = await requireStudent();
  const run = await weeklyRun(me.id);
  const open = run && run.status === "pending" && iso(todayKST()) >= run.available_from;
  let items: Item[] = [];
  if (run && open) {
    if (run.item_ids?.length) {
      const { data } = await db().from("items").select("*").in("id", run.item_ids);
      const m = new Map(((data as Item[]) ?? []).map((i) => [i.id, i]));
      items = (run.item_ids as string[]).map((id) => m.get(id)).filter(Boolean) as Item[];
    } else {
      items = await buildWeeklyItems(me.id, run.unit_ids ?? []);
      await db().from("weekly_runs").update({ item_ids: items.map((i) => i.id) }).eq("student_id", me.id).eq("week_start", run.week_start);
    }
  }
  return (
    <>
      <StudentTop name={me.name} />
      <main className="wrap col" style={{ maxWidth: 860 }}>
        <div>
          <div className="label">주간 점검 · 이번 주 배운 {(run?.unit_ids ?? []).join(" · ")}</div>
          <h1 className="title">섞어서 {items.length || 10}문제 · 힌트 없이</h1>
        </div>
        {open && items.length ? (
          <QuizRunner items={items.map(toPublic)} finish={finishWeekly.bind(null, run!.week_start as string)} />
        ) : (
          <div className="card col">
            {!run ? "이번 주에 공부한 유닛이 아직 없어요." : run.status !== "pending" ? "이번 주 주간 점검은 끝났어요." : `${String(run.available_from).slice(5).replace("-", "/")} (금)부터 볼 수 있어요.`}
            <Link href="/student" className="btn">홈으로</Link>
          </div>
        )}
      </main>
    </>
  );
}
