"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  DEFAULT_PAYMENT_DISPLAY_MODE,
  PAYMENT_DISPLAY_MODE_LABELS,
  PAYMENT_DISPLAY_MODES,
} from "@/lib/payment-display";
import {
  PAYMENT_ROUTING_CUSTOMER_SCOPE_LABELS,
  PAYMENT_ROUTING_CUSTOMER_SCOPES,
  PAYMENT_ROUTING_TERM_SCOPE_LABELS,
  PAYMENT_ROUTING_TERM_SCOPES,
} from "@/lib/payment-routing";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";

type ProductCatalogImportResult = {
  importedCount: number;
  insertedCount: number;
  updatedCount: number;
  activeCount: number;
  generatedValueCount: number;
};

type CustomerMediaStorageStatus = {
  activeProvider: "r2" | "supabase";
  r2Configured: boolean;
  requiredR2EnvKeys: string[];
  missingR2EnvKeys: string[];
  fallbackProvider: "supabase";
};

type ProductionMediaStorageStatus = {
  activeProvider: "supabase";
  bucket: string;
  metadataTables: string[];
  uploadEnabled: boolean;
  customerSendEnabled: boolean;
  retentionDays: number;
};

type DocumentAppendixStorageStatus = {
  activeProvider: "supabase";
  bucket: string;
  imageConfigured: boolean;
  imageName: string;
};

type SettingsAssetType =
  | "logo"
  | "catalog"
  | "paymentQr"
  | "paymentSecondaryQr"
  | "documentAppendixImage";

type SettingsState = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccountName: string;
  paymentBankName: string;
  paymentAccountNumber: string;
  paymentPromptPayId: string;
  paymentQrCodeUrl: string;
  paymentQrCodeLabel: string;
  paymentDisplayMode: string;
  paymentSecondaryAccountName: string;
  paymentSecondaryBankName: string;
  paymentSecondaryAccountNumber: string;
  paymentSecondaryPromptPayId: string;
  paymentSecondaryQrCodeUrl: string;
  paymentSecondaryQrCodeLabel: string;
  paymentSecondaryDisplayMode: string;
  paymentSecondaryInstructions: string;
  paymentSecondaryMaxQuoteTotal: number | null;
  paymentSecondaryCustomerScope: string;
  paymentSecondaryPaymentTermsScope: string;
  paymentInstructions: string;
  businessLogoUrl: string;
  businessCatalogUrl: string;
  businessCatalogName: string;
  documentAppendixImageUrl: string;
  documentAppendixImageName: string;
  customerUploadUrl: string;
  customerUploadLabel: string;
  customerMediaStorage: CustomerMediaStorageStatus;
  productionMediaStorage: ProductionMediaStorageStatus;
  documentAppendixStorage: DocumentAppendixStorageStatus;
  productionUploadEnabled: boolean;
  productionCustomerAutoSendEnabled: boolean;
  productionAssetRetentionDays: number;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  hasLineChannelAccessToken: boolean;
  hasLineChannelSecret: boolean;
  liffId: string;
  baseUrl: string;
  webhookUrl: string;
  liffEndpointUrl: string;
  aiImageEnabled: boolean;
  aiImageProvider: string;
  aiImageModel: string;
  aiImageApiKey: string;
  hasAiImageApiKey: boolean;
  updatedAt: string | null;
};

