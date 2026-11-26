"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCheck } from "@/app/actions/student";

/** ③ 영상 강의를 끝까지 보고 누르는 버튼 */
export default function VideoDone({ unitId, done }: { unitId: string; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (done) return <div className="bubble ok">다 봤어요 ✓ 이제 ④ 문장 연습을 해요</div>;
  return (
    <button
      type="button"
      className="btn block"
      disabled={pending}
      onClick={() => start(async () => { await saveCheck(unitId, "video"); router.refresh(); })}
    >
      {pending ? "저장 중…" : "끝까지 다 봤어요"}
    </button>
  );
}
