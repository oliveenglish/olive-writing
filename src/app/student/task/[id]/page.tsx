import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { toPublic, type Item } from "@/lib/grading";
import StudentTop from "@/components/StudentTop";
import TaskRunner from "@/components/TaskRunner";
import { finishTask } from "@/app/actions/student";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

export default async function TaskPage({ params }: { params: { id: string } }) {
  const me = await requireStudent();
  const { data: a } = await db().from("task_assignees").select("*, tasks(*)").eq("task_id", params.id).eq("student_id", me.id).maybeSingle();
  const task = a?.tasks as { title: string; writing_prompt: string | null; message: string | null } | undefined;
  let items: Item[] = [];
  if (a?.item_ids?.length) {
    const { data } = await db().from("items").select("*").in("id", a.item_ids);
    items = (data as Item[]) ?? [];
  }
  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
      <main className="wrap col" style={{ maxWidth: 860 }}>
        <div>
          <div className="label">쌤이 낸 과제</div>
          <h1 className="title">{task?.title ?? "과제"}</h1>
          {task?.message && <div className="card tint" style={{ marginTop: 10 }}>쌤: {task.message}</div>}
        </div>
        {!a || a.status === "done" ? (
          <div className="card col">이미 끝낸 과제예요. <Link href="/student" className="btn">홈으로</Link></div>
        ) : (
          <TaskRunner items={items.map(toPublic)} writingPrompt={task?.writing_prompt ?? null} finish={finishTask.bind(null, params.id)} />
        )}
      </main>
    </>
  );
}
