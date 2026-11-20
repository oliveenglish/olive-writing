import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { myStudents } from "@/lib/teacher";
import { allUnits, position, weaknesses } from "@/lib/data";
import MakeStudent from "@/components/MakeStudent";
import { headers } from "next/headers";
import { addDays, iso, todayKST, weekStart, kst } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const me = await requireTeacher();
  const { classes, students } = await myStudents(me.id);
  const ids = students.map((s) => s.id);
  const ws = weekStart(todayKST());
  const [att, subs, fails, weekly] = ids.length
    ? await Promise.all([
        db().from("attempts").select("student_id,correct,created_at").in("student_id", ids).gte("created_at", ws.toISOString()),
        db().from("submissions").select("student_id,kind").in("student_id", ids).eq("status", "submitted"),
        db().from("unit_progress").select("student_id,unit_id,fails_in_row").in("student_id", ids).gte("fails_in_row", 2),
        db().from("weekly_runs").select("*").in("student_id", ids).eq("week_start", iso(ws)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const rows = await Promise.all(
    students.map(async (s) => {
      const a = (att.data ?? []).filter((x) => x.student_id === s.id);
      const g = a.filter((x) => x.correct !== null);
      const pos = await position(s.id);
      const weak = await weaknesses(s.id);
      const w = (weekly.data ?? []).find((x) => x.student_id === s.id);
      const days = new Set(a.map((x) => kst(x.created_at).slice(0, 10))).size;
      const fail = (fails.data ?? []).find((x) => x.student_id === s.id);
      const pend = (subs.data ?? []).filter((x) => x.student_id === s.id).length;
      const inactive = !s.last_seen_at || new Date(s.last_seen_at) < addDays(todayKST(), -2);
      return { s, pos, weak, w, days, acc: g.length ? Math.round((g.filter((x) => x.correct).length / g.length) * 100) : null, fail, pend, inactive };
    })
  );
  const pending = (subs.data ?? []).length;
  const finals = (subs.data ?? []).filter((x) => x.kind === "final").length;
  const alerts = rows.filter((r) => r.fail);
  const units = (await allUnits()).map((u) => ({ id: u.id, title: u.title, stage: u.stage }));
  const host = headers().get("host");
  const activeRate = rows.length ? Math.round((rows.filter((r) => r.days > 0).length / rows.length) * 100) : 0;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="label">{iso(ws)} 주</div>
          <h1 className="title">반 전체 현황 · {students.length}명</h1>
        </div>
        <Link href="/teacher/tasks" className="btn ghost sm">+ 추가 과제 내기</Link>
      </div>
      <div className="grid4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Link href="/teacher/grading" className="card" style={{ textDecoration: "none" }}><div className="label">첨삭 대기</div><div className="big">{pending}</div><div className="small muted">최종 점검 {finals}</div></Link>
        <div className={`card ${alerts.length ? "warn" : ""}`}><div className="label">알림 · 2번 연속 미통과</div><div className="big" style={alerts.length ? { color: "var(--red2)" } : {}}>{alerts.length}</div><div className="small">{alerts.map((r) => `${r.s.name} · ${r.fail?.unit_id}`).join(", ")}</div></div>
        <div className="card"><div className="label">이번 주 공부한 학생</div><div className="big">{activeRate}%</div><div className="small muted">2일 이상 안 들어온 학생 {rows.filter((r) => r.inactive).length}명</div></div>
      </div>
      <div className="tablebox">
        <table className="t">
          <thead><tr><th>학생</th><th>현재 위치</th><th>이번 주 공부한 날</th><th>정답률</th><th>자주 틀리는 것</th><th>주간 점검</th><th>상태</th></tr></thead>
          <tbody>
            {rows.map(({ s, pos, weak, w, days, acc, fail, pend, inactive }) => (
              <tr key={s.id}>
                <td><Link href={`/teacher/students/${s.id}`} style={{ fontWeight: 800, textDecoration: "none" }}>{s.name}</Link> <span className="small muted">{s.grade}</span></td>
                <td>{pos.type === "unit" ? `${pos.unit.id} ${pos.unit.title}` : pos.type === "final" ? `${pos.stage} · 최종 점검` : pos.type === "waiting" ? "다음 유닛 준비 중" : "완료"}</td>
                <td>{days}일</td>
                <td><b style={acc !== null && acc < 65 ? { color: "var(--red2)" } : {}}>{acc === null ? "—" : `${acc}%`}</b></td>
                <td>{weak.slice(0, 2).map((x) => x.name).join(" · ") || "—"}</td>
                <td>{!w ? "—" : w.status === "done" ? `${w.score} / ${w.total}` : w.status === "skipped" ? "건너뜀" : `${String(w.available_from).slice(5).replace("-", "/")} 예정`}</td>
                <td className="row" style={{ gap: 6 }}>
                  {fail && <span className="chip red">2번 미통과</span>}
                  {pend > 0 && <span className="chip">첨삭 대기 {pend}</span>}
                  {inactive && <span className="chip red">미접속</span>}
                  {!fail && !pend && !inactive && <span className="chip">순조로움</span>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">아직 학생이 없어요. 아래 ‘학생 계정 만들기’에서 아이디와 PIN을 만들어 주세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <MakeStudent classes={classes.map((c) => ({ id: c.id, name: c.name }))} units={units} siteUrl={host ? `https://${host}` : undefined} />
    </>
  );
}
