"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusLookupPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [target, setTarget] = useState<"status" | "quote">("status");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = token.trim();
    if (!normalized) {
      setError("กรุณากรอกเลขติดตามก่อน");
      return;
    }

    setError(null);
    router.push(`/${target}/${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">FOGUS Customer Portal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">ค้นหางานด้วยเลขติดตาม</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          กรอกเลขติดตามที่ทีมงานส่งให้ เพื่อดูสถานะงานหรือเข้าไปอนุมัติใบเสนอราคาได้ทันที
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="tracking-token" className="text-sm font-medium text-slate-700">
              เลขติดตาม (Tracking Code)
            </label>
            <input
              id="tracking-token"
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="เช่น abc123xyz..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">ปลายทาง</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTarget("status")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  target === "status"
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                ดูสถานะงาน
              </button>
              <button
                type="button"
                onClick={() => setTarget("quote")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  target === "quote"
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                จัดการใบเสนอราคา
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            ไปต่อ
          </button>
        </form>
      </div>
    </div>
  );
}
