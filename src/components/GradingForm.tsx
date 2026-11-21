"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiDraft } from "@/lib/ai";


/** 사진 위에 바로 첨삭 (빨간 펜) */
function MarkupCanvas({ photoUrl, oldMarkup, canvasRef, onDraw }: { photoUrl: string; oldMarkup: string | null; canvasRef: React.RefObject<HTMLCanvasElement>; onDraw: () => void }) {
  const drawing = useRef(false);
  const strokes = useRef<ImageData[]>([]);
  const [color, setColor] = useState("#D0342C");
  const [width, setWidth] = useState(5);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row small">
        {[["#D0342C", "빨강"], ["#1B2F5B", "남색"], ["rgba(255,214,0,0.45)", "형광"]].map(([c, n]) => (
          <button key={c} type="button" className={`btn sm ${color === c ? "" : "ghost"}`} onClick={() => { setColor(c); setWidth(c.startsWith("rgba") ? 22 : 5); }}>{n}</button>
        ))}
        <button type="button" className="btn ghost sm" onClick={() => {
          const c = canvasRef.current!; const ctx = c.getContext("2d")!;
          const last = strokes.current.pop();
          if (last) ctx.putImageData(last, 0, 0);
        }}>되돌리기</button>
        <button type="button" className="btn ghost sm" onClick={() => {
          const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); strokes.current = [];
        }}>모두 지우기</button>
      </div>
      <div className="photo">
        <img
          src={photoUrl}
          alt="학생 원본"
          onLoad={(e) => {
            const c = canvasRef.current!;
            if (c.width === (e.currentTarget as HTMLImageElement).naturalWidth) return;
            c.width = (e.currentTarget as HTMLImageElement).naturalWidth;
            c.height = (e.currentTarget as HTMLImageElement).naturalHeight;
          }}
        />
        {oldMarkup && <img className="overlay" src={oldMarkup} alt="" />}
        <canvas
          ref={canvasRef}
          className="overlay"
          style={{ touchAction: "none", cursor: "crosshair" }}
          onPointerDown={(e) => {
            const c = canvasRef.current!; const ctx = c.getContext("2d")!;
            strokes.current.push(ctx.getImageData(0, 0, c.width, c.height));
            drawing.current = true;
            const p = pos(e);
            ctx.strokeStyle = color; ctx.lineWidth = width * (c.width / 800); ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            onDraw();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
            ctx.lineTo(p.x, p.y); ctx.stroke();
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />
      </div>
    </div>
  );
}

export default function GradingForm({
  action,
  kind,
  text,
  photoUrl,
  markupUrl,
  draft,
  codes,
  initial,
  returned,
  nextHref,
}: {
  action: (fd: FormData) => Promise<void>;
  kind: string;
  text: string | null;
  photoUrl: string | null;
  markupUrl: string | null;
  draft: AiDraft | null;
  codes: { code: string; name: string }[];
  initial: { corrected: string | null; comment: string | null; codes: string[]; rubric: Record<string, unknown>; decision: string | null; rewrite?: boolean };
  returned: boolean;
  nextHref: string;
}) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drew, setDrew] = useState(false);
  const [corrected, setCorrected] = useState(initial.corrected ?? draft?.corrected ?? text ?? draft?.transcription ?? "");
  const [comment, setComment] = useState(initial.comment ?? draft?.comment ?? "");
  const [picked, setPicked] = useState<string[]>(initial.codes.length ? initial.codes : draft?.error_codes ?? []);
  const [rewrite, setRewrite] = useState(initial.rewrite ?? true);
  const [busy, setBusy] = useState(false);
  // 워크시트 9쪽은 10쪽 사진이 고쳐 쓰기라서 따로 요청하지 않아요
  const isSheet = kind === "ws";

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    fd.append("corrected", corrected);
    fd.append("comment", comment);
    picked.forEach((c) => fd.append("codes", c));
    fd.append("rewrite", rewrite && !isSheet ? "1" : "0");
    if (drew && canvas.current) {
      const blob: Blob = await new Promise((res) => canvas.current!.toBlob((b) => res(b!), "image/png"));
      fd.append("markup", new File([blob], "markup.png", { type: "image/png" }));
    }
    await action(fd);
    setBusy(false);
    router.push(nextHref);
    router.refresh();
  }

  return (
    <div className="side" style={{ gridTemplateColumns: "1fr 380px" }}>
      <div className="col">
        <div className="grid2">
          <div className="card col">
            <div className="label">학생 원본</div>
            {photoUrl ? <div className="photo"><img src={photoUrl} alt="원본" /></div> : null}
            {text && <div className="paper en small" style={{ fontSize: 16 }}>{text}</div>}
          </div>
          <div className="card strong col">
            <div className="label" style={{ color: "var(--navy)" }}>첨삭본 · 학생 화면에 나란히 보여요</div>
            {photoUrl && <MarkupCanvas photoUrl={photoUrl} oldMarkup={markupUrl} canvasRef={canvas} onDraw={() => setDrew(true)} />}
            <textarea className="textarea en" style={{ fontSize: 16, minHeight: photoUrl ? 140 : 320 }} value={corrected} onChange={(e) => setCorrected(e.target.value)} placeholder="고친 글 (사진에 표시만 할 거면 비워도 돼요)" />
          </div>
        </div>
        {draft && (
          <div className="card tint col" style={{ gap: 8 }}>
            <b>AI 초안이 고친 곳 <span className="small muted">— 맞는 것만 남기고 고쳐서 보내세요</span></b>
            {draft.transcription && photoUrl && <div className="small"><b>사진에서 읽은 글:</b> <span className="en">{draft.transcription}</span></div>}
            {(draft.edits ?? []).map((e, k) => (
              <div key={k} className="small">
                <span className="del en">{e.from}</span> → <span className="ins en">{e.to}</span> {e.code && <span className="chip gray">{e.code}</span>} <span className="muted">{e.why}</span>
              </div>
            ))}
            {!draft.edits?.length && <div className="small muted">고칠 곳을 찾지 못했어요.</div>}
          </div>
        )}
      </div>
      <aside className="card col">
        <div className="label">이 글에서 찍을 오류 (학생에겐 안 보여요)</div>
        <div className="row" style={{ gap: 6 }}>
          {codes.map((c) => (
            <button key={c.code} type="button" className={`chip ${picked.includes(c.code) ? "red" : "gray"}`} style={{ border: "none", cursor: "pointer" }} onClick={() => setPicked(picked.includes(c.code) ? picked.filter((x) => x !== c.code) : [...picked, c.code])}>
              {c.name}
            </button>
          ))}
          {!codes.length && <span className="small muted">아직 배운 오류 코드가 없어요.</span>}
        </div>
        <label className="field"><span>학생에게 한마디</span>
          <textarea className="textarea" style={{ fontSize: 15, minHeight: 80 }} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        {isSheet ? (
          <div className="small muted">보내면 학생 &lsquo;첨삭 확인&rsquo; 칸에 떠요. 학생은 첨삭을 보고 워크시트 10쪽에 다시 써서 사진을 올려요.</div>
        ) : (
          <label className="row" style={{ gap: 8, flexWrap: "nowrap", cursor: "pointer" }}>
            <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
            <span className="small"><b>고쳐 쓰기 요청</b> — 학생이 첨삭을 보고 고쳐서 다시 내요</span>
          </label>
        )}
        <button className="btn" disabled={busy} onClick={submit}>{busy ? "저장 중…" : returned ? "고쳐서 다시 보내기" : "학생에게 보내기"}</button>
      </aside>
    </div>
  );
}
