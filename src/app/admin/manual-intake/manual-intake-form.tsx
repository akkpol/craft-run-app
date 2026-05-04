"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BILLING_ENTITY_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPE_LABELS,
  FULFILLMENT_MODE_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  UNITS,
  type BillingEntityType,
  type DocumentRequestType,
  type FulfillmentMode,
  type PaymentTerm,
  type UnitType,
} from "@/lib/types";

type ManualIntakeResult = {
  success: boolean;
  customerId: string;
  leadId: string;
  quoteId: string | null;
  quoteUrl: string | null;
  total?: number;
  nextState: string;
};

const sourceOptions = [
  { value: "walk_in", label: "หน้าร้าน" },
  { value: "phone", label: "โทรศัพท์" },
  { value: "facebook", label: "Facebook" },
  { value: "email", label: "อีเมล" },
  { value: "other", label: "อื่น ๆ" },
] as const;

const paymentTerms = Object.entries(PAYMENT_TERM_LABELS) as Array<[PaymentTerm, string]>;
const documentTypes = Object.entries(DOCUMENT_REQUEST_TYPE_LABELS) as Array<[DocumentRequestType, string]>;
const billingEntityTypes = Object.entries(BILLING_ENTITY_TYPE_LABELS) as Array<[BillingEntityType, string]>;
const fulfillmentModes = Object.entries(FULFILLMENT_MODE_LABELS) as Array<[FulfillmentMode, string]>;

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
      >
        {children}
      </select>
    </label>
  );
}

function TextField({ label, name, type = "text", required = false, placeholder }: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <Input name={name} type={type} required={required} placeholder={placeholder} className="border-slate-200 bg-white" />
    </label>
  );
}

export default function ManualIntakeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualIntakeResult | null>(null);
  const [createQuote, setCreateQuote] = useState(true);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/admin/manual-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, createQuote }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "บันทึกงาน manual ไม่สำเร็จ");
      }

      setResult(data);
      event.currentTarget.reset();
      setCreateQuote(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "บันทึกงาน manual ไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <TextField label="ชื่อลูกค้า" name="customerName" required placeholder="ชื่อหน้าร้าน / บริษัท / ผู้ติดต่อ" />
        <SelectField label="ช่องทางที่เข้ามา" name="source" defaultValue="walk_in">
          {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <TextField label="เบอร์โทร" name="phone" placeholder="ใช้เป็นช่องทางติดต่อหลัก" />
        <TextField label="อีเมล" name="email" type="email" placeholder="ถ้ามี" />
      </section>

      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <SelectField label="ประเภทงาน" name="productType" defaultValue="vinyl_banner">
          {PRODUCT_TYPES.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}
        </SelectField>
        <TextField label="กว้าง" name="width" type="number" required placeholder="เช่น 120" />
        <TextField label="สูง" name="height" type="number" required placeholder="เช่น 80" />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          หน่วย
          <select name="unit" defaultValue="cm" className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400">
            {UNITS.map((unit: { value: UnitType; label: string }) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
          </select>
        </label>
        <TextField label="จำนวน" name="qty" type="number" required placeholder="1" />
        <TextField label="กำหนดส่ง" name="dueDate" type="date" />
        <SelectField label="การรับงาน" name="fulfillmentMode" defaultValue="delivery">
          {fulfillmentModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <SelectField label="เงื่อนไขชำระเงิน" name="paymentTerms" defaultValue="prepaid">
          {paymentTerms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <SelectField label="เอกสารที่ลูกค้าต้องการ" name="requestedDocumentType" defaultValue="quote">
          {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <SelectField label="ประเภทลูกค้าเอกสาร" name="billingEntityType" defaultValue="person">
          {billingEntityTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
        <TextField label="ชื่อออกเอกสาร" name="billingName" placeholder="ถ้าไม่กรอก ระบบใช้ชื่อลูกค้า" />
        <TextField label="เลขผู้เสียภาษี" name="taxId" placeholder="ต้องมีเมื่อขอใบกำกับภาษี" />
        <TextField label="รหัสสาขา" name="billingBranchCode" placeholder="ถ้ามี" />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ที่อยู่ออกเอกสาร
          <Textarea name="billingAddress" rows={3} className="border-slate-200 bg-white" />
        </label>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          รายละเอียดงาน / โน้ตจากลูกค้า
          <Textarea name="note" rows={5} className="border-slate-200 bg-white" placeholder="พิมพ์รายละเอียดจากโทรศัพท์ หน้าร้าน หรือแชทอื่น" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Design brief
          <Textarea name="designBrief" rows={5} className="border-slate-200 bg-white" placeholder="สิ่งที่ทีมออกแบบต้องรู้" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Prompt / reference สำหรับ AI หรือ Studio
          <Textarea name="aiImagePrompt" rows={5} className="border-slate-200 bg-white" placeholder="ใส่พรอมพ์ดิบ ถ้ามี" />
        </label>
        <TextField label="ลิงก์ไฟล์หรือ reference" name="referenceInfo" placeholder="Google Drive, Facebook link, หรือ note อื่น" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={createQuote}
            onChange={(event) => setCreateQuote(event.target.checked)}
            className="mt-1 size-4 rounded border-slate-300"
          />
          <span>
            <span className="block font-semibold text-slate-950">สร้าง quote ให้ทันที</span>
            <span className="block text-xs leading-5 text-slate-500">ถ้าปิดไว้ ระบบจะสร้าง lead แล้วจอดไว้ที่คิวตรวจ requirement</span>
          </span>
        </label>
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกงาน manual"}
        </Button>
      </section>

      {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 whitespace-pre-wrap">{error}</div> : null}

      {result ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
          <p className="font-semibold">สร้างงาน manual แล้ว</p>
          <p>Lead: {result.leadId}</p>
          {result.quoteUrl ? <p>Quote: <a href={result.quoteUrl} target="_blank" rel="noreferrer" className="font-semibold underline">เปิดลิงก์ใบเสนอราคา</a></p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/customers/${result.customerId}`} className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900">เปิดโปรไฟล์ลูกค้า</Link>
            <Link href="/admin?filter=new-leads" className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900">กลับไปคิว CRM</Link>
          </div>
        </div>
      ) : null}
    </form>
  );
}
