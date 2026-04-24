"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SettingsState = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccountName: string;
  paymentBankName: string;
  paymentAccountNumber: string;
  paymentPromptPayId: string;
  paymentInstructions: string;
  businessLogoUrl: string;
  businessCatalogUrl: string;
  businessCatalogName: string;
  customerUploadUrl: string;
  customerUploadLabel: string;
  productionUploadEnabled: boolean;
  productionCustomerAutoSendEnabled: boolean;
  productionAssetRetentionDays: number;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
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
  paymentInstructions: "หลังโอนเงินแล้ว กรุณาส่งสลิปกลับใน LINE แชตนี้เพื่อให้ทีมงานยืนยันการชำระ",
  businessLogoUrl: "",
  businessCatalogUrl: "",
  businessCatalogName: "",
  customerUploadUrl: "",
  customerUploadLabel: "ส่งไฟล์งาน / รูปอ้างอิง",
  productionUploadEnabled: true,
  productionCustomerAutoSendEnabled: false,
  productionAssetRetentionDays: 30,
  lineChannelAccessToken: "",
  lineChannelSecret: "",
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
  const [uploadingAsset, setUploadingAsset] = useState<"" | "logo" | "catalog">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function handleAssetUpload(assetType: "logo" | "catalog", file: File | null) {
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

      setMessage("อัปโหลดไฟล์เรียบร้อยแล้ว");
    } catch {
      setError("อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploadingAsset("");
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
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>คำแนะนำการชำระเงินสำหรับลูกค้า</span>
            <textarea value={form.paymentInstructions} onChange={(e) => updateField("paymentInstructions", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น หลังโอนแล้วส่งสลิปกลับมาใน LINE แชตนี้" />
            <p className="text-xs text-slate-500">ข้อมูลชุดนี้จะไปแสดงในหน้าใบเสนอราคาและหน้าเอกสารดาวน์โหลดของลูกค้า</p>
          </label>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>โลโก้ร้าน</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleAssetUpload("logo", e.target.files?.[0] || null)} className="block text-sm" />
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
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => handleAssetUpload("catalog", e.target.files?.[0] || null)} className="block text-sm" />
              {uploadingAsset === "catalog" ? <span className="text-xs text-slate-500">กำลังอัปโหลด...</span> : null}
              {form.businessCatalogUrl ? <a href={form.businessCatalogUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">เปิดไฟล์ร้าน</a> : null}
            </div>
            {form.businessCatalogName ? <p className="text-xs text-slate-500">ไฟล์ล่าสุด: {form.businessCatalogName}</p> : null}
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
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">LINE Messaging API และ LINE MINI App</h2>
        <p className="mt-1 text-sm text-slate-500">กรอกค่าที่เจ้าของระบบได้จาก LINE Developers Console เพื่อให้ระบบส่งข้อความและเปิด LINE MINI App ที่ทำงานบน LIFF SDK ได้โดยไม่ต้องแก้ไฟล์ env</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LINE Channel Access Token</span>
            <textarea value={form.lineChannelAccessToken} onChange={(e) => updateField("lineChannelAccessToken", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ใส่ค่าจาก Messaging API" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LINE Channel Secret</span>
            <input type="password" value={form.lineChannelSecret} onChange={(e) => updateField("lineChannelSecret", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ใส่ค่าจาก Messaging API" />
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
        <h2 className="text-lg font-semibold text-slate-950">AI สร้างรูป</h2>
        <p className="mt-1 text-sm text-slate-600">แนะนำใช้ OpenAI `gpt-image-1` กับแอป Next.js บน Vercel เพราะเรียกผ่าน route handler ได้ตรงและไม่ต้องเพิ่ม queue/provider เสริมในรอบแรก</p>
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
            <select value={form.aiImageProvider} onChange={(e) => updateField("aiImageProvider", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400">
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>Model</span>
            <input value={form.aiImageModel} onChange={(e) => updateField("aiImageModel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="gpt-image-1" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>OpenAI API Key</span>
            <input type="password" value={form.aiImageApiKey} onChange={(e) => updateField("aiImageApiKey", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder={form.hasAiImageApiKey ? "มี key ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "sk-..."} />
            <p className="text-xs text-slate-500">{form.hasAiImageApiKey ? "ระบบมี API key อยู่แล้ว ถ้าปล่อยว่างจะเก็บค่าปัจจุบันไว้" : "สามารถใส่ผ่าน env OPENAI_API_KEY แทนการบันทึกในฐานข้อมูลได้"}</p>
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
          {form.updatedAt ? `อัปเดตล่าสุด ${new Date(form.updatedAt).toLocaleString("th-TH")}` : "ยังไม่มีการบันทึกค่าจากหน้า settings"}
        </p>
        <button type="submit" disabled={saving} className="rounded-full bg-[#1a1a2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16213e] disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </form>
  );
}
