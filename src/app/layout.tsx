import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "올리브 라이팅",
  description: "단어 → 문장 → 글쓰기, 매주 한 유닛씩",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4C6B1F" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&family=Nunito:wght@700;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
