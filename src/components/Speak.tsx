"use client";
/**
 * AI 음성 (브라우저 음성 합성) — 한글은 한국어 목소리, 영어는 영어 목소리로 이어 읽어요.
 * 쌤 음성 파일이 있으면 그걸 먼저 틀어요.
 */
const HANGUL = /[가-힣]/;

export function clean(text: string) {
  return text.replace(/\*\*/g, "").replace(/\s*\|\s*/g, ", ").replace(/[✕✗]/g, " 틀림 ").replace(/[○✓]/g, " 맞음 ").replace(/→/g, ", ");
}

export function speak(text: string, lang?: "ko-KR" | "en-US", onEnd?: () => void, rate?: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = (lang ? [{ t: text, l: lang }] : splitByLang(clean(text))).filter((p) => p.t.trim());
  if (!parts.length) { onEnd?.(); return; }
  parts.forEach((p, k) => {
    const u = new SpeechSynthesisUtterance(p.t);
    u.lang = p.l;
    u.rate = rate ?? (p.l === "en-US" ? 0.9 : 1);
    if (k === parts.length - 1 && onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
  });
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

/** 그림 칸: 이모지 또는 이미지 주소
 * 컴퓨터마다 이모지 글꼴이 달라서 네모(□)로 깨질 수 있어요.
 * 그래서 이모지는 그림 파일(Twemoji)로 보여 주고, 그림을 못 불러오면 글자로 보여 줘요. */
export function Pic({ v, size = 44 }: { v: string | null | undefined; size?: number }) {
  if (!v) return null;
  if (/^(https?:\/\/|\/)/.test(v)) return <img src={v} alt="" style={{ maxHeight: size * 3, maxWidth: "100%", borderRadius: 12 }} />;
  const parts = graphemes(v.trim()).filter((g) => g.trim());
  return (
    <div className="row" style={{ gap: 6, alignItems: "center" }}>
      {parts.map((g, i) => <Emoji key={i} g={g} size={size} />)}
    </div>
  );
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif';

function Emoji({ g, size }: { g: string; size: number }) {
  const isEmoji = /\p{Extended_Pictographic}/u.test(g);
  if (!isEmoji) return <span style={{ fontSize: size * 0.7, fontWeight: 800 }}>{g}</span>;
  const code = toCode(g);
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`}
      alt={g}
      width={size}
      height={size}
      style={{ display: "inline-block" }}
      onError={(e) => {
        const el = e.currentTarget;
        const span = document.createElement("span");
        span.textContent = g;
        span.style.fontSize = `${size}px`;
        span.style.lineHeight = "1";
        span.style.fontFamily = EMOJI_FONT;
        el.replaceWith(span);
      }}
    />
  );
}

/** Twemoji 파일 이름: 코드포인트를 - 로 잇고, ZWJ가 없으면 FE0F는 빼요 */
function toCode(g: string) {
  const cps = Array.from(g).map((c) => c.codePointAt(0)!.toString(16));
  const hasZwj = cps.includes("200d");
  return (hasZwj ? cps : cps.filter((c) => c !== "fe0f")).join("-");
}

function graphemes(t: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(t), (x) => x.segment);
  return Array.from(t);
}
