"use client";

import { useState } from "react";

export default function QuoteApproveButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    if (!confirm("ยืนยันอนุมัติใบเสนอราคานี้?")) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/quotes/${quoteId}/approve`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setApproved(true);
    } catch {
      setError("ไม่สามารถอนุมัติได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (approved) {
    return (
      <div className="text-center text-green-600 font-medium">
        ✅ อนุมัติเรียบร้อย! ทีมงานจะเริ่มดำเนินการ
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
      <button
        onClick={handleApprove}
        disabled={loading}
        className="w-full bg-[#1a1a2e] text-white py-3 rounded-lg font-medium hover:bg-[#16213e] disabled:opacity-50 transition-colors"
      >
        {loading ? "กำลังดำเนินการ..." : "✅ อนุมัติใบเสนอราคา"}
      </button>
    </div>
  );
}
