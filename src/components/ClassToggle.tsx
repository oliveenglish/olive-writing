"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleClass } from "@/app/actions/student";

/** ③ · ⑥ 수업 참석 체크 */
export default function ClassToggle({ unitId, k, done }: { unitId: string; k: "class1" | "class2"; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`go ${done ? "ghost" : ""}`}
      disabled={pending}
      onClick={() => start(async () => { await toggleClass(unitId, k); router.refresh(); })}
    >
      {pending ? "…" : done ? "체크 풀기" : "참석했어요"}
    </button>
  );
}
