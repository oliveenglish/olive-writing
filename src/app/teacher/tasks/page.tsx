import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { myStudents } from "@/lib/teacher";
import { allUnits, weaknesses } from "@/lib/data";
import { addDays, iso, todayKST, kst } from "@/lib/dates";
import { createTask } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";

export default async function Tasks() {
  const me = await requireTeacher();
  const { students } = await myStudents(me.id);
  const units = (await allUnits()).filter((u) => u.status === "published");
  const weak = await Promise.all(students.map((s) => weaknesses(s.id)));
  const { data: tasks } = await db().from("tasks").select("*, task_assignees(student_id,status,score)").eq("teacher_id", me.id).order("created_at", { ascending: false }).limit(20);
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const names = new Map(students.map((s) => [s.id, s.name]));
  return (
    <>
      <div>
        <div className="label">주간 점검은 자동 · 그 밖에 더 시키고 싶을 때</div>
        <h1 className="title">추가 과제 내기</h1>
      </div>
      <form action={createTask} className="grid2" style={{ gridTemplateColumns: "300px 1fr 340px" }}>
        <section className="card col" style={{ gap: 8 }}>
          <div className="label">1. 누구에게</div>
          {students.map((s, k) => (
            <label key={s.id} className="row" style={{ gap: 10, flexWrap: "nowrap", padding: "6px 4px" }}>
              <input type="checkbox" name="students" value={s.id} />
              <div><b>{s.name}</b> <span className="small muted">{s.grade}</span>{weak[k][0] && <div className="small" style={{ color: "var(--red2)" }}>약점 · {weak[k][0].name}</div>}</div>
            </label>
          ))}
          {!students.length && <span className="muted small">학생이 없어요.</span>}
        </section>
        <section className="card col">
          <div className="label">2. 무엇을</div>
          <div className="col" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 8 }}><input type="radio" name="mode" value="weakness" defaultChecked /> <b>학생별 약점으로 자동</b> <span className="small muted">학생마다 자주 틀린 오류에 맞는 문제를 골라요</span></label>
            <label className="row" style={{ gap: 8 }}><input type="radio" name="mode" value="units" /> <b>유닛 고르기</b></label>
            <label className="row" style={{ gap: 8 }}><input type="radio" name="mode" value="writing" /> <b>글쓰기만</b></label>
          </div>
          <div className="label">유닛 (유닛 고르기일 때) · 단계를 눌러 펼쳐요</div>
          <div className="col" style={{ gap: 6 }}>
            {stages.map((st) => {
              const list = units.filter((u) => u.stage === st);
              return (
                <details key={st} className="card tint" style={{ padding: "8px 12px" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>{st} <span className="small muted">· 유닛 {list.length}개</span></summary>
                  <div className="col" style={{ gap: 4, marginTop: 8 }}>
                    {list.map((u) => (
                      <label key={u.id} className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
                        <input type="checkbox" name="units" value={u.id} style={{ marginTop: 4 }} />
                        <span><b>{u.title}</b> <span className="small muted">{u.id}{u.scope ? ` · ${u.scope}` : ""}</span></span>
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          <div className="grid2">
            <label className="field"><span>문제 수</span>
              <select name="count" className="select" defaultValue="10"><option>5</option><option>10</option><option>15</option></select>
            </label>
            <label className="field"><span>마감</span><input type="date" name="due" className="input" defaultValue={iso(addDays(todayKST(), 2))} /></label>
          </div>
          <label className="field"><span>글쓰기 한 문제 더하기 (선택 · 비우면 없음)</span><input name="writing" className="input en" placeholder="Answer: Is your friend tall? Why?" /></label>
          <label className="field"><span>과제 이름 (비우면 자동)</span><input name="title" className="input" /></label>
          <label className="field"><span>학생에게 보일 한마디 (선택)</span><input name="message" className="input" placeholder="헷갈리는 것만 모았어! 10분이면 끝나." /></label>
          <button className="btn">과제 내기</button>
        </section>
        <section className="card col" style={{ gap: 10 }}>
          <div className="label">보낸 추가 과제</div>
          {(tasks ?? []).map((t) => {
            const as = (t.task_assignees ?? []) as { student_id: string; status: string; score: number | null }[];
            const done = as.filter((a) => a.status === "done");
            return (
              <div key={t.id} className="card tint" style={{ padding: 12 }}>
                <b>{t.title}</b> <span className="small muted">· {kst(t.created_at).slice(5, 10)}{t.due_date ? ` · 마감 ${String(t.due_date).slice(5)}` : ""}</span>
                <div className="small">{as.length}명 중 {done.length}명 완료</div>
                <div className="small muted">{as.map((a) => `${names.get(a.student_id) ?? ""}${a.status === "done" ? ` ✓${a.score ?? ""}` : ""}`).join(" · ")}</div>
              </div>
            );
          })}
          {!tasks?.length && <span className="muted small">아직 없어요.</span>}
        </section>
      </form>
    </>
  );
}
