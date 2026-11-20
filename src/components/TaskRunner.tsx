"use client";
import { useRef, useState } from "react";
import QuizRunner from "./QuizRunner";
import { PhotoPicker } from "./Photo";
import type { PublicItem } from "@/lib/grading";
import type { QuizResult, Resp } from "@/app/actions/student";

export default function TaskRunner({ items, writingPrompt, finish }: { items: PublicItem[]; writingPrompt: string | null; finish: (r: Resp[], fd?: FormData) => Promise<QuizResult> }) {
  const [text, setText] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const photo = useRef<File | null>(null);
  const extra = writingPrompt
    ? {
        render: () => (
          <div className="card col">
            <div className="label">글쓰기</div>
            <div className="prompt en" style={{ fontSize: 22 }}>{writingPrompt}</div>
            <textarea className="textarea en" value={text} onChange={(e) => setText(e.target.value)} />
            <PhotoPicker onPick={(f) => { photo.current = f; setHasPhoto(!!f); }} />
          </div>
        ),
        ready: () => hasPhoto || text.trim().split(/\s+/).filter(Boolean).length >= 3,
        collect: () => {
          const fd = new FormData();
          fd.append("writing", text);
          if (photo.current) fd.append("photo", photo.current);
          return fd;
        },
      }
    : undefined;
  if (!items.length && extra) {
    // 글쓰기만 있는 과제: 글 칸 + 사진 + 제출
    if (result)
      return (
        <div className="card col" style={{ alignItems: "center", textAlign: "center" }}>
          <b style={{ fontSize: 20 }}>{result.message}</b>
          <a href="/student" className="btn">홈으로</a>
        </div>
      );
    return (
      <div className="col">
        {extra.render()}
        {!extra.ready() && <div className="small muted">세 단어 이상 쓰거나 손글씨 사진을 올려야 제출할 수 있어요.</div>}
        <button
          className="btn"
          disabled={busy || !extra.ready()}
          onClick={async () => { setBusy(true); setResult(await finish([], extra.collect())); setBusy(false); }}
        >
          {busy ? "보내는 중…" : "쌤에게 제출하기"}
        </button>
      </div>
    );
  }
  return <QuizRunner items={items} finish={finish} extra={extra} />;
}
