import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits, dueReviews, position, progressMap, weaknesses, weeklyRun } from "@/lib/data";
import { addDays, iso, todayKST, weekStart } from "@/lib/dates";
import StudentTop from "@/components/StudentTop";

export const dynamic = "force-dynamic";

type Tone = "new" | "again" | "check";
const TONE: Record<Tone, { label: string; color: string; bg: string; icon: string }> = {
  new: { label: "새로 배우기", color: "#1F3A6E", bg: "#EAF0FB", icon: "✨" },
  again: { label: "다시 하기", color: "#C2561A", bg: "#FFF1E6", icon: "🔁" },
  check: { label: "확인하기", color: "#4A6B2A", bg: "#EEF5E6", icon: "👀" },
};

function Mission({ n, href, sub, title, right, strong, gold, tone }: { n: string; href?: string; sub: string; title: string; right?: string; strong?: boolean; gold?: boolean; tone?: Tone }) {
  const t = tone ? TONE[tone] : null;
  const boxBg = t ? t.color : strong ? "var(--navy)" : gold ? "var(--gold)" : "var(--tint)";
  const inner = (
    <div
      className={`card row ${strong && !t ? "strong" : ""}`}
      style={{
        gap: 18,
        flexWrap: "nowrap",
        ...(gold ? { borderColor: "var(--gold)", background: "var(--goldbg)" } : {}),
        ...(t ? { borderColor: t.color, borderWidth: 2, background: tone === "again" ? t.bg : undefined } : {}),
      }}
    >
      <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: boxBg, color: t || strong || gold ? "#fff" : "var(--navy)", fontWeight: 800, fontSize: tone === "again" ? 24 : 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {tone === "again" ? "🔁" : n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          {t && <span style={{ fontSize: 12, fontWeight: 800, color: t.color, background: t.bg, border: `1px solid ${t.color}`, borderRadius: 999, padding: "2px 10px" }}>{t.icon} {t.label}</span>}
          <span className="label" style={{ margin: 0 }}>{sub}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--head)", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
      {right && <span style={{ fontWeight: 800, color: t?.color ?? "var(--navy)", flex: "none" }}>{right}</span>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

export default async function StudentHome() {
  const me = await requireStudent();
  const today = todayKST();
  const [pos, due, weekly, units, prog, weak] = await Promise.all([
    position(me.id),
    dueReviews(me.id),
    weeklyRun(me.id),
    allUnits(),
    progressMap(me.id),
    weaknesses(me.id),
  ]);
  const { data: returned } = await db().from("submissions").select("id,title").eq("student_id", me.id).eq("status", "returned").eq("seen", false).order("returned_at", { ascending: false });
  // 첨삭은 봤지만 아직 고쳐 쓰지 않은 글
  const { data: rewrites } = await db().from("submissions").select("id,title").eq("student_id", me.id).eq("status", "returned").eq("seen", true).eq("rewrite_wanted", true).eq("rewrite_done", false).order("returned_at", { ascending: false });
  const { data: tasks } = await db().from("task_assignees").select("task_id, tasks(title,due_date,message)").eq("student_id", me.id).eq("status", "assigned");
  const ws = weekStart(today);
  const { data: weekAttempts } = await db().from("attempts").select("correct,activity,created_at").eq("student_id", me.id).gte("created_at", ws.toISOString());
  const graded = (weekAttempts ?? []).filter((a) => a.correct !== null);
  const acc = graded.length ? Math.round((graded.filter((a) => a.correct).length / graded.length) * 100) : null;
  const sentences = (weekAttempts ?? []).filter((a) => ["ko2en", "answer", "find"].includes(a.activity as string)).length;
  const days = new Set((weekAttempts ?? []).map((a) => String(a.created_at).slice(0, 10))).size;

  const stage = pos.type === "unit" ? pos.unit.stage : pos.type === "final" || pos.type === "waiting" ? pos.stage : units.at(-1)?.stage;
  const stageUnits = units.filter((u) => u.stage === stage);
  const weeklyOpen = weekly && weekly.status === "pending" && iso(today) >= weekly.available_from;
  let n = 0;
  const num = () => String(++n);

  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} extra={returned?.length ? <span className="chip">첨삭 도착 {returned.length}</span> : null} />
      <main className="wrap side">
        <section className="col">
          <h1 className="title">오늘의 미션</h1>
          {(tasks ?? []).map((t) => {
            const task = t.tasks as unknown as { title: string; due_date: string | null; message: string | null } | null;
            return (
              <Mission key={t.task_id as string} gold n="쌤" href={`/student/task/${t.task_id}`} sub={`쌤이 낸 과제${task?.due_date ? ` · ${task.due_date.slice(5).replace("-", "/")}까지` : ""}`} title={task?.title ?? "과제"} right={task?.message ?? undefined} />
            );
          })}
          {pos.type === "unit" && (
            (pos.progress?.test_tries ?? 0) > 0 && !pos.progress?.passed ? (
              <Mission tone="again" n={num()} href={`/student/unit/${encodeURIComponent(pos.unit.id)}`} sub={`확인 테스트 다시 도전 · ${pos.unit.id}`} title={pos.unit.title} right="재도전" />
            ) : (
              <Mission tone="new" n={num()} href={`/student/unit/${encodeURIComponent(pos.unit.id)}`} sub={`${pos.progress?.step ? "이어서" : "새 유닛"} · ${pos.unit.id}`} title={pos.unit.title} />
            )
          )}
          {pos.type === "final" && (
            <Mission strong n={num()} href={pos.submitted ? undefined : "/student/final"} sub={`${pos.stage} 끝!`} title={pos.submitted ? "최종 점검 제출 완료 · 쌤이 채점 중이에요" : "최종 점검 보기"} />
          )}
          {pos.type === "waiting" && <div className="card tint">다음 유닛을 쌤이 준비하고 있어요. 복습을 먼저 해요!</div>}
          {pos.type === "done" && <div className="card tint">모든 과정을 마쳤어요! 🎉</div>}
          {due.length > 0 && <Mission tone="again" n={num()} href="/student/review" sub="복습" title={`헷갈렸던 것 ${Math.min(due.length * 2, 8)}문제`} right="약 3분" />}
          {(returned ?? []).map((s) => (
            <Mission key={s.id as string} tone="check" n={num()} href={`/student/feedback/${s.id}`} sub="쌤 첨삭 도착" title={`${s.title} · 쌤 첨삭 도착`} right="원본 / 첨삭본" />
          ))}
          {(rewrites ?? []).map((s) => (
            <Mission key={`rw-${s.id}`} tone="again" n={num()} href={`/student/feedback/${s.id}`} sub="고쳐 쓰기 · 다시 내기" title={`${s.title} · 첨삭 보고 고쳐 써요`} right="고쳐 쓰기" />
          ))}
          {weekly && weekly.status === "pending" && (
            weeklyOpen ? (
              <Mission tone="check" n={num()} href="/student/weekly" sub="주간 점검 · 지금 볼 수 있어요" title={`이번 주 배운 것 섞어서 10문제`} />
            ) : (
              <div className="card tint">
                <div className="label">{weekly.available_from.slice(5).replace("-", "/")} (금)부터</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>이번 주 주간 점검 · {(weekly.unit_ids ?? []).join(" · ")}</div>
              </div>
            )
          )}
        </section>
        <aside className="col">
          <div className="card col">
            <h3 style={{ fontSize: 16 }}>{stage} 진도</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {stageUnits.map((u, k) => {
                const p = prog.get(u.id);
                const cur = pos.type === "unit" && pos.unit.id === u.id;
                return (
                  <span key={u.id} title={u.title} style={{ height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, background: cur ? "var(--navy)" : p?.passed ? "var(--done)" : "var(--todo)", color: cur || p?.passed ? "#fff" : "var(--muted)" }}>{k + 1}</span>
                );
              })}
            </div>
            <div className="muted small">{stageUnits.length}개 유닛을 다 하면 최종 점검</div>
          </div>
          <div className="card col" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 16 }}>이번 주 나의 기록</h3>
            <div className="row" style={{ justifyContent: "space-between" }}><span>공부한 날</span><b>{days}일</b></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span>푼 문제</span><b>{weekAttempts?.length ?? 0}</b></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span>정답률</span><b>{acc === null ? "—" : `${acc}%`}</b></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span>쓴 문장</span><b>{sentences}</b></div>
          </div>
          {weak[0] && (
            <div className="card warn">
              <b>자꾸 헷갈리는 것</b>
              <div>{weak[0].name}</div>
            </div>
          )}
          <div className="muted small">다음 복습: {iso(addDays(today, 1)).slice(5).replace("-", "/")}</div>
        </aside>
      </main>
    </>
  );
}
