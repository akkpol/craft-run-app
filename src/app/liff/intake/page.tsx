"use client";

import { useEffect, useState, useCallback } from "react";
import { PRODUCT_TYPES, UNITS } from "@/lib/types";

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      requestFriendship: () => Promise<{ friendFlag: boolean }>;
      closeWindow: () => void;
      isInClient: () => boolean;
    };
  }
}

export default function IntakePage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  useEffect(() => {
    async function initLiff() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        if (!liffId) { setReady(true); return; }

        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) { window.liff.login(); return; }

        try { await window.liff.requestFriendship(); } catch { /* non-critical */ }

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
        if (typeof window !== "undefined" && window.liff) { clearInterval(check); initLiff(); }
      }, 200);
      setTimeout(() => { clearInterval(check); setReady(true); }, 5000);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!productType) { setError("กรุณาเลือกประเภทงาน"); setLoading(false); return; }
    if (!width || Number(width) <= 0) { setError("กรุณาระบุความกว้าง"); setLoading(false); return; }
    if (!height || Number(height) <= 0) { setError("กรุณาระบุความสูง"); setLoading(false); return; }
    if (!phone) { setError("กรุณาระบุเบอร์โทร"); setLoading(false); return; }

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: lineUserId || "dev-user",
          displayName: displayName || "Dev User",
          productType, width: Number(width), height: Number(height),
          unit, qty: Number(qty) || 1, dueDate, phone, note, referenceInfo,
        }),
      });

      const result = await res.json();
      if (!res.ok) { setError(result.error || "เกิดข้อผิดพลาด"); setLoading(false); return; }

      setSubmitted(true);
      if (typeof window !== "undefined" && window.liff?.isInClient()) {
        setTimeout(() => window.liff.closeWindow(), 3000);
      }
    } catch {
      setError("ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [productType, width, height, unit, qty, dueDate, phone, note, referenceInfo, lineUserId, displayName]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="text-center bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">ส่งข้อมูลเรียบร้อยแล้ว!</h2>
          <p className="text-gray-600 text-sm">เราจะส่งใบเสนอราคาให้ทาง LINE ค่ะ</p>
          <p className="text-gray-400 text-xs mt-4">หน้าต่างจะปิดอัตโนมัติ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="bg-[#1a1a2e] text-white px-4 py-5 text-center">
        <h1 className="text-lg font-bold">🏭 FOGUS Print &amp; Sign</h1>
        <p className="text-sm text-gray-300 mt-1">กรอกรายละเอียดงานที่ต้องการ</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* Product Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทงาน <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TYPES.map((pt) => (
              <button key={pt.value} type="button" onClick={() => setProductType(pt.value)}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${productType === pt.value ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ขนาด <span className="text-red-500">*</span></label>
          <div className="flex gap-2 items-end">
            <input type="number" inputMode="decimal" placeholder="กว้าง" value={width} onChange={(e) => setWidth(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" step="any" min="0" />
            <span className="text-gray-400 pb-2.5">×</span>
            <input type="number" inputMode="decimal" placeholder="สูง" value={height} onChange={(e) => setHeight(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" step="any" min="0" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]">
              {UNITS.map((u) => (<option key={u.value} value={u.value}>{u.label}</option>))}
            </select>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
          <input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" min="1" />
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ต้องการใช้งานวันที่</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร <span className="text-red-500">*</span></label>
          <input type="tel" inputMode="tel" placeholder="08x-xxx-xxxx" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
          <textarea placeholder="เช่น ต้องการออกแบบ, มีไฟล์แล้ว, สีที่ต้องการ..." value={note} onChange={(e) => setNote(e.target.value)}
            rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] resize-none" />
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ลิงก์ไฟล์อ้างอิง / รูปตัวอย่าง</label>
          <input type="text" placeholder="URL หรือรายละเอียดไฟล์" value={referenceInfo} onChange={(e) => setReferenceInfo(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]" />
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full bg-[#1a1a2e] text-white py-3 rounded-lg font-medium text-sm hover:bg-[#16213e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {loading ? "กำลังส่ง..." : "ส่งรายละเอียดงาน"}
        </button>
      </form>
    </div>
  );
}
