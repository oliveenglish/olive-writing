"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { correctProof } from "@/app/actions/teacher";

/** ⑤ 사진 위에 바로 빨간 펜 첨삭 → 학생 화면에 원본 / 첨삭본 나란히 */
export default function MarkupForm({ proofId, photoUrl, oldMarkup, oldComment, redo = false }: { proofId: string; photoUrl: string; oldMarkup: string | null; oldComment: string | null; redo?: boolean }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<ImageData[]>([]);
  const [color, setColor] = useState("#B3261E");
  const [width, setWidth] = useState(5);
  const [drew, setDrew] = useState(false);
  const [comment, setComment] = useState(oldComment ?? "");
  const [busy, setBusy] = useState(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  async function send() {
    setBusy(true);
    const fd = new FormData();
    fd.append("comment", comment);
    if (drew && canvas.current) {
      const blob: Blob = await new Promise((res) => canvas.current!.toBlob((b) => res(b!), "image/png"));
      fd.append("markup", new File([blob], "markup.png", { type: "image/png" }));
    }
    await correctProof(proofId, fd);
    setBusy(false);
    router.push("/teacher/proofs");
    router.refresh();
  }

  return (
    <div className="side2" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px", alignItems: "start" }}>
      <div className="card col">
        <div className="row small">
          {[["#B3261E", "빨강"], ["#1E2A0E", "검정"], ["rgba(255,214,0,0.45)", "형광"]].map(([c, n]) => (
            <button key={c} type="button" className={`btn sm ${color === c ? "" : "ghost"}`} onClick={() => { setColor(c); setWidth(c.startsWith("rgba") ? 22 : 5); }}>{n}</button>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => { const c = canvas.current!; const last = strokes.current.pop(); if (last) c.getContext("2d")!.putImageData(last, 0, 0); }}>되돌리기</button>
          <button type="button" className="btn ghost sm" onClick={() => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); strokes.current = []; }}>모두 지우기</button>
        </div>
        <div className="photo">
          <img
            src={photoUrl}
            alt="학생 원본"
            onLoad={(e) => {
              const c = canvas.current!;
              const im = e.currentTarget as HTMLImageElement;
              if (c.width === im.naturalWidth) return;
              c.width = im.naturalWidth;
              c.height = im.naturalHeight;
            }}
          />
          {oldMarkup && <img className="overlay" src={oldMarkup} alt="" />}
          <canvas
            ref={canvas}
            className="overlay"
            style={{ touchAction: "none", cursor: "crosshair" }}
            onPointerDown={(e) => {
              const c = canvas.current!;
              const ctx = c.getContext("2d")!;
              strokes.current.push(ctx.getImageData(0, 0, c.width, c.height));
              drawing.current = true;
              const p = pos(e);
              ctx.strokeStyle = color;
              ctx.lineWidth = width * (c.width / 800);
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              setDrew(true);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvas.current!.getContext("2d")!;
              const p = pos(e);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
        </div>
      </div>
      <aside className="card col">
        <label className="field">
          <span>학생에게 한마디</span>
          <textarea className="textarea" style={{ fontSize: 15, minHeight: 140 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="예: 주인공이 여러 명이면 are, 한 명이면 is예요. 두 문장만 고쳐서 다시 써 봐요!" />
        </label>
        <div className="small muted">{redo ? "보내면 학생에게 '빨간 펜 첨삭 · 다시 써 와요' 알림이 가고, 첨삭을 보고 ⑦을 한 번 더 써서 올려요." : "보내면 학생 ⑦ 칸이 열리고, 첨삭을 보고 워크북에 다시 써서 올려요."}</div>
        <button className="btn" disabled={busy} onClick={send}>{busy ? "보내는 중…" : redo ? "첨삭 보내기 · 다시 써 와요" : "학생에게 보내기"}</button>
      </aside>
    </div>
  );
}
