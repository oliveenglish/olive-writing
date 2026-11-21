"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveZoom } from "@/app/actions/teacher";

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn sm" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>;
}

/** 반별 Zoom 링크 (학생 화면 ③ · ⑥ 수업 칸과 수업 날 맨 위에 떠요) */
export default function ZoomForm({ tt, mw }: { tt: string | null; mw: string | null }) {
  const [state, action] = useFormState(saveZoom, undefined);
  return (
    <form action={action} className="card col">
      <h2 style={{ fontSize: 18 }}>수업 Zoom 링크</h2>
      <div className="side2">
        <label className="field"><span>화 · 목 반</span><input name="zoom_tt" className="input" style={{ fontSize: 15 }} defaultValue={tt ?? ""} placeholder="https://zoom.us/j/..." autoComplete="off" /></label>
        <label className="field"><span>월 · 수 반</span><input name="zoom_mw" className="input" style={{ fontSize: 15 }} defaultValue={mw ?? ""} placeholder="https://zoom.us/j/..." autoComplete="off" /></label>
      </div>
      <div className="small muted">링크가 다른 학생(1:1 등)은 학생 이름을 눌러 그 학생 Zoom 링크를 따로 넣어요.</div>
      <div className="row"><Save />{state?.msg && <span className="small" style={{ fontWeight: 700 }}>{state.msg}</span>}</div>
    </form>
  );
}
