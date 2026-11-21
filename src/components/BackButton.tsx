"use client";
import { useRouter } from "next/navigation";
import { IBack } from "./Icons";

/** 이전 화면으로 */
export default function BackButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn sm" style={{ background: "#fff", color: "var(--olive2)" }} onClick={() => router.back()}>
      <IBack size={18} /> 돌아가기
    </button>
  );
}
