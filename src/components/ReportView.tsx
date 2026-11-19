import type { ReportData } from "@/lib/report";

const clip = (s: string | null | undefined) => (s ?? "").split("\n").filter((l) => !l.startsWith("Q")).join(" ").replace(/A\.\s*/g, "").slice(0, 400);

export default function ReportView({ r, month, comment }: { r: ReportData; month: string; comment: string | null }) {
  return (
    <div className="card col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", borderBottom: "2px solid var(--navy)", paddingBottom: 12 }}>
        <div><div className="label">올리브 라이팅 · {Number(month.slice(5))}월 학습 리포트</div><h2 style={{ fontSize: 24 }}>{r.name} {r.grade && `(${r.grade})`}</h2></div>
        <div className="small muted">{month}</div>
      </div>
      <div className="grid4">
        <div className="card tint"><div className="label">지금 위치</div><div style={{ fontWeight: 800, fontSize: 18 }}>{r.where}</div><div className="small muted">이번 달 {r.unitsDone}유닛 완료</div></div>
        <div className="card tint"><div className="label">학습한 날</div><div className="big">{r.days}일</div></div>
        <div className="card tint"><div className="label">정답률</div><div className="big" style={{ fontSize: 24 }}>{r.accFirst ?? "—"}{r.accFirst !== null && "%"} → {r.accSecond ?? "—"}{r.accSecond !== null && "%"}</div><div className="small muted">월 초 → 월 말</div></div>
        <div className="card tint"><div className="label">직접 쓴 문장</div><div className="big">{r.sentences}</div></div>
      </div>
      <div className="grid2">
        <div className="card col" style={{ gap: 6 }}>
          <b>좋아진 점</b>
          {r.improved.map((x) => <div key={x.name} className="small">· {x.name} 실수 <b>{x.before}번 → {x.after}번</b></div>)}
          {!r.improved.length && <div className="small muted">꾸준히 연습하고 있어요.</div>}
        </div>
        <div className="card col" style={{ gap: 6 }}>
          <b>다음 달에 집중할 점</b>
          {r.focus.map((x) => <div key={x} className="small">· {x}</div>)}
          {!r.focus.length && <div className="small muted">지금처럼 계속!</div>}
        </div>
      </div>
      {(r.firstWriting || r.lastWriting) && (
        <div className="card col">
          <b>글쓰기 변화 · 처음과 지금</b>
          <div className="grid2">
            {r.firstWriting && <div className="paper en small"><div className="label">{String(r.firstWriting.created_at).slice(5, 10)} · {r.firstWriting.title}</div>{clip(r.firstWriting.text_content)}</div>}
            {r.lastWriting && <div className="paper en small"><div className="label">{String(r.lastWriting.created_at).slice(5, 10)} · {r.lastWriting.title}</div>{clip(r.lastWriting.corrected_text || r.lastWriting.text_content)}</div>}
          </div>
        </div>
      )}
      {comment && <div className="card strong"><b style={{ color: "var(--navy)" }}>쌤 한마디</b><div style={{ marginTop: 6, lineHeight: 1.7 }}>{comment}</div></div>}
    </div>
  );
}
