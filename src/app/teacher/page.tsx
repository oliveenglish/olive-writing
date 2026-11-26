import Link from "next/link";
import { headers } from "next/headers";
import { requireTeacher } from "@/lib/auth";
import { myStudents, pendingCount } from "@/lib/teacher";
import { stepStates, unitOf } from "@/lib/progress";
import { allUnits } from "@/lib/content";
import { CIRCLED, STEPS, type StepState } from "@/lib/steps";
import MakeStudent from "@/components/MakeStudent";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function Cell({ s }: { s: StepState }) {
  if (s.n === 3 && s.status === "done" && s.note.includes("없어요")) return <span className="small muted">영상 없음</span>;
  if (s.status === "done") return <span className="ok">✓</span>;
  if (s.status === "wait") return <span className="chip warn">{s.n === 5 ? "첨삭 대기" : "확인 대기"}</span>;
  if (s.status === "again") return <span className="chip red">다시 써 와요</span>;
  if (s.status === "new") return <span className="chip warn">첨삭 안 봄</span>;
  if (s.status === "locked") return <span className="muted">—</span>;
  if (s.status === "doing") return <span className="small" style={{ fontWeight: 700 }}>{s.note.replace(" 끝", "")}</span>;
  return <span className="muted">—</span>;
}

export default async function Progress() {
  const me = await requireTeacher();
  const { students } = await myStudents(me.id);
  const rows = await Promise.all(
    students.map(async (s) => {
      const unit = unitOf(s);
      return { s, unit, states: await stepStates(s.id, unit.id) };
    })
  );
  const host = headers().get("host");
  const [pending, { data: g }] = await Promise.all([pendingCount(me.id), db().from("unit_guides").select("unit_id,video_url")]);
  const withVideo = new Set(((g as { unit_id: string; video_url: string | null }[]) ?? []).filter((x) => x.video_url).map((x) => x.unit_id));
  const noVideo = Array.from(new Set(rows.map((r) => r.unit.id))).filter((id) => !withVideo.has(id));
  return (
    <>
      <div>
        <div className="label">학생마다 지금 하는 유닛의 7단계</div>
        <h1 className="title">학생 진도 · {students.length}명</h1>
      </div>
      <div className="statgrid">
        <Link href="/teacher/proofs" className="card col stat"><span className="small muted">확인 · 첨삭 대기</span><b style={{ color: pending ? "var(--red)" : undefined }}>{pending}</b></Link>
        <Link href="/teacher/videos" className="card col stat"><span className="small muted">학생이 하는 유닛 중 영상 없는 유닛</span><b>{noVideo.length}</b>{noVideo.length > 0 && <span className="small">{noVideo.slice(0, 4).join(" · ")}</span>}</Link>
        <Link href="/teacher/materials" className="card col stat"><span className="small muted">교재 폴더</span><b style={{ fontSize: 18 }}>워크북 올리기 →</b></Link>
      </div>
      <div className="tablebox">
        <table className="t">
          <thead>
            <tr>
              <th>학생</th>
              <th>유닛</th>
              {STEPS.map((st) => <th key={st.n}>{CIRCLED[st.n]} {st.title.replace("앱 ", "").replace(" 인증", "").replace("워크북 ", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, unit, states }) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/teacher/students/${s.id}`} style={{ fontWeight: 800, textDecoration: "none" }}>{s.name}</Link>
                </td>
                <td>{unit.id}<div className="small muted">{unit.title}</div></td>
                {states.map((x) => <td key={x.n}><Cell s={x} /></td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">아직 학생이 없어요. 아래에서 아이디와 PIN을 만들어 주세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="small muted">⑦ 다시 쓰기를 ✓ 확인하면 그 학생은 다음 유닛으로 넘어가요. 학생 이름을 누르면 유닛 · PIN을 바꿀 수 있어요.</div>
      <MakeStudent units={allUnits().map((u) => ({ id: u.id, title: u.title, stage: u.stage }))} siteUrl={host ? `https://${host}` : undefined} />
    </>
  );
}
