"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Camera, FileText, ImagePlus, X } from "lucide-react";
import { UNITS } from "@/lib/types";
import ProductTypePicker from "./product-type-picker";

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getIDToken: () => string | null;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      requestFriendship: () => Promise<{ friendFlag: boolean }>;
      closeWindow: () => void;
      isInClient: () => boolean;
    };
  }
}

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const selectClassName =
  "rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const MAX_REFERENCE_FILES = 5;
const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024;

type ReferenceFilePreview = {
  id: string;
  file: File;
  previewUrl: string | null;
};

const sectionToneStyles = {
  emerald: {
    badge: "bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.25)]",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  sky: {
    badge: "bg-sky-600 text-white shadow-[0_12px_24px_rgba(2,132,199,0.24)]",
    pill: "border-sky-200 bg-sky-50 text-sky-700",
  },
  amber: {
    badge: "bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.24)]",
    pill: "border-amber-200 bg-amber-50 text-amber-700",
  },
} as const;

function SectionCard({
  step,
  title,
  description,
  tone,
  badgeLabel,
  children,
}: {
  step: string;
  title: string;
  description: string;
  tone: keyof typeof sectionToneStyles;
  badgeLabel: string;
  children: ReactNode;
}) {
  const toneStyles = sectionToneStyles[tone];

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${toneStyles.badge}`}
          >
            {step}
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneStyles.pill}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
      {label} {required ? <span className="text-rose-500">*</span> : null}
    </label>
  );
}

export default function IntakeForm({
  liffId,
  uploadUrl,
  uploadLabel,
  initialCategory,
  initialProduct,
  intakeMode,
}: {
  liffId: string;
  uploadUrl?: string;
  uploadLabel?: string;
  initialCategory?: string;
  initialProduct?: string;
  intakeMode: "resume" | "fresh";
}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitOutcome, setSubmitOutcome] = useState<"quote" | "review" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [liffIdToken, setLiffIdToken] = useState("");

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
  const [suggestedProductTypes, setSuggestedProductTypes] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFilePreview[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
        const idToken = window.liff.getIDToken();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setLiffIdToken(idToken || "");

        // Prefill returning customer data (skip for fresh/restart mode)
        if (intakeMode !== "fresh" && idToken) {
          try {
            const prefillRes = await fetch(
              `/api/customers/prefill?liffIdToken=${encodeURIComponent(idToken)}`
            );
            if (prefillRes.ok) {
              const prefill = await prefillRes.json();
              if (prefill.phone) setPhone(prefill.phone);
              if (prefill.recentProductTypes?.length > 0) {
                setSuggestedProductTypes(prefill.recentProductTypes);
              }
            }
          } catch {
            // non-critical — form still works without prefill
          }
        }

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
  }, [intakeMode, liffId]);

  const handleReferenceFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;

    const incoming = Array.from(files);
    if (referenceFiles.length + incoming.length > MAX_REFERENCE_FILES) {
      setError(`เพิ่มรูปหรือไฟล์ได้สูงสุด ${MAX_REFERENCE_FILES} ไฟล์`);
      return;
    }

    for (const file of incoming) {
      const isAllowed =
        file.type.startsWith("image/") || file.type === "application/pdf";
      if (!isAllowed) {
        setError("รองรับเฉพาะรูปภาพหรือ PDF");
        return;
      }
      if (file.size > MAX_REFERENCE_FILE_SIZE) {
        setError("ไฟล์ใหญ่เกิน 10MB กรุณาลดขนาดรูปแล้วลองใหม่");
        return;
      }
    }

    const nextFiles = incoming.map((file) => {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      if (previewUrl) {
        previewUrlsRef.current.push(previewUrl);
      }
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.name}`,
        file,
        previewUrl,
      };
    });

    setError("");
    setReferenceFiles((prev) => [...prev, ...nextFiles]);
  }, [referenceFiles.length]);

  const removeReferenceFile = useCallback((id: string) => {
    setReferenceFiles((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (url) => url !== removed.previewUrl
        );
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
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
      if (liffId && !liffIdToken) {
        setError("ไม่สามารถยืนยันตัวตนจาก LINE ได้ กรุณาเปิดฟอร์มนี้จาก LINE แล้วลองใหม่");
        setLoading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("lineUserId", lineUserId || "");
        formData.append("displayName", displayName || "");
        formData.append("liffIdToken", liffIdToken || "");
        formData.append("productType", productType);
        formData.append("width", String(Number(width)));
        formData.append("height", String(Number(height)));
        formData.append("unit", unit);
        formData.append("qty", String(Number(qty) || 1));
        formData.append("dueDate", dueDate);
        formData.append("phone", phone);
        formData.append("note", note);
        formData.append("referenceInfo", referenceInfo);
        formData.append("aiImagePrompt", aiImagePrompt);
        formData.append("intakeMode", intakeMode);
        referenceFiles.forEach((item) => {
          formData.append("referenceFiles", item.file, item.file.name);
        });

        const res = await fetch("/api/intake", {
          method: "POST",
          body: formData,
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
    [
      productType,
      width,
      height,
      unit,
      qty,
      dueDate,
      phone,
      note,
      referenceInfo,
      aiImagePrompt,
      referenceFiles,
      lineUserId,
      displayName,
      liffId,
      liffIdToken,
      intakeMode,
    ]
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
      <div className="flex min-h-screen items-center justify-center px-4">
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
    <div className="px-3 py-4">
      <div className="mx-auto max-w-lg">
        <div className="liff-panel overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#dcfce7_0%,#f0fdf4_48%,#ecfeff_100%)] px-4 py-5 text-slate-900">
            <div className="inline-flex rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              LINE MINI App
            </div>
            <h1 className="mt-3 text-xl font-bold">ส่งรายละเอียดงานกับ FOGUS</h1>
            <p className="mt-1 text-sm text-slate-600">จัดข้อมูลเป็น 3 ช่วงสั้น ๆ: เลือกหมวดงาน, กรอกรายละเอียดหลัก, แล้วเพิ่มข้อมูลเสริมถ้ามี เพื่อให้ทีมสรุปและส่งใบเสนอราคากลับทาง LINE</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1">1 Category Select</span>
              <span className="rounded-full border border-sky-200 bg-white/80 px-3 py-1">2 Essentials</span>
              <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1">3 Optional Details</span>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">
              {intakeMode === "fresh"
                ? "โหมดนี้จะเปิดคำขอใหม่ตั้งแต่ต้น"
                : "โหมดนี้ใช้สำหรับทำรายการเดิมต่อหรือเติมข้อมูลที่ค้างไว้"}
            </p>
            {displayName ? (
              <p className="mt-3 text-xs font-medium text-emerald-700">กำลังช่วยคุณ {displayName}</p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-4 py-5">
            <SectionCard
              step="1"
              title="Category select"
              description="เริ่มจากเลือกหมวดและประเภทงานก่อน ระบบสามารถ preselect ให้ได้ถ้าคุณเปิดมาจาก LINE list menu"
              tone="emerald"
              badgeLabel="Required"
            >
              <div>
                <p className="mb-2 block text-sm font-medium text-slate-800">
                  ประเภทงาน <span className="text-rose-500">*</span>
                </p>
                {suggestedProductTypes.length > 0 && !productType && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="self-center text-xs text-slate-500">ใช้บ่อย:</span>
                    {suggestedProductTypes.slice(0, 3).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProductType(t)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <ProductTypePicker
                  value={productType}
                  onChange={setProductType}
                  initialCategory={initialCategory}
                  initialProduct={initialProduct}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  ถ้าเปิดมาจาก LINE list menu ระบบสามารถพาคุณเข้าหมวดงานที่เกี่ยวข้องให้ได้ทันที
                </p>
              </div>
            </SectionCard>

            <SectionCard
              step="2"
              title="Essentials"
              description="ข้อมูลส่วนนี้ใช้คำนวณราคาเบื้องต้นและติดต่อกลับทาง LINE จึงควรกรอกให้ครบ"
              tone="sky"
              badgeLabel="Core"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="width" label="ขนาด" required />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2">
                    <input
                      id="width"
                      type="number"
                      inputMode="decimal"
                      placeholder="กว้าง"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className={inputClassName}
                      step="any"
                      min="0"
                    />
                    <span className="pb-3 text-slate-400">×</span>
                    <input
                      id="height"
                      type="number"
                      inputMode="decimal"
                      placeholder="สูง"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className={inputClassName}
                      step="any"
                      min="0"
                    />
                    <select
                      aria-label="หน่วยวัด"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className={`${selectClassName} w-auto min-w-[88px]`}
                    >
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="qty" label="จำนวน" />
                  <input
                    id="qty"
                    type="number"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className={inputClassName}
                    min="1"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="dueDate" label="ต้องการใช้งานวันที่" required />
                  <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="phone" label="เบอร์โทร" required />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="08x-xxx-xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              step="3"
              title="Optional details"
              description="ข้อมูลเสริมช่วยให้ทีมตีโจทย์ได้เร็วขึ้น โดยเฉพาะไฟล์อ้างอิง สี และ prompt สำหรับร่างภาพตัวอย่าง"
              tone="amber"
              badgeLabel="Optional"
            >
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                    <ImagePlus className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">เพิ่มรูปตัวอย่างในหน้านี้ได้เลย</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      ถ่ายจากกล้องหรือเลือกรูปในเครื่อง เห็นตัวอย่างก่อนส่ง ทีมงานจะเปิดดูในหลังบ้านได้ทันที
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-white/80 px-4 py-4 text-center text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-white">
                    <Camera className="mb-2 size-6" aria-hidden="true" />
                    เพิ่มรูป / ถ่ายรูป
                    <span className="mt-1 text-xs font-normal text-slate-500">สูงสุด 5 ไฟล์, ไฟล์ละไม่เกิน 10MB</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      capture="environment"
                      onChange={(e) => {
                        handleReferenceFileSelect(e.target.files);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {uploadUrl ? (
                    <a
                      href={uploadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-sky-200 bg-white/80 px-4 py-4 text-center text-sm font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-white"
                    >
                      <FileText className="mb-2 size-6" aria-hidden="true" />
                      {uploadLabel || "เปิดลิงก์รับไฟล์"}
                      <span className="mt-1 text-xs font-normal text-slate-500">ใช้เฉพาะกรณีมีไฟล์ใหญ่หรือโฟลเดอร์เดิม</span>
                    </a>
                  ) : null}
                </div>

                {referenceFiles.length > 0 ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Preview {referenceFiles.length}/{MAX_REFERENCE_FILES}
                      </p>
                      <p className="text-xs text-slate-500">แตะ x เพื่อลบก่อนส่ง</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {referenceFiles.map((item) => (
                        <div key={item.id} className="relative overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                          {item.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.previewUrl} alt={item.file.name || "รูปอ้างอิง"} className="aspect-square w-full object-cover" />
                          ) : (
                            <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-slate-50 px-2 text-center text-[11px] font-medium text-slate-600">
                              <FileText className="size-5" aria-hidden="true" />
                              PDF
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeReferenceFile(item.id)}
                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-sm transition hover:bg-slate-950"
                            aria-label={`ลบ ${item.file.name || "ไฟล์อ้างอิง"}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {uploadUrl ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs leading-5 text-sky-900">
                  มีลิงก์รับไฟล์สำรองไว้สำหรับไฟล์ใหญ่ แต่ถ้าเป็นรูปอ้างอิงทั่วไป กดเพิ่มรูปในฟอร์มนี้จะสะดวกกว่า
                </div>
              ) : null}

              <div>
                <FieldLabel htmlFor="note" label="รายละเอียดเพิ่มเติม" />
                <textarea
                  id="note"
                  placeholder="เช่น ต้องการออกแบบ, มีไฟล์แล้ว, สีที่ต้องการ..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className={textareaClassName}
                />
              </div>

              <div>
                <FieldLabel htmlFor="referenceInfo" label="ลิงก์ไฟล์อ้างอิง / รูปตัวอย่าง" />
                <input
                  id="referenceInfo"
                  type="text"
                  placeholder="วางลิงก์ Google Drive / Dropbox / LINE Album หรือรายละเอียดไฟล์"
                  value={referenceInfo}
                  onChange={(e) => setReferenceInfo(e.target.value)}
                  className={inputClassName}
                />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  ถ้าอัปโหลดไฟล์ไว้แล้ว ให้วางลิงก์ไว้ช่องนี้เพื่อให้ทีมงานเปิดดูได้ทันที
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="aiImagePrompt" label="อยากให้ AI ร่างภาพตัวอย่าง" />
                <textarea
                  id="aiImagePrompt"
                  placeholder="เช่น ป้ายร้านกาแฟสไตล์มินิมอล พื้นไม้ โลโก้สีขาว มีไฟนีออนด้านหลัง"
                  value={aiImagePrompt}
                  onChange={(e) => setAiImagePrompt(e.target.value)}
                  rows={3}
                  className={textareaClassName}
                />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  ถ้ากรอก ทีมงานจะเห็น prompt นี้ในหลังบ้านและกดสร้างภาพตัวอย่างจาก admin ได้ทันที
                </p>
              </div>
            </SectionCard>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_58%,#ecfeff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">พร้อมส่งรายละเอียดแล้ว</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    ช่องที่มี * ช่วยให้ระบบประเมินราคาเบื้องต้นและส่งกลับทาง LINE ได้เร็วขึ้น
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading ? "กำลังส่ง..." : "ส่งรายละเอียดงาน"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
