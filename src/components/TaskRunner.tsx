"use client";
import { useRef, useState } from "react";
import QuizRunner from "./QuizRunner";
import { PhotoPicker } from "./Photo";
import type { PublicItem } from "@/lib/grading";
import type { QuizResult, Resp } from "@/app/actions/student";

export default function TaskRunner({ items, writingPrompt, finish }: { items: PublicItem[]; writingPrompt: string | null; finish: (r: Resp[], fd?: FormData) => Promise<QuizResult> }) {
  const [text, setText] = useState("");
  const photo = useRef<File | null>(null);
  const extra = writingPrompt
    ? {
        render: () => (
          <div className="card col">
            <div className="label">글쓰기</div>
            <div className="prompt en" style={{ fontSize: 22 }}>{writingPrompt}</div>
            <textarea className="textarea en" value={text} onChange={(e) => setText(e.target.value)} />
            <PhotoPicker onPick={(f) => (photo.current = f)} />
          </div>
        ),
        collect: () => {
          const fd = new FormData();
          fd.append("writing", text);
          if (photo.current) fd.append("photo", photo.current);
          return fd;
        },
      }
    : undefined;
  if (!items.length && extra) {
    return <QuizRunner items={[{ id: "_", unit_id: "", activity: "answer", no: 1, prompt: writingPrompt!, kind: "answer", choices: [], picture: null }]} finish={async (_r) => { const fd = new FormData(); fd.append("writing", _r[0]?.response ?? ""); return finish([], fd); }} />;
  }
  return <QuizRunner items={items} finish={finish} extra={extra} />;
}
