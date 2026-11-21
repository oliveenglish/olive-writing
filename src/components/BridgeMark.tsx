/** 브릿지 라이팅 다리 모양 (로고) */
export default function BridgeMark({ width = 120, color = "#4C6B1F", post = "#A9C46C" }: { width?: number; color?: string; post?: string }) {
  return (
    <svg width={width} height={(width * 40) / 250} viewBox="0 0 250 40" aria-hidden="true" style={{ display: "block" }}>
      <path d="M6 36 Q125 -14 244 36" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <g stroke={post} strokeWidth="5" strokeLinecap="round">
        <line x1="50" y1="21" x2="50" y2="36" /><line x1="88" y1="13" x2="88" y2="36" /><line x1="125" y1="11" x2="125" y2="36" /><line x1="162" y1="13" x2="162" y2="36" /><line x1="200" y1="21" x2="200" y2="36" />
      </g>
    </svg>
  );
}
