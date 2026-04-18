import type { Metadata, Viewport } from "next";
import Script from "next/script";

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
      <div className="liff-shell">{children}</div>
    </>
  );
}
