"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitRewrite } from "@/app/actions/student";

/** 첨삭을 보고 고쳐 쓰기 (글로 쓰기 또는 손글씨 사진) */
export default function RewriteForm({ parentId, original, photoFirst }: { parentId: string; original: string | null; photoFirst: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(original ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const norm = (t: string) => t.replace(/\s+/g, " ").trim();
  const ready = !!photo || (!!norm(text) && norm(text) !== norm(original ?? ""));

  async function send() {
    if (!ready) return;
    setBusy(true);
    const fd = new FormData();
    if (text.trim() && text.trim() !== (original ?? "").trim()) fd.append("text", text);
    else if (!photo) fd.append("text", text);
    if (photo) fd.append("photo", photo);
    const r = await submitRewrite(parentId, fd);
    setBusy(false);
    setMsg(r.message);
    if (r.ok) setTimeout(() => router.push("/student"), 900);
  }

  return (
    <div className="card strong col">
      <div className="label" style={{ color: "var(--navy)" }}>고쳐 쓰기 · 다시 내기</div>
      <div className="small">빨간 줄과 쌤 말을 보고 고쳐 써요. 고쳐 쓴 글이 진짜 내 실력이 돼요!</div>
      {photoFirst ? (
        <label className="field">
          <span>종이에 고쳐 쓴 글 사진</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      ) : null}
      <textarea className="textarea en" style={{ fontSize: 16, minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={photoFirst ? "(사진 대신 여기에 써도 돼요)" : "고친 글을 써요"} />
      {!photoFirst && (
        <label className="field">
          <span className="small muted">손으로 고쳐 썼다면 사진도 올릴 수 있어요</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {msg && <div className="small"><b>{msg}</b></div>}
      {!ready && <div className="small muted">처음 글에서 고친 곳이 있어야 보낼 수 있어요. (고쳐 쓴 종이 사진을 올려도 돼요)</div>}
      <button className="btn" disabled={busy || !ready} onClick={send}>{busy ? "보내는 중…" : "고쳐 쓴 글 보내기"}</button>
    </div>
  );
}
