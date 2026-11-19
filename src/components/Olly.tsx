export default function Olly({ size = 96, mood = "happy" }: { size?: number; mood?: "happy" | "think" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="올리">
      <ellipse cx="48" cy="56" rx="30" ry="34" fill="#7E9BCF" stroke="#1B2F5B" strokeWidth="3" />
      <path d="M48 22 C 52 8, 66 6, 72 9 C 66 18, 57 22, 48 22 Z" fill="#C3D2EC" stroke="#1B2F5B" strokeWidth="2.5" />
      <circle cx="38" cy="52" r="4.5" fill="#1F2A10" />
      <circle cx="58" cy="52" r="4.5" fill="#1F2A10" />
      {mood === "happy" ? (
        <path d="M40 64 Q48 71 56 64" stroke="#1F2A10" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M41 66 L55 66" stroke="#1F2A10" strokeWidth="3" strokeLinecap="round" />
      )}
      <ellipse cx="31" cy="62" rx="4" ry="2.5" fill="#E9A3A3" />
      <ellipse cx="65" cy="62" rx="4" ry="2.5" fill="#E9A3A3" />
    </svg>
  );
}
