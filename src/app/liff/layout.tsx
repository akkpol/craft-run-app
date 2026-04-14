import type { Metadata, Viewport } from "next";

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
      <script src="https://static.line-scdn.net/liff/edge/2/sdk.js" charSet="utf-8" defer />
      {children}
    </>
  );
}
