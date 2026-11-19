import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits, position } from "@/lib/data";
import { toPublic, type Item } from "@/lib/grading";
import StudentTop from "@/components/StudentTop";
import QuizRunner from "@/components/QuizRunner";
import FinalWriting from "@/components/FinalWriting";
import { finishFinalPart1 } from "@/app/actions/student";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

const CHECKLIST = ["주제에 맞게 첫 문장을 썼나요?", "이유나 예시를 2개 이상 썼나요?", "이번 단계에서 배운 표현을 썼나요?", "대문자 · 마침표를 확인했나요?"];

export default async function Final() {
  const me = await requireStudent();
  const pos = await position(me.id);
  if (pos.type !== "final" || pos.submitted)
    return (
      <>
        <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
        <main className="wrap"><div className="card col">지금은 최종 점검 차례가 아니에요. <Link href="/student" className="btn">홈으로</Link></div></main>
      </>
    );
  const stage = pos.stage;
  const { data: part1 } = await db().from("final_checks").select("*").eq("student_id", me.id).eq("stage", stage).eq("status", "part1").order("created_at", { ascending: false }).limit(1);
  let body: React.ReactNode;
  if (part1?.length) {
    const { data: topics } = await db().from("stage_topics").select("no,topic,format").eq("stage", stage).order("no");
    body = <FinalWriting checkId={part1[0].id as string} topics={topics ?? []} checklist={CHECKLIST} />;
  } else {
    const unitIds = (await allUnits()).filter((u) => u.stage === stage).map((u) => u.id);
    const { data } = await db().from("items").select("*").in("unit_id", unitIds).neq("activity", "answer");
    const all = (data as Item[]) ?? [];
    const check = all.filter((i) => i.purpose === "점검");
    const pool = (check.length >= 10 ? check : [...check, ...all.filter((i) => i.activity === "test")]).sort(() => Math.random() - 0.5).slice(0, 20);
    body = <QuizRunner items={pool.map(toPublic)} finish={finishFinalPart1.bind(null, stage)} doneHref="/student/final" />;
  }
  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
      <main className="wrap col">
        <div>
          <div className="label">{stage} · 최종 점검</div>
          <h1 className="title">{part1?.length ? "파트 2 · 글쓰기" : "파트 1 · 배운 문법 20문제"}</h1>
        </div>
        {body}
      </main>
    </>
  );
}
