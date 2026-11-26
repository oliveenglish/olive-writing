"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMaterial, toggleNewMaterial } from "@/app/actions/content";

export default function MaterialRowActions({ id, isNew }: { id: string; isNew: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => start(async () => { await toggleNewMaterial(id, !isNew); router.refresh(); })}>{isNew ? "NEW 끄기" : "NEW 켜기"}</button>
      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => { if (confirm("이 파일을 지울까요?")) start(async () => { await deleteMaterial(id); router.refresh(); }); }}>지우기</button>
    </span>
  );
}