const emptyState: SettingsState = {
  businessName: "",
  businessPhone: "",
  businessEmail: "",
  paymentAccountName: "",
  paymentBankName: "",
  paymentAccountNumber: "",
  paymentPromptPayId: "",
  paymentQrCodeUrl: "",
  paymentQrCodeLabel: "",
  paymentDisplayMode: DEFAULT_PAYMENT_DISPLAY_MODE,
  paymentSecondaryAccountName: "",
  paymentSecondaryBankName: "",
  paymentSecondaryAccountNumber: "",
  paymentSecondaryPromptPayId: "",
  paymentSecondaryQrCodeUrl: "",
  paymentSecondaryQrCodeLabel: "",
  paymentSecondaryDisplayMode: DEFAULT_PAYMENT_DISPLAY_MODE,
  paymentSecondaryInstructions: "",
  paymentSecondaryMaxQuoteTotal: null,
  paymentSecondaryCustomerScope: "none",
  paymentSecondaryPaymentTermsScope: "none",
  paymentInstructions: "หลังโอนเงินแล้ว กรุณาส่งสลิปกลับใน LINE แชตนี้เพื่อให้ทีมงานยืนยันการชำระ",
  businessLogoUrl: "",
  businessCatalogUrl: "",
  businessCatalogName: "",
  documentAppendixImageUrl: "",
  documentAppendixImageName: "",
  customerUploadUrl: "",
  customerUploadLabel: "ส่งไฟล์งาน / รูปอ้างอิง",
  customerMediaStorage: {
    activeProvider: "supabase",
    r2Configured: false,
    requiredR2EnvKeys: [
      "CLOUDFLARE_R2_BUCKET",
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    ],
    missingR2EnvKeys: [
      "CLOUDFLARE_R2_BUCKET",
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    ],
    fallbackProvider: "supabase",
  },
  productionMediaStorage: {
    activeProvider: "supabase",
    bucket: "job-media",
    metadataTables: ["job_media_events", "job_media_assets"],
    uploadEnabled: true,
    customerSendEnabled: false,
    retentionDays: 30,
  },
  documentAppendixStorage: {
    activeProvider: "supabase",
    bucket: "app-assets",
    imageConfigured: false,
    imageName: "",
  },
  productionUploadEnabled: true,
  productionCustomerAutoSendEnabled: false,
  productionAssetRetentionDays: 30,
  lineChannelAccessToken: "",
  lineChannelSecret: "",
  hasLineChannelAccessToken: false,
  hasLineChannelSecret: false,
  liffId: "",
  baseUrl: "",
  webhookUrl: "",
  liffEndpointUrl: "",
  aiImageEnabled: false,
  aiImageProvider: "openai",
  aiImageModel: "gpt-image-1",
  aiImageApiKey: "",
  hasAiImageApiKey: false,
  updatedAt: null,
};

