import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Analytics } from '@vercel/analytics/next';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "FOGUS Print & Sign",
  description: "ระบบจัดการร้านป้าย สติ๊กเกอร์ พิมพ์ดิจิทัล",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
