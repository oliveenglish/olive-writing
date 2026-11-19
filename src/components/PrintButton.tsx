"use client";
export default function PrintButton() {
  return <button className="btn ghost" onClick={() => window.print()}>PDF로 저장 · 인쇄</button>;
}
