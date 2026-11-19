import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { myStudents } from "@/lib/teacher";
import { aiEnabled } from "@/lib/ai";
import { setAutosend } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { unit_answer: "유닛 대답", weekly: "주간 점검", final: "최종 점검", task: "쌤 과제", hand: "손글씨 2부" };

export default async function Grading({ searchParams }: { searchParams: { done?: string } }) {
  const me = await requireTeacher();
  const { students } = await myStudents(me.id);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const done = searchParams.done === "1";
  const { data: subs } = students.length
    ? await db().from("submissions").select("id,student_id,kind,title,created_at,ai_draft,photo_path,returned_at,parent_id").in("student_id", students.map((s) => s.id)).eq("status", done ? "returned" : "submitted").order("created_at", { ascending: !done }).limit(100)
    : { data: [] };
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 className="title">첨삭 · 채점</h1>
        <div className="tabs">
          <Link href="/teacher/grading" className={done ? "" : "on"}>대기</Link>
          <Link href="/teacher/grading?done=1" className={done ? "on" : ""}>돌려준 것</Link>
        </div>
      </div>
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>AI 첨삭 초안</b>{" "}
          <span className="small muted">
            {aiEnabled() ? "학생이 제출하면 AI가 먼저 초안을 만들어요. 쌤이 확인하고 고쳐서 보내요." : "꺼져 있어요. (ANTHROPIC_API_KEY 설정 필요)"}
          </span>
        </div>
      </div>
      <div className="tablebox">
        <table className="t">
          <thead><tr><th>학생</th><th>종류</th><th>제목</th><th>제출</th><th></th></tr></thead>
          <tbody>
            {(subs ?? []).map((s) => (
              <tr key={s.id}>
                <td><b>{names.get(s.student_id)}</b></td>
                <td><span className={`chip ${s.kind === "final" ? "gold" : ""}`}>{KIND[s.kind] ?? s.kind}</span> {s.parent_id && <span className="chip red">고쳐 쓰기</span>} {s.photo_path && <span className="chip gray">사진</span>} {s.ai_draft && <span className="chip gray">AI 초안</span>}</td>
                <td>{s.title}</td>
                <td className="small">{String(done ? s.returned_at : s.created_at).slice(5, 16).replace("T", " ")}</td>
                <td><Link href={`/teacher/grading/${s.id}`} className="btn sm">{done ? "보기" : "첨삭하기"}</Link></td>
              </tr>
            ))}
            {!subs?.length && <tr><td colSpan={5} className="muted">{done ? "아직 없어요." : "기다리는 첨삭이 없어요. 👏"}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
