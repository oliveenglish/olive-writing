"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveGuide } from "@/app/actions/content";

type G = { video_url: string | null; video_title: string | null; video_note: string | null; homework: string | null; must_watch: boolean | null } | null;

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "저장 중…" : "저장하기"}</button>;
}

/** 유닛 하나의 영상 강의 · 숙제 안내 */
export default function GuideForm({ unitId, g }: { unitId: string; g: G }) {
  const [state, action] = useFormState(saveGuide.bind(null, unitId), undefined);
  return (
    <form action={action} className="col" key={unitId}>
      <label className="field"><span>영상 주소 (YouTube 일부 공개 · Vimeo 링크)</span><input name="video_url" className="input" style={{ fontSize: 15 }} defaultValue={g?.video_url ?? ""} placeholder="https://youtu.be/..." autoComplete="off" /></label>
      <label className="field"><span>영상 제목</span><input name="video_title" className="input" style={{ fontSize: 15 }} defaultValue={g?.video_title ?? ""} placeholder="예) 누구에게 무엇을 주다" /></label>
      <label className="field"><span>학생에게 보일 한 줄 설명 (선택)</span><input name="video_note" className="input" style={{ fontSize: 15 }} defaultValue={g?.video_note ?? ""} placeholder="예) give · send · show · tell 순서 익히기" /></label>
      <label className="row" style={{ gap: 8, fontSize: 15 }}><input type="checkbox" name="must_watch" defaultChecked={g?.must_watch !== false} style={{ width: 20, height: 20 }} />영상을 다 봐야 ④ 문장 연습이 열리게 하기</label>
      <label className="field"><span>⑤ 숙제 안내 (학생 홈 '숙제 안내' 칸에 보여요 · 비우면 기본 문구)</span><textarea name="homework" className="textarea" style={{ fontSize: 15 }} defaultValue={g?.homework ?? ""} placeholder={"예) 워크북 7~8쪽 영작 연습\n9~10쪽 내 글 쓰기 (5~7문장)\n다 쓰면 쪽마다 사진 올리기"} /></label>
      <Submit />
      {state?.msg && <div className={`bubble ${state.ok ? "ok" : "no"}`}>{state.msg}</div>}
      <div className="small muted">영상 주소를 지우고 저장하면 이 유닛은 영상 없이 ③을 건너뛰어요.</div>
    </form>
  );
}
