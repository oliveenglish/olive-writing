"use client";
/**
 * AI 음성 (브라우저 음성 합성) — 한글은 한국어 목소리, 영어는 영어 목소리로 이어 읽어요.
 * 쌤 음성 파일이 있으면 그걸 먼저 틀어요.
 */
const HANGUL = /[가-힣]/;

export function clean(text: string) {
  return text.replace(/\*\*/g, "").replace(/\s*\|\s*/g, ", ").replace(/[✕✗]/g, " 틀림 ").replace(/[○✓]/g, " 맞음 ").replace(/→/g, ", ");
}

export function speak(text: string, lang?: "ko-KR" | "en-US") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = lang ? [{ t: text, l: lang }] : splitByLang(clean(text));
  for (const p of parts) {
    if (!p.t.trim()) continue;
    const u = new SpeechSynthesisUtterance(p.t);
    u.lang = p.l;
    u.rate = p.l === "en-US" ? 0.9 : 1;
    synth.speak(u);
  }
}

export function stopSpeak() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function splitByLang(text: string) {
  const out: { t: string; l: "ko-KR" | "en-US" }[] = [];
  // 한글이 들어간 덩어리 / 영어 덩어리로 나눠요
  for (const seg of text.split(/(?<=[.!?\n])\s+|\n/)) {
    const words = seg.split(/(\s+)/);
    let buf = "";
    let cur: "ko-KR" | "en-US" | null = null;
    for (const w of words) {
      if (!w.trim()) { buf += w; continue; }
      const l: "ko-KR" | "en-US" = HANGUL.test(w) ? "ko-KR" : /[A-Za-z]/.test(w) ? "en-US" : cur ?? "ko-KR";
      if (cur && l !== cur) { out.push({ t: buf, l: cur }); buf = ""; }
      cur = l;
      buf += w;
    }
    if (cur && buf.trim()) out.push({ t: buf, l: cur });
  }
  return out;
}

/** 예문 한 줄 · 한 칸을 눌러서 듣기 */
export function Tap({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title="눌러서 듣기"
      onClick={() => speak(text.replace(/\*\*/g, ""), "en-US")}
      onKeyDown={(e) => e.key === "Enter" && speak(text.replace(/\*\*/g, ""), "en-US")}
      style={{ cursor: "pointer", borderBottom: "2px dotted #8FA6CC" }}
    >
      {children} <span aria-hidden style={{ fontSize: 13 }}>🔈</span>
    </span>
  );
}

/** 그림 칸: 이모지 또는 이미지 주소 */
export function Pic({ v, size = 44 }: { v: string | null | undefined; size?: number }) {
  if (!v) return null;
  if (/^(https?:\/\/|\/)/.test(v)) return <img src={v} alt="" style={{ maxHeight: size * 3, maxWidth: "100%", borderRadius: 12 }} />;
  return <div style={{ fontSize: size, lineHeight: 1 }}>{v}</div>;
}
