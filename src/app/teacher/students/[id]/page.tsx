import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher, type Profile } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { stepStates, unitOf } from "@/lib/progress";
import { historyOf } from "@/lib/history";
import HistoryList from "@/components/HistoryList";
import { allUnits } from "@/lib/content";
import { GROUPS, STEPS, dayOf, groupOf } from "@/lib/steps";
import { kst } from "@/lib/dates";
import { resetPin, saveStudent } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";

export default async function StudentDetail({ params }: { params: { id: string } }) {
  await requireTeacher();
  const { data } = await db().from("profiles").select("*").eq("id", params.id).maybeSingle();
  const s = data as Profile | null;
  if (!s || s.role !== "student") notFound();
  const unit = unitOf(s);
  const [states, hist] = await Promise.all([stepStates(s.id, unit.id), historyOf(s.id, unit.id)]);
  const units = allUnits();
  const group = groupOf(s.class_days);
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  return (
    <>
      <div>
        <Link href="/teacher" className="small" style={{ fontWeight: 700 }}>← 이번 주 진행</Link>
        <h1 className="title">{s.name} <span className="small muted">아이디 {s.username} · 시작 {kst(s.created_at).slice(0, 10)}</span> <a href="#history" className="btn ghost sm" style={{ marginLeft: 8, verticalAlign: "middle" }}>학습 기록 보기 ↓</a></h1>
      </div>
      <div className="side2" style={{ alignItems: "start" }}>
        <div className="card col">
          <h2 style={{ fontSize: 17 }}>{unit.id} · {unit.title} <span className="small muted">{unit.topic}</span></h2>
          <table className="t" style={{ minWidth: 0 }}>
            <tbody>
              {STEPS.map((st) => {
                const x = states[st.n - 1];
                return (
                  <tr key={st.n}>
                    <td style={{ width: 36 }}><b>{dayOf(st.n, group)}</b></td>
                    <td>{["", "①", "②", "③", "④", "⑤", "⑥", "⑦"][st.n]} {st.title}</td>
                    <td className="small">{x.status === "done" ? <span className="ok">✓ {x.note}</span> : x.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="col">
          <form action={saveStudent.bind(null, s.id)} className="card col">
            <h2 style={{ fontSize: 17 }}>학생 정보</h2>
            <label className="field"><span>지금 하는 유닛</span>
              <select name="unit" className="select" defaultValue={unit.id}>
                {stages.map((stg) => (
                  <optgroup key={stg} label={stg}>
                    {units.filter((u) => u.stage === stg).map((u) => <option key={u.id} value={u.id}>{u.id} · {u.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--head)" }}>수업 반</span>
              <div className="row" style={{ gap: 6 }}>
                {GROUPS.map((g) => (
                  <label key={g.key} className="chip gray" style={{ cursor: "pointer", gap: 6, padding: "10px 14px", fontSize: 14 }}>
                    <input type="radio" name="group" value={g.key} defaultChecked={group === g.key} required /> {g.label}
                  </label>
                ))}
              </div>
              {!group && <span className="small" style={{ color: "var(--warnink)" }}>수업 반을 골라 주세요. (지금 요일은 두 반 중 어디에도 맞지 않아요)</span>}
            </fieldset>
            <label className="field"><span>이 학생 Zoom 링크 (선택 · 비우면 반 링크)</span><input name="zoom" className="input" style={{ fontSize: 15 }} defaultValue={s.zoom_url ?? ""} placeholder="https://zoom.us/j/..." autoComplete="off" /></label>
            <label className="field"><span>이름</span><input name="name" className="input" defaultValue={s.name} /></label>
            <label className="field"><span>학년</span><input name="grade" className="input" defaultValue={s.grade ?? ""} /></label>
            <label className="field"><span>쌤 메모 (학생에게 안 보여요)</span><textarea name="memo" className="textarea" style={{ fontSize: 15 }} defaultValue={s.memo ?? ""} /></label>
            <button className="btn sm">저장</button>
          </form>
          <form action={resetPin.bind(null, s.id)} className="card col">
            <h2 style={{ fontSize: 17 }}>PIN 다시 정하기</h2>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input name="pin" className="input" inputMode="numeric" maxLength={4} placeholder="새 PIN 4자리" />
              <button className="btn sm">바꾸기</button>
            </div>
          </form>
        </div>
      </div>
      <section id="history" className="col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>학습 기록 <span className="small muted">끝낸 유닛 {hist.filter((h) => h.state === "done").length}개 · 유닛을 누르면 펼쳐져요</span></h2>
        <HistoryList list={hist} />
      </section>
    </>
  );
}