export default function SettingsForm() {
  const [form, setForm] = useState<SettingsState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"" | SettingsAssetType>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [catalogImportMessage, setCatalogImportMessage] = useState("");
  const [catalogImportError, setCatalogImportError] = useState("");
  const [catalogImportSummary, setCatalogImportSummary] =
    useState<ProductCatalogImportResult | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "โหลดข้อมูลตั้งค่าไม่สำเร็จ");
          return;
        }

        setForm({ ...emptyState, ...data.settings });
      } catch {
        setError("โหลดข้อมูลตั้งค่าไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAssetUpload(assetType: SettingsAssetType, file: File | null) {
    if (!file) return;

    setUploadingAsset(assetType);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("assetType", assetType);
      formData.append("file", file);

      const res = await fetch("/api/settings/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
        return;
      }

      if (assetType === "logo") {
        setForm((prev) => ({ ...prev, businessLogoUrl: data.url }));
      }

      if (assetType === "catalog") {
        setForm((prev) => ({ ...prev, businessCatalogUrl: data.url, businessCatalogName: data.fileName }));
      }

      if (assetType === "paymentQr") {
        setForm((prev) => ({ ...prev, paymentQrCodeUrl: data.url }));
      }

      if (assetType === "paymentSecondaryQr") {
        setForm((prev) => ({ ...prev, paymentSecondaryQrCodeUrl: data.url }));
      }

      if (assetType === "documentAppendixImage") {
        setForm((prev) => ({
          ...prev,
          documentAppendixImageUrl: data.url,
          documentAppendixImageName: data.fileName,
          documentAppendixStorage: {
            ...prev.documentAppendixStorage,
            imageConfigured: true,
            imageName: data.fileName,
          },
        }));
      }

      setMessage("อัปโหลดไฟล์เรียบร้อยแล้ว");
    } catch {
      setError("อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploadingAsset("");
    }
  }

  function handleAiImageProviderChange(provider: string) {
    updateField("aiImageProvider", provider);

    const providerDefaultModel = provider === "google" ? "imagen-3.0-generate-002" : "gpt-image-1";
    const knownDefaultModels = new Set(["gpt-image-1", "imagen-3.0-generate-002"]);
    if (!form.aiImageModel || knownDefaultModels.has(form.aiImageModel)) {
      updateField("aiImageModel", providerDefaultModel);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }

      setMessage("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      setForm((prev) => ({
        ...prev,
        webhookUrl: `${(prev.baseUrl || "").replace(/\/$/, "")}/api/webhook`,
        liffEndpointUrl: `${(prev.baseUrl || "").replace(/\/$/, "")}/liff`,
        updatedAt: new Date().toISOString(),
        hasAiImageApiKey: prev.hasAiImageApiKey || Boolean(prev.aiImageApiKey),
        aiImageApiKey: "",
      }));
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleProductCatalogImport(file: File | null) {
    if (!file) {
      return;
    }

    setImportingCatalog(true);
    setCatalogImportMessage("");
    setCatalogImportError("");
    setCatalogImportSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/product-catalog/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        const detailMessage = Array.isArray(data.details) && data.details.length > 0
          ? `: ${data.details.slice(0, 3).join(" | ")}`
          : "";
        setCatalogImportError(
          `${data.error || "นำเข้า product catalog ไม่สำเร็จ"}${detailMessage}`
        );
        return;
      }

      setCatalogImportSummary({
        importedCount: Number(data.importedCount) || 0,
        insertedCount: Number(data.insertedCount) || 0,
        updatedCount: Number(data.updatedCount) || 0,
        activeCount: Number(data.activeCount) || 0,
        generatedValueCount: Number(data.generatedValueCount) || 0,
      });
      setCatalogImportMessage(
        `นำเข้า catalog สำเร็จ ${Number(data.importedCount) || 0} รายการ`
      );
    } catch {
      setCatalogImportError("นำเข้า product catalog ไม่สำเร็จ");
    } finally {
      setImportingCatalog(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">กำลังโหลดการตั้งค่า...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">ข้อมูลองค์กร</h2>
        <p className="mt-1 text-sm text-slate-500">ข้อมูลส่วนนี้ใช้สำหรับแสดงผลในเอกสารและหน้าลูกค้า</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ชื่อร้าน / บริษัท</span>
            <input value={form.businessName} onChange={(e) => updateField("businessName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="FOGUS Print & Sign" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เบอร์โทรร้าน</span>
            <input value={form.businessPhone} onChange={(e) => updateField("businessPhone", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="02-xxx-xxxx" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>อีเมลร้าน</span>
            <input value={form.businessEmail} onChange={(e) => updateField("businessEmail", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="contact@example.com" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ธนาคารรับโอน</span>
            <input value={form.paymentBankName} onChange={(e) => updateField("paymentBankName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น กสิกรไทย" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ชื่อบัญชี</span>
            <input value={form.paymentAccountName} onChange={(e) => updateField("paymentAccountName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ชื่อบัญชีรับเงิน" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เลขบัญชี</span>
            <input value={form.paymentAccountNumber} onChange={(e) => updateField("paymentAccountNumber", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="xxx-x-xxxxx-x" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>พร้อมเพย์ / PromptPay</span>
            <input value={form.paymentPromptPayId} onChange={(e) => updateField("paymentPromptPayId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เบอร์โทรหรือเลข PromptPay" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>รูปแบบแสดงช่องทางชำระเงิน</span>
            <select
              value={form.paymentDisplayMode}
              onChange={(e) => updateField("paymentDisplayMode", e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
            >
              {PAYMENT_DISPLAY_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PAYMENT_DISPLAY_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ข้อความใต้ QR Code</span>
            <input value={form.paymentQrCodeLabel} onChange={(e) => updateField("paymentQrCodeLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น สแกนเพื่อโอนเข้าบัญชีบริษัท หรือ PromptPay ร้าน" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>คำแนะนำการชำระเงินสำหรับลูกค้า</span>
            <textarea value={form.paymentInstructions} onChange={(e) => updateField("paymentInstructions", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น หลังโอนแล้วส่งสลิปกลับมาใน LINE แชตนี้" />
            <p className="text-xs text-slate-500">ข้อมูลชุดนี้จะไปแสดงในหน้าใบเสนอราคาและหน้าเอกสารดาวน์โหลดของลูกค้า</p>
          </label>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>QR Code สำหรับชำระเงิน</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="อัปโหลด QR Code สำหรับชำระเงิน" title="อัปโหลด QR Code สำหรับชำระเงิน" onChange={(e) => handleAssetUpload("paymentQr", e.target.files?.[0] || null)} className="block text-sm" />
              {uploadingAsset === "paymentQr" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
              {form.paymentQrCodeUrl ? <a href={form.paymentQrCodeUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิด QR Code</a> : null}
            </div>
            {form.paymentQrCodeUrl ? (
              <Image
                src={form.paymentQrCodeUrl}
                alt="Payment QR Code"
                width={192}
                height={192}
                unoptimized
                className="mt-2 h-40 w-40 rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
            ) : null}
            <p className="text-xs text-slate-500">ถ้าเลือกโหมด QR only แต่ยังไม่มี QR ระบบจะ fallback ไปใช้เลขบัญชีหรือ PromptPay ที่ตั้งไว้เพื่อไม่ให้ flow สะดุด</p>
          </div>
          <div className="md:col-span-2 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-slate-900">บัญชีรอง / Auto-routing profile</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  ใช้สำหรับกรณีที่ระบบต้องเลือกช่องทางรับเงินอีกชุดโดยอัตโนมัติตามยอด quote หรือ payment term ที่ลูกค้าเลือกตั้งแต่ตอน intake
                </p>
              </div>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ธนาคารบัญชีรอง</span>
                <input value={form.paymentSecondaryBankName} onChange={(e) => updateField("paymentSecondaryBankName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น ธนาคารกรุงเทพ" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ชื่อบัญชีรอง</span>
                <input value={form.paymentSecondaryAccountName} onChange={(e) => updateField("paymentSecondaryAccountName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ชื่อบัญชีอีกบริษัท / บัญชีรอง" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>เลขบัญชีรอง</span>
                <input value={form.paymentSecondaryAccountNumber} onChange={(e) => updateField("paymentSecondaryAccountNumber", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="xxx-x-xxxxx-x" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>PromptPay บัญชีรอง</span>
                <input value={form.paymentSecondaryPromptPayId} onChange={(e) => updateField("paymentSecondaryPromptPayId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เบอร์หรือเลข PromptPay สำรอง" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>รูปแบบแสดงบัญชีรอง</span>
                <select
                  value={form.paymentSecondaryDisplayMode}
                  onChange={(e) => updateField("paymentSecondaryDisplayMode", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_DISPLAY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {PAYMENT_DISPLAY_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองเมื่อยอด quote ไม่เกิน</span>
                <input
                  type="number"
                  min={0}
                  value={form.paymentSecondaryMaxQuoteTotal ?? ""}
                  onChange={(e) =>
                    updateField(
                      "paymentSecondaryMaxQuoteTotal",
                      e.target.value ? Number.parseFloat(e.target.value) : null
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                  placeholder="เช่น 300"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองตาม payment term ที่ลูกค้าเลือก</span>
                <select
                  value={form.paymentSecondaryPaymentTermsScope}
                  onChange={(e) => updateField("paymentSecondaryPaymentTermsScope", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_ROUTING_TERM_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {PAYMENT_ROUTING_TERM_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองตามประเภทลูกค้า</span>
                <select
                  value={form.paymentSecondaryCustomerScope}
                  onChange={(e) => updateField("paymentSecondaryCustomerScope", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_ROUTING_CUSTOMER_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {PAYMENT_ROUTING_CUSTOMER_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>คำแนะนำการชำระเงินของบัญชีรอง</span>
                <textarea value={form.paymentSecondaryInstructions} onChange={(e) => updateField("paymentSecondaryInstructions", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น งานมูลค่าน้อยหรือ credit ให้ใช้บัญชีนี้และแนบหลักฐานตามขั้นตอนนี้" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>ข้อความใต้ QR Code ของบัญชีรอง</span>
                <input value={form.paymentSecondaryQrCodeLabel} onChange={(e) => updateField("paymentSecondaryQrCodeLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น สแกนเพื่อโอนเข้าบัญชีรอง" />
              </label>
              <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>QR Code ของบัญชีรอง</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="อัปโหลด QR Code บัญชีสำรอง" title="อัปโหลด QR Code บัญชีสำรอง" onChange={(e) => handleAssetUpload("paymentSecondaryQr", e.target.files?.[0] || null)} className="block text-sm" />
                  {uploadingAsset === "paymentSecondaryQr" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
                  {form.paymentSecondaryQrCodeUrl ? <a href={form.paymentSecondaryQrCodeUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิด QR บัญชีรอง</a> : null}
                </div>
                {form.paymentSecondaryQrCodeUrl ? (
                  <Image
                    src={form.paymentSecondaryQrCodeUrl}
                    alt="Secondary Payment QR Code"
                    width={192}
                    height={192}
                    unoptimized
                    className="mt-2 h-40 w-40 rounded-2xl border border-slate-200 bg-white object-contain p-2"
                  />
                ) : null}
                <p className="text-xs text-slate-500">
                  ระบบจะเลือกบัญชีรองอัตโนมัติเมื่อเข้าเงื่อนไขข้อใดข้อหนึ่งที่ตั้งไว้ และถ้าบัญชีรองยังไม่ครบ ระบบจะถอยกลับไปใช้บัญชีหลักโดยอัตโนมัติเพื่อไม่ให้ quote พัง
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>โลโก้ร้าน</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="อัปโหลดโลโก้ร้าน" title="อัปโหลดโลโก้ร้าน" onChange={(e) => handleAssetUpload("logo", e.target.files?.[0] || null)} className="block text-sm" />
              {uploadingAsset === "logo" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
              {form.businessLogoUrl ? <a href={form.businessLogoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิดไฟล์โลโก้</a> : null}
            </div>
            {form.businessLogoUrl ? (
              <Image
                src={form.businessLogoUrl}
                alt="Business logo"
                width={256}
                height={64}
                unoptimized
                className="mt-2 h-16 w-auto rounded-2xl border border-slate-200 bg-slate-50 p-2"
              />
            ) : null}
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ไฟล์ร้าน / Company Profile</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="application/pdf,image/png,image/jpeg" aria-label="อัปโหลดไฟล์ร้านหรือ Company Profile" title="อัปโหลดไฟล์ร้านหรือ Company Profile" onChange={(e) => handleAssetUpload("catalog", e.target.files?.[0] || null)} className="block text-sm" />
              {uploadingAsset === "catalog" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
              {form.businessCatalogUrl ? <a href={form.businessCatalogUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิดไฟล์ร้าน</a> : null}
            </div>
            {form.businessCatalogName ? <p className="text-xs text-slate-500">ไฟล์ล่าสุด: {form.businessCatalogName}</p> : null}
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>รูปแนบท้ายเอกสารการค้า</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="อัปโหลดรูปแนบท้ายเอกสารการค้า" title="อัปโหลดรูปแนบท้ายเอกสารการค้า" onChange={(e) => handleAssetUpload("documentAppendixImage", e.target.files?.[0] || null)} className="block text-sm" />
              {uploadingAsset === "documentAppendixImage" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
              {form.documentAppendixImageUrl ? <a href={form.documentAppendixImageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิดรูปแนบท้าย</a> : null}
            </div>
            {form.documentAppendixImageUrl ? (
              <Image
                src={form.documentAppendixImageUrl}
                alt="Document appendix image"
                width={360}
                height={240}
                unoptimized
                className="mt-2 h-44 w-full max-w-sm rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
            ) : null}
            {form.documentAppendixImageName ? <p className="text-xs text-slate-500">ไฟล์ล่าสุด: {form.documentAppendixImageName}</p> : null}
            <p className="text-xs text-slate-500">เอกสารการค้าที่ issue หลังจากตั้งค่านี้จะล็อกรูปนี้ไว้ใน snapshot และพิมพ์เป็นหน้าท้ายของใบวางบิล/ใบเสร็จ/ใบกำกับภาษี</p>
          </div>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ลิงก์รับไฟล์จากลูกค้า</span>
            <input value={form.customerUploadUrl} onChange={(e) => updateField("customerUploadUrl", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="https://drive.google.com/... หรือ Dropbox/OneDrive file request" />
            <p className="text-xs text-slate-500">แนะนำสำหรับทางลัดตอนนี้: ใช้ลิงก์ Google Drive, Google Form, Dropbox File Request หรือ OneDrive upload link</p>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ข้อความปุ่มลิงก์รับไฟล์</span>
            <input value={form.customerUploadLabel} onChange={(e) => updateField("customerUploadLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ส่งไฟล์งาน / รูปอ้างอิง" />
          </label>
          <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-4 md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">คลังไฟล์ของระบบ</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  แยกให้เห็นชัดระหว่างไฟล์ลูกค้า, ไฟล์พนักงานสำหรับยืนยันงาน, และรูปแนบท้ายเอกสาร
                </p>
              </div>
              <span className={form.customerMediaStorage.r2Configured ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"}>
                ไฟล์ลูกค้า: {form.customerMediaStorage.activeProvider === "r2" ? "Cloudflare R2" : "Supabase Storage"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">ลูกค้าอัปโหลดจาก LIFF</p>
                <p>metadata: lead_media_assets</p>
                <p>bucket/provider: {form.customerMediaStorage.activeProvider === "r2" ? "Cloudflare R2 customer-media" : "Supabase customer-media"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">พนักงานยืนยันงานกับลูกค้า</p>
                <p>metadata: {form.productionMediaStorage.metadataTables.join(" + ")}</p>
                <p>bucket/provider: Supabase {form.productionMediaStorage.bucket}</p>
                <p>review/send: {form.productionUploadEnabled ? "เปิดใช้" : "ปิดอยู่"} / {form.productionCustomerAutoSendEnabled ? "ส่งอัตโนมัติ" : "แอดมินกดส่ง"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">รูปแนบท้ายเอกสาร</p>
                <p>bucket/provider: Supabase {form.documentAppendixStorage.bucket}</p>
                <p>สถานะ: {form.documentAppendixStorage.imageConfigured ? "มีรูปแล้ว" : "ยังไม่มีรูป"}</p>
                <p>เอกสารใหม่จะล็อกรูปลง snapshot ตอน issue</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {form.customerMediaStorage.requiredR2EnvKeys.map((key) => {
                const missing = form.customerMediaStorage.missingR2EnvKeys.includes(key);

                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 text-xs">
                    <span className="font-mono text-slate-600">{key}</span>
                    <span className={missing ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                      {missing ? "ยังขาด" : "พร้อม"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              R2 key เป็น server-only และแก้ที่ Vercel Environment Variables เท่านั้น ถ้า key ครบ ระบบจะใช้ R2 อัตโนมัติ ถ้าไม่ครบจะ fallback ไป Supabase Storage โดยไม่ทำให้ลูกค้าส่งฟอร์มเสีย
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">LINE Messaging API และ LINE MINI App</h2>
        <p className="mt-1 text-sm text-slate-500">กรอกค่าที่เจ้าของระบบได้จาก LINE Developers Console เพื่อให้ระบบส่งข้อความและเปิด LINE MINI App ที่ทำงานบน LIFF SDK ได้โดยไม่ต้องแก้ไฟล์ env</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LINE Channel Access Token</span>
            <textarea
              value={form.lineChannelAccessToken}
              onChange={(e) => updateField("lineChannelAccessToken", e.target.value)}
              rows={3}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
              placeholder={form.hasLineChannelAccessToken ? "มี token ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "ใส่ค่าจาก Messaging API"}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500">
              {form.hasLineChannelAccessToken
                ? "ระบบมี token อยู่แล้ว ถ้าปล่อยว่างจะเก็บค่าปัจจุบันไว้ และจะไม่ preload กลับมาในเบราว์เซอร์"
                : "ค่านี้จะไม่ถูก preload กลับมาในเบราว์เซอร์เพื่อความปลอดภัย"}
            </p>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LINE Channel Secret</span>
            <input
              type="password"
              value={form.lineChannelSecret}
              onChange={(e) => updateField("lineChannelSecret", e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
              placeholder={form.hasLineChannelSecret ? "มี secret ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "ใส่ค่าจาก Messaging API"}
              autoComplete="new-password"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500">
              {form.hasLineChannelSecret
                ? "ระบบมี secret อยู่แล้ว ถ้าปล่อยว่างจะเก็บค่าปัจจุบันไว้ และจะไม่ preload กลับมาในเบราว์เซอร์"
                : "ค่านี้จะไม่ถูก preload กลับมาในเบราว์เซอร์เพื่อความปลอดภัย"}
            </p>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LIFF ID / MINI App ID</span>
            <input value={form.liffId} onChange={(e) => updateField("liffId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น 2000000000-xxxxxxx" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Base URL ของระบบ</span>
            <input value={form.baseUrl} onChange={(e) => updateField("baseUrl", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="https://your-app.vercel.app" />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Product Catalog Runtime</h2>
        <p className="mt-1 text-sm text-slate-500">
          ใช้ CSV ชุดเดียวสำหรับ bulk import รายการสินค้าเข้าระบบ เพื่อให้ LIFF intake และ quote flow ใช้ catalog runtime
          ได้โดยไม่ต้องให้ผู้ใช้มานั่งกรอกสินค้าเป็นร้อยหรือเป็นพันรายการเอง
        </p>

        <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-900">CSV import สำหรับสินค้า</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                รองรับคอลัมน์ `value`, `label`, `category`, `category_label`, `description`, `keywords`,
                `per_sqm`, `min_charge`, `active`, `sort_order` และถ้าไม่ใส่ `value` ระบบจะ generate slug ให้เอง
              </p>
            </div>

            <a
              href="/templates/product-catalog-template.csv"
              download
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ดาวน์โหลด template CSV
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="อัปโหลด CSV product catalog"
              title="อัปโหลด CSV product catalog"
              onChange={(event) => {
                void handleProductCatalogImport(event.target.files?.[0] || null);
                event.currentTarget.value = "";
              }}
              className="block text-sm"
            />
            {importingCatalog ? (
              <span className="text-xs text-slate-500">กำลังนำเข้า CSV...</span>
            ) : null}
          </div>

          {catalogImportMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {catalogImportMessage}
            </div>
          ) : null}

          {catalogImportError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {catalogImportError}
            </div>
          ) : null}

          {catalogImportSummary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Imported</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.importedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inserted</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.insertedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.updatedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.activeCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Generated Keys</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.generatedValueCount}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-1 text-xs leading-5 text-slate-500">
            <p>1. ดาวน์โหลด template แล้วเติมรายการสินค้าเป็นชุด</p>
            <p>2. import ผ่านกล่องนี้จากหลังบ้าน</p>
            <p>3. LIFF intake จะอ่าน catalog runtime ชุดล่าสุดโดยอัตโนมัติ ถ้า database ยังว่างระบบจะ fallback ไป catalog มาตรฐาน</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Production Upload</h2>
        <p className="mt-1 text-sm text-slate-600">
          ตั้งค่า flow สำหรับลิงก์รายงานงานจากทีมผลิตและคิวตรวจรูปก่อนส่งให้ลูกค้า
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เปิดใช้งาน production upload</span>
            <select
              value={form.productionUploadEnabled ? "enabled" : "disabled"}
              onChange={(e) =>
                updateField("productionUploadEnabled", e.target.value === "enabled")
              }
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
            >
              <option value="enabled">เปิด</option>
              <option value="disabled">ปิด</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ส่งหลักฐานถึงลูกค้าอัตโนมัติหลัง approve</span>
            <select
              value={form.productionCustomerAutoSendEnabled ? "enabled" : "disabled"}
              onChange={(e) =>
                updateField(
                  "productionCustomerAutoSendEnabled",
                  e.target.value === "enabled"
                )
              }
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
            >
              <option value="disabled">ปิด</option>
              <option value="enabled">เปิด</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>อายุไฟล์หลักฐานก่อน cleanup อัตโนมัติ (วัน)</span>
            <input
              type="number"
              min={1}
              value={form.productionAssetRetentionDays}
              onChange={(e) =>
                updateField(
                  "productionAssetRetentionDays",
                  Number.parseInt(e.target.value || "30", 10)
                )
              }
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
            />
            <p className="text-xs text-slate-500">
              metadata จะยังอยู่เพื่อ audit แต่ไฟล์จริงใน private bucket จะถูก cleanup ตามค่านี้
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Webhook และ LINE Console Checklist</h2>
        <p className="mt-1 text-sm text-slate-600">ใช้ค่าด้านล่างใน LINE Developers Console เพื่อให้ LINE OA ยิง event เข้ามาที่ระบบได้จริง</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>Webhook URL</span>
            <input value={form.webhookUrl} readOnly className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-700" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>LINE MINI App / LIFF Endpoint URL</span>
            <input value={form.liffEndpointUrl} readOnly className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-700" />
          </label>
        </div>
        <div className="mt-4 space-y-2 text-sm text-emerald-900">
          <p>1. ไปที่ LINE Developers Console &gt; Messaging API</p>
          <p>2. วาง Webhook URL แล้วกด Verify</p>
          <p>3. เปิดสวิตช์ `Use webhook` ให้เป็น Enabled</p>
          <p>4. ที่ LINE MINI App / LIFF ให้ลงทะเบียน endpoint เป็น `/liff` ไม่ใช่ `/liff/intake`</p>
          <p>5. ให้แอปเปิดที่ `/liff` โดยตรง และหลีกเลี่ยงการ redirect ไป path อื่นก่อน `liff.init()` เสร็จ</p>
        </div>
      </section>

      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">AI สร้างรูป</h2>
            <p className="mt-1 text-sm text-slate-600">รองรับ OpenAI (gpt-image-1) และ Google AI Studio (Imagen 3) แนะนำให้ใช้ Google AI Studio หากต้องการความประหยัดหรือโควตาฟรี</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={form.aiImageEnabled ? "rounded-full border border-emerald-200 bg-white px-3 py-1 text-emerald-800" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"}>
              {form.aiImageEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}
            </span>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-violet-800">
              Provider: {form.aiImageProvider === "google" ? "Google AI Studio" : "OpenAI"}
            </span>
            <span className={form.hasAiImageApiKey ? "rounded-full border border-emerald-200 bg-white px-3 py-1 text-emerald-800" : "rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-800"}>
              {form.hasAiImageApiKey ? "มี API key" : "ยังไม่มี API key"}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เปิดใช้งาน AI Image</span>
            <select value={form.aiImageEnabled ? "enabled" : "disabled"} onChange={(e) => updateField("aiImageEnabled", e.target.value === "enabled")} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400">
              <option value="disabled">ปิด</option>
              <option value="enabled">เปิด</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Provider</span>
            <select value={form.aiImageProvider} onChange={(e) => handleAiImageProviderChange(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400">
              <option value="openai">OpenAI</option>
              <option value="google">Google AI Studio</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>Model</span>
            <input value={form.aiImageModel} onChange={(e) => updateField("aiImageModel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder={form.aiImageProvider === "google" ? "imagen-3.0-generate-002" : "gpt-image-1"} />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>{form.aiImageProvider === "google" ? "Google AI API Key" : "OpenAI API Key"}</span>
            <input type="password" value={form.aiImageApiKey} onChange={(e) => updateField("aiImageApiKey", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder={form.hasAiImageApiKey ? "มี key ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "..."} />
            <p className="text-xs text-slate-500">
              {form.hasAiImageApiKey
                ? "ระบบมี API key สำหรับ provider ที่บันทึกอยู่แล้ว ถ้าเปลี่ยน provider ให้กรอก key ใหม่หรือใช้ env ของ provider ใหม่"
                : form.aiImageProvider === "google"
                  ? "สามารถใส่ผ่าน env GOOGLE_API_KEY หรือ GEMINI_API_KEY แทนการบันทึกในฐานข้อมูลได้"
                  : "สามารถใส่ผ่าน env OPENAI_API_KEY แทนการบันทึกในฐานข้อมูลได้"}
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">หมายเหตุ</p>
        <ul className="mt-2 space-y-1 text-amber-800">
          <li>ถ้ายังไม่ได้บันทึกค่าในฐานข้อมูล ฟอร์มนี้จะ preload ค่าที่มีอยู่จาก env มาให้ดูก่อน</li>
          <li>ค่ากลุ่ม Supabase ยังเป็น deployment-level config และยังต้องมีใน environment เพื่อให้แอปบูตได้</li>
          <li>แต่ค่ากลุ่ม LINE, LIFF, Base URL ในหน้านี้จะถูกใช้แทน env อัตโนมัติถ้ากรอกไว้</li>
        </ul>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {form.updatedAt ? `อัปเดตล่าสุด ${formatBangkokDateTime(form.updatedAt)}` : "ยังไม่มีการบันทึกค่าจากหน้า settings"}
        </p>
        <button type="submit" disabled={saving} className="rounded-full bg-[#1a1a2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16213e] disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </form>
  );
}
