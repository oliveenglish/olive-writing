import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits, position, progressMap, weaknesses, weeklyRun } from "@/lib/data";
import { addDays, monthKey, todayKST, weekStart } from "@/lib/dates";
import { resetPin, saveMemo, setStartUnit, weeklyPostpone, weeklySkip } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";

export default async function StudentDetail({ params }: { params: { id: string } }) {
  await requireTeacher();
  const { data: s } = await db().from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!s) notFound();
  const [units, prog, pos, weak, run] = await Promise.all([allUnits(), progressMap(s.id), position(s.id), weaknesses(s.id), weeklyRun(s.id)]);
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const ws = weekStart(todayKST());
  const since = addDays(ws, -21);
  const { data: att } = await db().from("attempts").select("correct,created_at").eq("student_id", s.id).gte("created_at", since.toISOString());
  const weeks = [3, 2, 1, 0].map((k) => {
    const from = addDays(ws, -7 * k);
    const to = addDays(from, 7);
    const a = (att ?? []).filter((x) => x.correct !== null && new Date(x.created_at) >= from && new Date(x.created_at) < to);
    return { label: k === 0 ? "이번 주" : `${k}주 전`, acc: a.length ? Math.round((a.filter((x) => x.correct).length / a.length) * 100) : null, n: a.length };
  });
  const { data: subs } = await db().from("submissions").select("id,title,status,created_at").eq("student_id", s.id).order("created_at", { ascending: false }).limit(6);
  const { data: tests } = await db().from("unit_progress").select("unit_id,test_score,passed,skipped").eq("student_id", s.id).not("test_score", "is", null);
  const current = pos.type === "unit" ? pos.unit.id : "";

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Link href="/teacher" className="small" style={{ fontWeight: 700 }}>← 반 전체</Link>
          <h1 className="title">{s.name} · {s.grade} <span className="small muted">아이디 {s.username} · 시작 {String(s.created_at).slice(0, 10)}</span></h1>
        </div>
        <div className="row">
          <Link href="/teacher/tasks" className="btn ghost sm">+ 추가 과제 내기</Link>
          <Link href={`/teacher/report/${s.id}?month=${monthKey(todayKST())}`} className="btn sm">학부모 리포트</Link>
        </div>
      </div>
      <div className="side">
        <div className="col">
          <div className="card col">
            <h3 style={{ fontSize: 17 }}>로드맵 진도</h3>
            {stages.map((st) => (
              <div key={st} className="row" style={{ gap: 6 }}>
                <span className="small" style={{ width: 90, fontWeight: 700 }}>{st}</span>
                {units.filter((u) => u.stage === st).map((u) => {
                  const p = prog.get(u.id);
                  const cur = u.id === current;
                  return <span key={u.id} title={u.title} className={`chip ${cur ? "" : p?.passed ? "" : "gray"}`} style={cur ? { background: "var(--navy)", color: "#fff" } : p?.passed ? { background: "var(--done)", color: "#fff" } : {}}>{u.id}{p?.skipped ? " (건너뜀)" : ""}</span>;
                })}
              </div>
            ))}
            <div className="small muted">지금: {pos.type === "unit" ? `${pos.unit.id} ${pos.unit.title} · ${(pos.progress?.step ?? 0) + 1}/7 단계` : pos.type === "final" ? `${pos.stage} 최종 점검` : "—"}</div>
          </div>
          <div className="card col">
            <h3 style={{ fontSize: 17 }}>주별 정답률</h3>
            <div className="row" style={{ alignItems: "flex-end", gap: 24, height: 150 }}>
              {weeks.map((w) => (
                <div key={w.label} className="col" style={{ alignItems: "center", gap: 6 }}>
                  <b className="small">{w.acc === null ? "—" : `${w.acc}%`}</b>
                  <div style={{ width: 48, height: Math.max(4, (w.acc ?? 0) * 1.1), borderRadius: "8px 8px 0 0", background: w.label === "이번 주" ? "var(--navy)" : "var(--done)" }} />
                  <span className="small muted">{w.label}</span>
                </div>
              ))}
              <div className="col small" style={{ marginLeft: 16, gap: 6 }}>
                <b>주간 점검 · {!run ? "이번 주 공부 기록 없음" : run.status === "done" ? `${run.score} / ${run.total}` : run.status === "skipped" ? "건너뜀" : `${String(run.available_from).slice(5).replace("-", "/")} 예정`}</b>
                {run && run.status === "pending" && (
                  <div className="row">
                    <form action={weeklyPostpone.bind(null, s.id, run.week_start)}><button className="btn ghost sm">이틀 미루기</button></form>
                    <form action={weeklySkip.bind(null, s.id, run.week_start)}><button className="btn ghost sm">이번 주 건너뛰기</button></form>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid2">
            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ fontSize: 17 }}>약점 (3번 이상 틀린 것)</h3>
              {weak.map((w) => <div key={w.code} className="row bubble no" style={{ justifyContent: "space-between", padding: "10px 14px" }}><span><b>{w.code}</b> {w.name}</span><b>{w.count}회</b></div>)}
              {!weak.length && <span className="muted small">아직 없어요.</span>}
            </div>
            <div className="card col" style={{ gap: 10 }}>
              <h3 style={{ fontSize: 17 }}>최근 제출 · 확인 테스트</h3>
              {(subs ?? []).map((x) => (
                <div key={x.id} className="row small" style={{ justifyContent: "space-between" }}>
                  <span>{x.title}</span>
                  <Link href={`/teacher/grading/${x.id}`} style={{ fontWeight: 800 }}>{x.status === "submitted" ? "첨삭하기 →" : "보기 →"}</Link>
                </div>
              ))}
              {(tests ?? []).filter((t) => !t.skipped).map((t) => <div key={t.unit_id} className="row small" style={{ justifyContent: "space-between" }}><span>{t.unit_id} 확인 테스트</span><b>{t.test_score} / 8 {t.passed ? "통과" : ""}</b></div>)}
            </div>
          </div>
        </div>
        <aside className="col">
          <div className="card strong col">
            <h3 style={{ fontSize: 17 }}>레벨 조정 · 시작 유닛</h3>
            <form action={setStartUnit.bind(null, s.id)} className="col">
              <select name="unit" className="select" defaultValue={current || s.start_unit || ""}>
                {units.map((u) => <option key={u.id} value={u.id}>{u.stage} · {u.id} {u.title}</option>)}
              </select>
              <div className="small muted">고른 유닛 앞은 모두 “건너뜀(통과)”으로 처리돼요.</div>
              <button className="btn sm">이 유닛부터 시작</button>
            </form>
          </div>
          <div className="card col">
            <h3 style={{ fontSize: 17 }}>쌤 메모 <span className="small muted">(학생에게 안 보여요)</span></h3>
            <form action={saveMemo.bind(null, s.id)} className="col">
              <textarea name="memo" className="textarea" style={{ fontSize: 15 }} defaultValue={s.memo ?? ""} />
              <button className="btn ghost sm">저장</button>
            </form>
          </div>
          <div className="card col">
            <h3 style={{ fontSize: 17 }}>PIN 다시 정하기</h3>
            <form action={resetPin.bind(null, s.id)} className="row" style={{ flexWrap: "nowrap" }}>
              <input name="pin" className="input" inputMode="numeric" maxLength={4} placeholder="새 PIN 4자리" />
              <button className="btn sm">바꾸기</button>
            </form>
            <div className="small muted">학생 아이디: <b>{s.username}</b></div>
          </div>
        </aside>
      </div>
    </>
  );
}
