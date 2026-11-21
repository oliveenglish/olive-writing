"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyImport, previewImport, type ImportSummary } from "@/app/actions/teacher";

export default function DbUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sum, setSum] = useState<ImportSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fd = () => { const f = new FormData(); f.append("file", file!); return f; };
  return (
    <div className="grid2" style={{ gridTemplateColumns: "360px 1fr" }}>
      <label className="card col" style={{ border: "2px dashed var(--done)", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", minHeight: 220 }}>
        <div style={{ fontSize: 36 }}>📄</div>
        <b>{file ? file.name : "엑셀 파일 고르기"}</b>
        <span className="small muted">문항 DB 엑셀 전체를 올리면 바뀐 줄만 반영해요<br />유닛별 단어만 있는 엑셀('단어' 시트)도 돼요</span>
        <input type="file" accept=".xlsx" hidden onChange={async (e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f); setSum(null); setMsg(null);
          if (!f) return;
          setBusy(true);
          const form = new FormData(); form.append("file", f);
          setSum(await previewImport(form));
          setBusy(false);
        }} />
      </label>
      <div className={`card col ${sum ? "strong" : ""}`}>
        <h3 style={{ fontSize: 17 }}>반영 전 미리 보기</h3>
        {busy && <div className="muted">읽는 중…</div>}
        {!sum && !busy && <div className="muted small">파일을 고르면 여기에 검사 결과가 나와요. 아직 학생 화면은 안 바뀌어요.</div>}
        {sum && (
          <>
            <div className="grid4">
              <div className="card tint"><div className="label">새 문항</div><div className="big">{sum.newItems}</div></div>
              <div className="card tint"><div className="label">바뀐 문항</div><div className="big">{sum.changedItems}</div></div>
              <div className="card tint"><div className="label">새 오류 코드</div><div className="big">{sum.newCodes.length}</div><div className="small">{sum.newCodes.join(" · ")}</div></div>
              <div className={`card ${sum.problems.length ? "warn" : "tint"}`}><div className="label">확인 필요</div><div className="big">{sum.problems.length}</div></div>
            </div>
            <div className="small muted">전체: 유닛 {sum.counts.units} · 설명 카드 {sum.counts.cards} · 단어 {sum.counts.words} · 문항 {sum.counts.items} · 오류 코드 {sum.counts.codes} · 점검 소재 {sum.counts.topics}</div>
            {sum.notes.length > 0 && (
              <div className="card tint small" style={{ lineHeight: 1.8 }}>
                {sum.notes.map((p, k) => <div key={k}>· {p}</div>)}
              </div>
            )}
            {sum.problems.length > 0 && (
              <div className="card warn small" style={{ lineHeight: 1.8, maxHeight: 200, overflow: "auto" }}>
                {sum.problems.map((p, k) => <div key={k}>· {p}</div>)}
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" disabled={!sum.ok || busy} onClick={async () => {
                setBusy(true);
                const r = await applyImport(fd());
                setMsg(r.message); setBusy(false);
                if (r.ok) { setSum(null); router.refresh(); }
              }}>{sum.ok ? "반영하기" : `반영하기 (확인 필요 ${sum.problems.length}개 남음)`}</button>
            </div>
          </>
        )}
        {msg && <div className="card tint">{msg}</div>}
      </div>
    </div>
  );
}
