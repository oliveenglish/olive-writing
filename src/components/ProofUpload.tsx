"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadProof } from "@/app/actions/student";
import { ICamera } from "./Icons";

/** 사진 여러 장을 위아래로 이어 붙여 한 장으로 (쌤이 한 번에 보고, 빨간 펜도 한 장에) */
async function stitch(files: File[], maxW = 1300): Promise<File> {
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
  bmps.forEach((b, k) => { ctx.drawImage(b, 0, y, w, hs[k]); y += hs[k] + gap; });
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.82));
  return new File([blob], "proof.jpg", { type: "image/jpeg" });
}

export default function ProofUpload({ unitId, step, again }: { unitId: string; step: number; again?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const urls = files.map((f) => URL.createObjectURL(f));
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("photo", await stitch(files));
      const r = await uploadProof(unitId, step, fd);
      setMsg(r.message);
      if (r.ok) { setFiles([]); router.refresh(); }
    } catch {
      setMsg("사진을 올리지 못했어요. 다시 해 봐요.");
    }
    setBusy(false);
  };
  return (
    <div className="col">
      {files.length > 0 && (
        <div className="thumbs">
          {urls.map((u, k) => <img key={k} src={u} alt={`올릴 사진 ${k + 1}`} />)}
        </div>
      )}
      <label className="btn ghost block" style={{ cursor: "pointer" }}>
        <ICamera size={20} />
        {files.length ? "사진 더 넣기 (최대 3장)" : again ? "다시 쓴 쪽 사진 올리기" : "사진 찍기 · 고르기"}
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); setMsg(null); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <div className="grid2">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setFiles([])}>다시 고르기</button>
          <button type="button" className="btn" disabled={busy} onClick={send}>{busy ? "보내는 중…" : `쌤에게 보내기 (${files.length}장)`}</button>
        </div>
      )}
      {msg && <div className="bubble ok">{msg}</div>}
    </div>
  );
}
