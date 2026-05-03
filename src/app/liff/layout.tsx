import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-liff-thai",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-flow-mono",
});

export const metadata: Metadata = {
  title: "FOGUS - สั่งงาน",
  description: "กรอกรายละเอียดงานป้าย สติ๊กเกอร์ พิมพ์ดิจิทัล",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
      <Script src="https://static.line-scdn.net/5/liff-common-profile/edge/production/1.0.0/index.umd.cjs" strategy="beforeInteractive" />
      <div className={`liff-shell flow-theme-shell liff-thai ${plexSansThai.variable} ${jetBrainsMono.variable}`}>
        {children}
      </div>
    </>
  );
}
