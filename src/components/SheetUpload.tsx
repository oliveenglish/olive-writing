"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadSheet } from "@/app/actions/student";

/** 사진 여러 장(1~2쪽 · 6~7쪽)을 위아래로 이어 붙여 한 장으로 — 쌤이 한 번에 보고 빨간 펜도 한 장에 */
async function stitch(files: File[], maxW = 1400): Promise<File> {
  const bmps = await Promise.all(files.map((f) => createImageBitmap(f)));
  const w = Math.min(maxW, Math.max(...bmps.map((b) => b.width)));
  const hs = bmps.map((b) => Math.round(b.height * (w / b.width)));
  const gap = bmps.length > 1 ? 16 : 0;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hs.reduce((a, b) => a + b, 0) + gap * (bmps.length - 1);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  let y = 0;
  bmps.forEach((b, k) => {
    ctx.drawImage(b, 0, y, w, hs[k]);
    y += hs[k] + gap;
  });
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return new File([blob], "worksheet.jpg", { type: "image/jpeg" });
}

export default function SheetUpload({ unitId, page, pages, again }: { unitId: string; page: string; pages: number; again?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 3);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    setMsg(null);
  };
  const send = async () => {
    if (!files.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const one = await stitch(files);
      const fd = new FormData();
      fd.append("photo", one);
      const r = await uploadSheet(unitId, page, fd);
      setMsg(r.message);
      if (r.ok) {
        setFiles([]);
        setPreviews([]);
        router.refresh();
      }
    } catch {
      setMsg("사진을 올리지 못했어요. 다시 한번 해 봐요.");
    }
    setBusy(false);
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <label className="btn ghost sm">
          📷 {files.length ? "사진 더 넣기" : again ? "다시 쓴 쪽 사진 올리기" : pages > 1 ? `사진 올리기 (${pages}쪽이면 ${pages}장)` : "사진 올리기"}
          <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
        {files.length > 0 && (
          <>
            <button type="button" className="btn sm" disabled={busy} onClick={send}>{busy ? "보내는 중…" : `쌤에게 보내기 (${files.length}장)`}</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setFiles([]); setPreviews([]); }}>빼기</button>
          </>
        )}
      </div>
      {previews.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          {previews.map((p, k) => <img key={k} src={p} alt={`올릴 사진 ${k + 1}`} style={{ height: 120, borderRadius: 10, border: "1px solid var(--line)" }} />)}
        </div>
      )}
      {msg && <div className="small"><b>{msg}</b></div>}
    </div>
  );
}
