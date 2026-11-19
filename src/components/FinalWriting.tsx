"use client";
import { useState } from "react";
import { PhotoPicker } from "./Photo";
import { submitFinalWriting } from "@/app/actions/student";

export default function FinalWriting({ checkId, topics, checklist }: { checkId: string; topics: { no: number; topic: string; format: string | null }[]; checklist: string[] }) {
  const [topic, setTopic] = useState<string>("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(checklist.map(() => false));
  const [done, setDone] = useState(false);
  if (done)
    return <div className="card tint col">쌤에게 제출했어요! 쌤이 기준표로 채점하고 첨삭해서 돌려줄 거예요. <a className="btn" href="/student">홈으로</a></div>;
  return (
    <div className="side">
      <div className="col">
        <div className="card col">
          <div className="label">주제 고르기 · {topics.length}개 중 하나</div>
          <div className="col" style={{ gap: 8 }}>
            {topics.map((t) => (
              <label key={t.no} className="row" style={{ gap: 10, flexWrap: "nowrap", cursor: "pointer" }}>
                <input type="radio" name="topic" checked={topic === t.topic} onChange={() => setTopic(t.topic)} />
                <span className="en" style={{ fontSize: 17 }}>{t.topic}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="card col">
          <div className="label">키보드로 쓰거나, 종이에 써서 사진으로 올려요</div>
          <textarea className="textarea en" style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="My hobby is …" />
          <PhotoPicker onPick={setPhoto} />
        </div>
      </div>
      <aside className="col">
        <div className="card col" style={{ gap: 8 }}>
          <h3 style={{ fontSize: 16 }}>내기 전에 확인해요</h3>
          {checklist.map((c, k) => (
            <label key={k} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
              <input type="checkbox" checked={checked[k]} onChange={() => setChecked(checked.map((v, j) => (j === k ? !v : v)))} />
              <span>{c}</span>
            </label>
          ))}
        </div>
        <div className="card tint small">쌤이 기준표로 채점해요. 통과하면 다음 단계가 열려요.</div>
        <button
          className="btn"
          disabled={busy || !topic || (!text.trim() && !photo)}
          onClick={async () => {
            setBusy(true);
            const fd = new FormData();
            fd.append("topic", topic);
            fd.append("writing", text);
            if (photo) fd.append("photo", photo);
            await submitFinalWriting(checkId, fd);
            setBusy(false);
            setDone(true);
          }}
        >
          {busy ? "보내는 중…" : "쌤에게 제출하기"}
        </button>
      </aside>
    </div>
  );
}
