/** 선 아이콘 (이모지 대신) */
type P = { size?: number; color?: string };
const svg = (size: number, color: string, children: React.ReactNode, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const IPhone = ({ size = 18, color = "currentColor" }: P) => svg(size, color, <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>);
export const IPencil = ({ size = 18, color = "currentColor" }: P) => svg(size, color, <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13 7l4 4" /></>);
export const ICamera = ({ size = 18, color = "currentColor" }: P) => svg(size, color, <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IClass = ({ size = 18, color = "currentColor" }: P) => svg(size, color, <><circle cx="12" cy="7" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>);
export const ICheck = ({ size = 16, color = "currentColor" }: P) => svg(size, color, <path d="M5 12l5 5L20 7" />, 3);
export const ISpeaker = ({ size = 24, color = "currentColor" }: P) => svg(size, color, <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6" /></>);
export const IMic = ({ size = 24, color = "currentColor" }: P) => svg(size, color, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>);
export const IPlay = ({ size = 22, color = "currentColor" }: P) => svg(size, color, <path d="M7 5l12 7-12 7z" />);
export const IStop = ({ size = 22, color = "currentColor" }: P) => svg(size, color, <rect x="6" y="6" width="12" height="12" rx="2" />);
export const IBack = ({ size = 22, color = "currentColor" }: P) => svg(size, color, <path d="M15 5l-7 7 7 7" />, 2.5);
export const IClose = ({ size = 22, color = "currentColor" }: P) => svg(size, color, <path d="M6 6l12 12M18 6L6 18" />, 2.5);
export const IEye = ({ size = 18, color = "currentColor" }: P) => svg(size, color, <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
