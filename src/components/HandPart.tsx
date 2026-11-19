"use client";
import { Pic } from "./Speak";
import { useState } from "react";
import { PhotoPicker } from "./Photo";
import { submitHand } from "@/app/actions/student";
import type { PublicItem } from "@/lib/grading";

/** 확인 테스트 2부 · 손으로 쓰기 — 통과와 상관없이 쌤이 사진 위에 첨삭 */
export default function HandPart({ unitId, item, sent }: { unitId: string; item: PublicItem; sent: boolean }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(sent);
  const [msg, setMsg] = useState<string | null>(null);
  if (done)
    return <div className="card tint small">✍️ 2부 손으로 쓰기를 쌤에게 보냈어요. 첨삭이 오면 홈에서 원본과 첨삭본을 나란히 볼 수 있어요.</div>;
  return (
    <div className="card strong col">
      <div className="label" style={{ color: "var(--navy)" }}>확인 테스트 2부 · 손으로 쓰기</div>
      <Pic v={item.picture} size={40} />
      <div className="prompt" style={{ fontSize: 18 }}>{item.prompt}</div>
      <div className="small muted">통과와는 상관없어요. 종이에 또박또박 써서 사진을 찍어 올리면, 쌤이 사진 위에 바로 첨삭해 줘요.</div>
      <PhotoPicker onPick={setPhoto} />
      {msg && <div className="small"><b>{msg}</b></div>}
      <button
        className="btn"
        disabled={busy || !photo}
        onClick={async () => {
          setBusy(true);
          const fd = new FormData();
          if (photo) fd.append("photo", photo);
          const r = await submitHand(unitId, item.id, fd);
          setBusy(false);
          setMsg(r.message);
          if (r.ok) setDone(true);
        }}
      >
        {busy ? "보내는 중…" : "사진 보내기"}
      </button>
    </div>
  );
}
