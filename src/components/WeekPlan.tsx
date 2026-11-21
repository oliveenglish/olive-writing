"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ICONS, PLAN, slotDay, weekdayName, type TaskState } from "@/lib/plan";
import { toggleClass } from "@/app/actions/student";
import SheetUpload from "./SheetUpload";

/**
 * 이번 주 할 일 — 워크시트 첫 장과 같은 요일별 체크리스트
 * 전부 열려 있어요 (순서대로 안 해도 돼요). 앱 활동 · 사진은 하면 저절로 체크, 수업 칸은 직접 체크.
 */
export default function WeekPlan({
  unitId,
  states,
  days,
  today,
  compact = false,
}: {
  unitId: string;
  states: TaskState[];
  days: [number, number];
  today: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const st = new Map(states.map((s) => [s.key, s]));
  const href = (key: string) => `/student/unit/${encodeURIComponent(unitId)}?do=${key}`;
  const hub = `/student/unit/${encodeURIComponent(unitId)}`;
  const done = states.filter((s) => s.done).length;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          {ICONS.map(([i, n]) => <span key={n} className="small muted">{i} {n}</span>)}
        </div>
        <span className="chip">{done} / {PLAN.length} 완료</span>
      </div>
      <div className="planbar"><span style={{ width: `${Math.round((done / PLAN.length) * 100)}%` }} /></div>
      {[0, 1, 2, 3, 4, 5].map((slot) => {
        const d = slotDay(slot, days);
        const isToday = d === today;
        const tasks = PLAN.filter((t) => t.slot === slot);
        return (
          <div key={slot} className={`planday ${isToday ? "today" : ""}`}>
            <div className="pday">
              <b>{weekdayName(d)}</b>
              {isToday && <span>오늘</span>}
            </div>
            <div className="col" style={{ gap: 8, flex: 1, minWidth: 0 }}>
              {tasks.map((t) => {
                const s = st.get(t.key)!;
                const mark = s.done ? "☑" : s.tone === "again" ? "↺" : s.tone === "new" ? "★" : "☐";
                let action: React.ReactNode = null;
                if (t.type === "app") {
                  action = <Link href={href(t.key)} className={`btn sm ${s.done ? "ghost" : ""}`}>{s.done ? "다시 하기" : s.tone === "again" ? "다시 도전" : "하기"}</Link>;
                } else if (t.type === "class") {
                  action = (
                    <button
                      type="button"
                      className={`btn sm ${s.done ? "ghost" : ""}`}
                      disabled={pending}
                      onClick={() => start(async () => { await toggleClass(unitId, t.key as "class1" | "class2"); router.refresh(); })}
                    >
                      {s.done ? "체크 풀기" : "수업했어요"}
                    </button>
                  );
                } else if (t.type === "feedback") {
                  action = s.submissionId && (s.tone === "new" || s.done) ? <Link href={`/student/feedback/${s.submissionId}`} className={`btn sm ${s.done ? "ghost" : ""}`}>{s.done ? "다시 보기" : "첨삭 보기"}</Link> : null;
                } else if (compact) {
                  action = !s.done || s.tone === "again" ? <Link href={hub} className="btn sm ghost">사진 올리기</Link> : null;
                } else {
                  const showUpload = !s.done || s.tone === "again" || open === t.key;
                  action = showUpload ? null : (
                    <button type="button" className="btn ghost sm" onClick={() => setOpen(t.key)}>{s.tone === "wait" ? "사진 바꾸기" : "다시 올리기"}</button>
                  );
                }
                const showUpload = !compact && t.type === "sheet" && (!s.done || s.tone === "again" || open === t.key);
                return (
                  <div key={t.key} className={`ptask ${s.done ? "done" : ""} ${s.tone}`}>
                    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 12 }}>
                      <span className="pmark" aria-hidden>{mark}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ptitle"><span className="picon">{t.icons}</span> {t.title}</div>
                        {!compact && <div className="small muted">{t.hint}</div>}
                        {s.status && <span className={`pstat ${s.tone}`}>{s.status}</span>}
                      </div>
                      {action && <div style={{ flex: "none" }}>{action}</div>}
                    </div>
                    {showUpload && (
                      <div style={{ marginTop: 10, marginLeft: 36 }}>
                        <SheetUpload unitId={unitId} page={t.key} pages={t.key === "p12" || t.key === "p67" ? 2 : 1} again={s.tone === "again"} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
