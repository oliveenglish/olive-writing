import Link from "next/link";
import { headers } from "next/headers";
import { requireTeacher } from "@/lib/auth";
import { myStudents } from "@/lib/teacher";
import { stepStates, unitOf } from "@/lib/progress";
import { allUnits } from "@/lib/content";
import { STEPS, dayOf, groupLabel, groupOf, type StepState } from "@/lib/steps";
import MakeStudent from "@/components/MakeStudent";

export const dynamic = "force-dynamic";

function Cell({ s }: { s: StepState }) {
  if (s.status === "done") return <span className="ok">✓</span>;
  if (s.status === "wait") return <span className="chip warn">{s.n === 5 ? "첨삭 대기" : "확인 대기"}</span>;
  if (s.status === "again") return <span className="chip red">다시 써 와요</span>;
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
  return (
    <>
      <div>
        <div className="label">학생마다 지금 하는 유닛의 7단계</div>
        <h1 className="title">이번 주 진행 · {students.length}명</h1>
      </div>
      <div className="tablebox">
        <table className="t">
          <thead>
            <tr>
              <th>학생</th>
              <th>유닛</th>
              {STEPS.map((st) => <th key={st.n}>{["", "①", "②", "③", "④", "⑤", "⑥", "⑦"][st.n]} {st.title.replace("앱 ", "").replace(" 인증", "").replace("첨삭 확인 · ", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, unit, states }) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/teacher/students/${s.id}`} style={{ fontWeight: 800, textDecoration: "none" }}>{s.name}</Link>
                  {groupOf(s.class_days) ? (
                    <div className="small muted">{groupLabel(groupOf(s.class_days))}</div>
                  ) : (
                    <div className="small" style={{ color: "var(--warnink)", fontWeight: 700 }}>수업 반을 정해 주세요</div>
                  )}
                </td>
                <td>{unit.id}<div className="small muted">{unit.title}</div></td>
                {states.map((x) => <td key={x.n}><Cell s={x} /><div className="small muted">{dayOf(x.n, groupOf(s.class_days))}</div></td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">아직 학생이 없어요. 아래에서 아이디와 PIN을 만들어 주세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="small muted">⑦ 다시 쓰기를 ✓ 확인하면 그 학생은 다음 유닛으로 넘어가요. 학생 이름을 누르면 유닛 · 수업 요일 · PIN을 바꿀 수 있어요.</div>
      <MakeStudent units={allUnits().map((u) => ({ id: u.id, title: u.title, stage: u.stage }))} siteUrl={host ? `https://${host}` : undefined} />
    </>
  );
}
