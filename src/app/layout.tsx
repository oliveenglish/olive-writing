import "./globals.css";
import type { Metadata, Viewport } from "next";

const TITLE = "올리브 브릿지 라이팅";
const DESC = "문장 드릴부터 국제학교 에세이까지";

export const metadata: Metadata = {
  metadataBase: new URL("https://olive-writing.vercel.app"),
  title: TITLE,
  description: DESC,
  manifest: "/manifest.webmanifest",
  // 카톡 · 문자 링크 미리보기 (이미지는 public/og.png, 1200×630)
  openGraph: { type: "website", url: "/", siteName: TITLE, title: TITLE, description: DESC, images: [{ url: "/og.png?v=3", width: 1200, height: 630, alt: TITLE }], locale: "ko_KR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png?v=3"] },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F2A3D" };

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
