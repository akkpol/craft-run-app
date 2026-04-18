"use client";

import { useEffect, useState, useCallback } from "react";
import { PRODUCT_TYPES, UNITS } from "@/lib/types";

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      requestFriendship: () => Promise<{ friendFlag: boolean }>;
      closeWindow: () => void;
      isInClient: () => boolean;
    };
  }
}

export default function IntakeForm({
  liffId,
  uploadUrl,
  uploadLabel,
}: {
  liffId: string;
  uploadUrl?: string;
  uploadLabel?: string;
}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitOutcome, setSubmitOutcome] = useState<"quote" | "review" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [productType, setProductType] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState("cm");
  const [qty, setQty] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [referenceInfo, setReferenceInfo] = useState("");
  const [aiImagePrompt, setAiImagePrompt] = useState("");

  useEffect(() => {
    async function initLiff() {
      try {
        if (!liffId) {
          setReady(true);
          return;
        }

        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        try {
          await window.liff.requestFriendship();
        } catch {
          // non-critical
        }

        const profile = await window.liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setReady(true);
      } catch (err) {
        console.error("LIFF init error:", err);
        setReady(true);
      }
    }

    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    } else {
      const check = setInterval(() => {
        if (typeof window !== "undefined" && window.liff) {
          clearInterval(check);
          initLiff();
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        setReady(true);
      }, 5000);
    }
  }, [liffId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      if (!productType) {
        setError("กรุณาเลือกประเภทงาน");
        setLoading(false);
        return;
      }
      if (!width || Number(width) <= 0) {
        setError("กรุณาระบุความกว้าง");
        setLoading(false);
        return;
      }
      if (!height || Number(height) <= 0) {
        setError("กรุณาระบุความสูง");
        setLoading(false);
        return;
      }
      if (!phone) {
        setError("กรุณาระบุเบอร์โทร");
        setLoading(false);
        return;
      }
      if (!dueDate) {
        setError("กรุณาระบุวันที่ต้องการใช้งาน");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: lineUserId || "dev-user",
            displayName: displayName || "Dev User",
            productType,
            width: Number(width),
            height: Number(height),
            unit,
            qty: Number(qty) || 1,
            dueDate,
            phone,
            note,
            referenceInfo,
            aiImagePrompt,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          setError(result.error || "เกิดข้อผิดพลาด");
          setLoading(false);
          return;
        }

        setSubmitOutcome(result.needsReview ? "review" : "quote");
        setSubmitMessage(
          result.needsReview
            ? "ทีมงานได้รับข้อมูลแล้ว และจะติดต่อกลับทาง LINE เพื่อช่วยสรุปรายละเอียดเพิ่มเติมค่ะ"
            : "เราจะส่งใบเสนอราคาให้ทาง LINE ค่ะ"
        );
        if (typeof window !== "undefined" && window.liff?.isInClient()) {
          setTimeout(() => window.liff.closeWindow(), 3000);
        }
      } catch {
        setError("ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    },
    [productType, width, height, unit, qty, dueDate, phone, note, referenceInfo, aiImagePrompt, lineUserId, displayName]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="liff-panel w-full max-w-sm p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="mt-4 text-sm font-medium text-slate-700">กำลังเปิดฟอร์มใน LINE...</p>
        </div>
      </div>
    );
  }

  if (submitOutcome) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="liff-panel w-full max-w-sm p-8 text-center">
          <div className="mb-4 text-5xl">{submitOutcome === "review" ? "📞" : "✅"}</div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">
            {submitOutcome === "review" ? "ทีมงานรับเคสแล้ว" : "ส่งข้อมูลเรียบร้อยแล้ว!"}
          </h2>
          <p className="text-sm text-slate-600">{submitMessage}</p>
          <p className="mt-4 text-xs text-slate-400">หน้าต่างจะปิดอัตโนมัติ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto max-w-lg">
        <div className="liff-panel overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#dcfce7_0%,#f0fdf4_48%,#ecfeff_100%)] px-4 py-5 text-slate-900">
            <div className="inline-flex rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              LINE LIFF
            </div>
            <h1 className="mt-3 text-xl font-bold">ส่งรายละเอียดงานกับ FOGUS</h1>
            <p className="mt-1 text-sm text-slate-600">กรอกครั้งเดียวแล้วรอทีมงานสรุปและส่งใบเสนอราคากลับทาง LINE</p>
            {displayName ? (
              <p className="mt-3 text-xs font-medium text-emerald-700">กำลังช่วยคุณ {displayName}</p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-4 py-5">
        {uploadUrl ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-semibold">มีไฟล์งานหรือรูปตัวอย่างอยู่แล้ว?</p>
            <p className="mt-1 text-sky-800">อัปโหลดไฟล์ไว้ก่อน แล้วค่อยวางลิงก์ลงในฟอร์มด้านล่างได้เลย</p>
            <a
              href={uploadUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700"
            >
              {uploadLabel || "เปิดลิงก์รับไฟล์"}
            </a>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ประเภทงาน <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TYPES.map((pt) => (
              <button key={pt.value} type="button" onClick={() => setProductType(pt.value)} className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${productType === pt.value ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"}`}>
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ขนาด <span className="text-red-500">*</span></label>
          <div className="flex items-end gap-2">
            <input type="number" inputMode="decimal" placeholder="กว้าง" value={width} onChange={(e) => setWidth(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" step="any" min="0" />
            <span className="pb-2.5 text-gray-400">×</span>
            <input type="number" inputMode="decimal" placeholder="สูง" value={height} onChange={(e) => setHeight(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" step="any" min="0" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]">
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">จำนวน</label>
          <input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" min="1" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ต้องการใช้งานวันที่ <span className="text-red-500">*</span></label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">เบอร์โทร <span className="text-red-500">*</span></label>
          <input type="tel" inputMode="tel" placeholder="08x-xxx-xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
          <textarea placeholder="เช่น ต้องการออกแบบ, มีไฟล์แล้ว, สีที่ต้องการ..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ลิงก์ไฟล์อ้างอิง / รูปตัวอย่าง</label>
          <input type="text" placeholder="วางลิงก์ Google Drive / Dropbox / LINE Album หรือรายละเอียดไฟล์" value={referenceInfo} onChange={(e) => setReferenceInfo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
          <p className="mt-1 text-xs text-gray-500">ถ้าอัปโหลดไฟล์ไว้แล้ว ให้วางลิงก์ไว้ช่องนี้เพื่อให้ทีมงานเปิดดูได้ทันที</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">อยากให้ AI ร่างภาพตัวอย่าง</label>
          <textarea placeholder="เช่น ป้ายร้านกาแฟสไตล์มินิมอล พื้นไม้ โลโก้สีขาว มีไฟนีออนด้านหลัง" value={aiImagePrompt} onChange={(e) => setAiImagePrompt(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
          <p className="mt-1 text-xs text-gray-500">ถ้ากรอก ทีมงานจะเห็น prompt นี้ในหลังบ้านและกดสร้างภาพตัวอย่างจาก admin ได้ทันที</p>
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "กำลังส่ง..." : "ส่งรายละเอียดงาน"}
        </button>
          </form>
        </div>
      </div>
    </div>
  );
}