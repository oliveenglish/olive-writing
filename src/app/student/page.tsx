import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { feedbackText, stepStates, unitOf, unseenFeedback } from "@/lib/progress";
import { getUnit } from "@/lib/content";
import { STEPS, WEEKDAY, dayOf, groupLabel, groupOf, scheduleOf, type StepState } from "@/lib/steps";
import { todayKST } from "@/lib/dates";
import { logout } from "@/app/actions/auth";
import ClassToggle from "@/components/ClassToggle";
import { ICamera, ICheck, IClass, IEye, IPhone } from "@/components/Icons";
import { zoomFor } from "@/lib/zoom";

export const dynamic = "force-dynamic";

const HREF: Record<number, string> = { 1: "/student/words", 2: "/student/proof/2", 4: "/student/sentences", 5: "/student/proof/5", 7: "/student/proof/7" };

export default async function StudentHome() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const states = await stepStates(me.id, unit.id);
  const st = new Map(states.map((s) => [s.n, s]));
  const done = states.filter((s) => s.status === "done").length;
  const next = states.find((s) => s.status !== "done" && s.status !== "wait" && s.status !== "locked")?.n;
  const today = WEEKDAY[todayKST().getUTCDay()];
  const group = groupOf(me.class_days);
  const classText = group ? groupLabel(group) : null;
  const [zoom, fresh] = await Promise.all([zoomFor(me), unseenFeedback(me.id)]);
  const classToday = !!group && (dayOf(3, group) === today || dayOf(6, group) === today);

  const icon = (n: number) => {
    const t = STEPS[n - 1].type;
    if (n === 7) return <IEye color="var(--olive)" />;
    return t === "app" ? <IPhone color="var(--olive)" /> : t === "proof" ? <ICamera color="var(--olive)" /> : <IClass color="var(--olive)" />;
  };
  const row = (n: number) => {
    const step = STEPS[n - 1];
    const s = st.get(n) as StepState;
    const cls = `step ${s.status === "done" ? "done" : s.status === "again" || s.status === "new" ? "again" : s.status === "locked" ? "locked" : n === next ? "next" : ""}`;
    const inner = (
      <>
        <span className="num">{s.status === "done" ? <ICheck /> : n}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tt">{step.title}{s.fresh && <span className="newdot">NEW</span>}</span>
          <span className="nn">{s.note || (group === "mw" && (n === 1 || n === 2) ? `월요일 수업 전날 · ${step.sub}` : step.sub)}</span>
        </span>
        {step.type === "class" ? (
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            {zoom && <a href={zoom} target="_blank" rel="noreferrer" className="go" style={{ textDecoration: "none", background: "#2D8CFF" }}>Zoom</a>}
            <ClassToggle unitId={unit.id} k={n === 3 ? "class1" : "class2"} done={s.status === "done"} />
          </span>
        ) : n === next && s.status !== "locked" ? (
          <span className="go">{s.status === "doing" ? "이어서" : "하기"}</span>
        ) : (
          icon(n)
        )}
      </>
    );
    if (step.type === "class" || s.status === "locked") return <div key={n} className={cls}>{inner}</div>;
    return <Link key={n} href={HREF[n]} className={cls}>{inner}</Link>;
  };

  return (
    <div className="app wide">
      <header className="hero">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e3edcb" }}>올리브 라이팅</span>
          <form action={logout} className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.16)", borderRadius: 999, padding: "4px 12px" }}>{me.nickname || me.name}</span>
            <button className="btn ghost sm" style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }}>나가기</button>
          </form>
        </div>
        <div className="sub">{unit.stage} · {unit.id}{classText ? ` · ${classText}` : ""}</div>
        <h1>{unit.title} · {unit.topic}</h1>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <div className="bar"><span style={{ width: `${Math.round((done / 7) * 100)}%` }} /></div>
          <b style={{ fontSize: 14 }}>{done} / 7</b>
        </div>
      </header>

      <main className="main">
        {fresh.length > 0 && (
          <section className="notice">
            <div className="row" style={{ gap: 8, fontWeight: 900, color: "var(--head)" }}>
              <span className="bell">🔔</span> 쌤 피드백 {fresh.length}개 도착
            </div>
            {fresh.map((p) => {
              const t = feedbackText(p);
              return (
                <Link key={p.id} href={`/student/feedback/${p.id}`} className={`fb ${t.tone}`}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tt">{t.title}</span>
                    <span className="nn">{(getUnit(p.unit_id)?.id ?? p.unit_id)} · {STEPS[p.step - 1].title}{p.comment ? ` · 쌤: ${p.comment}` : ""}</span>
                  </span>
                  <span className="go">보기</span>
                </Link>
              );
            })}
          </section>
        )}
        {classToday && zoom && (
          <a href={zoom} target="_blank" rel="noreferrer" className="btn block" style={{ background: "#2D8CFF", minHeight: 60, fontSize: 18 }}>
            <IClass size={22} color="#fff" /> 오늘 수업 · Zoom 들어가기
          </a>
        )}
        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--head)" }}>이번 주 할 일</div>
        <div className="week">
        {scheduleOf(group).map(({ day: d, steps }) => {
          const isToday = d === today;
          if (!steps.length)
            return (
              <div key={d} className="day">
                <div className="dayname" style={isToday ? { color: "var(--head)" } : undefined}>{d}{isToday && <span className="today">오늘</span>}</div>
                <div className="daybox"><div className="step" style={{ background: "transparent", color: "var(--muted)", fontSize: 13 }}>밀린 것 하기 · 쉬어 가기</div></div>
              </div>
            );
          return (
            <div key={d} className="day">
              <div className="dayname" style={isToday ? { color: "var(--head)" } : undefined}>
                {d}
                {isToday && <span className="today">오늘</span>}
              </div>
              <div className={`daybox ${isToday ? "now" : ""}`}>{steps.map(row)}</div>
            </div>
          );
        })}
        </div>
        {done === 7 && <div className="bubble ok">이번 유닛 끝! 쌤이 다시 쓰기를 확인하면 다음 유닛이 열려요.</div>}
      </main>

      <footer className="row" style={{ justifyContent: "space-around", padding: "12px 16px 18px", borderTop: "1px solid var(--line)", background: "#fff", fontSize: 12, color: "var(--muted)" }}>
        <span className="row" style={{ gap: 4 }}><IPhone size={16} />앱</span>
        <span className="row" style={{ gap: 4 }}><ICamera size={16} />인증</span>
        <span className="row" style={{ gap: 4 }}><IClass size={16} />수업</span>
        <span className="row" style={{ gap: 4 }}><IEye size={16} />첨삭</span>
      </footer>
    </div>
  );
}
