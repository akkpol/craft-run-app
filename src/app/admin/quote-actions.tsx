"use client";

import { useId, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_TERMS,
  type PaymentTerm,
} from "@/lib/types";
import {
  getCommercialReceiverLabel,
  getCommercialReceiverWarnings,
  type CommercialOrderReceiverState,
  type CommercialReceiverEntityOption,
  type CommercialReceiverWarning,
} from "@/lib/commercial-receiver-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type Props = {
  quoteId: string;
  publicToken: string;
  quoteStatus: string;
  quoteTotal?: number;
  paymentTerms: PaymentTerm;
  paymentStatus: keyof typeof PAYMENT_STATUS_LABELS;
  hasJob: boolean;
  requestedDocumentType?: string | null;
  commercialOrder?: CommercialOrderReceiverState | null;
  commercialReceiverEntities?: CommercialReceiverEntityOption[];
};

function receiverWarningClass(warning: CommercialReceiverWarning) {
  return cn(
    "rounded-xl border px-3 py-2 text-xs leading-5",
    warning.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning.tone === "info" && "border-sky-200 bg-sky-50 text-sky-900",
    warning.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
    warning.tone === "danger" && "border-rose-200 bg-rose-50 text-rose-900"
  );
}

function receiverStatusClass(tone: "missing" | "selected" | "locked") {
  return cn(
    "max-w-52 truncate rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
    tone === "missing" && "border-amber-200 bg-amber-50 text-amber-800",
    tone === "selected" && "border-sky-200 bg-sky-50 text-sky-800",
    tone === "locked" && "border-slate-300 bg-slate-100 text-slate-700"
  );
}

export default function AdminQuoteActions({
  quoteId,
  publicToken,
  quoteStatus,
  quoteTotal = 0,
  paymentTerms,
  paymentStatus,
  hasJob,
  requestedDocumentType = null,
  commercialOrder = null,
  commercialReceiverEntities = [],
  buttonVariant = "outline",
  buttonLabel = "ดูแล quote",
}: Props & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [panel, setPanel] = useState<
    "commercial" | "deposit" | "paid" | "receiver" | "issueDocument" | "reject" | "rescope" | null
  >(null);
  const [paymentTermsDraft, setPaymentTermsDraft] = useState(paymentTerms);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState(paymentStatus);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");
  const [receiverEntityIdDraft, setReceiverEntityIdDraft] = useState(
    commercialOrder?.selectedReceiverEntityId || ""
  );
  const [note, setNote] = useState("");
  const paymentTermsSelectId = useId();
  const paymentStatusSelectId = useId();
  const paymentAmountInputId = useId();
  const router = useRouter();

  const selectedReceiverEntity =
    commercialReceiverEntities.find((entity) => entity.id === receiverEntityIdDraft) || null;
  const savedReceiverEntity =
    commercialReceiverEntities.find(
      (entity) => entity.id === commercialOrder?.selectedReceiverEntityId
    ) || null;
  const receiverLocked = Boolean(commercialOrder?.paymentReceiverLockedAt);
  const confirmedPaymentId = commercialOrder?.confirmedPaymentId || null;
  const issuedDocumentId = commercialOrder?.issuedDocumentId || null;
  const issuedDocumentType = commercialOrder?.issuedDocumentType || null;
  const issuedDocumentNumber = commercialOrder?.issuedDocumentNumber || null;
  const hasSelectedReceiver = Boolean(commercialOrder?.selectedReceiverEntityId);
  const receivedStatusSelected =
    paymentStatusDraft === "partial" || paymentStatusDraft === "paid";
  const receiverWarnings = getCommercialReceiverWarnings({
    selectedEntity: selectedReceiverEntity,
    requestedDocumentType,
    customerTaxProfileId: commercialOrder?.customerTaxProfileId || null,
    paymentReceiverLockedAt: commercialOrder?.paymentReceiverLockedAt || null,
  });

  async function callApi(url: string, body: unknown, errorLabel: string) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || errorLabel);
      }
      return data;
    } finally {
      setLoading(false);
    }
  }

  function openPanel(nextPanel: typeof panel) {
    setPanel(nextPanel);
    setPaymentTermsDraft(paymentTerms);
    setPaymentStatusDraft(paymentStatus);
    setReceiverEntityIdDraft(commercialOrder?.selectedReceiverEntityId || "");
    setPaymentIdempotencyKey("");
    setPaymentAmountDraft("");

    if (nextPanel === "rescope") {
      setNote("ลูกค้าขอปรับรายละเอียดและออกใบเสนอราคาใหม่");
      return;
    }

    if (nextPanel === "reject") {
      setNote("ลูกค้าปฏิเสธใบเสนอราคา");
      return;
    }

    if (nextPanel === "deposit" || nextPanel === "paid") {
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${quoteId}-${nextPanel}-${Date.now()}-${Math.random()}`;
      setPaymentIdempotencyKey(key);
      setPaymentAmountDraft(nextPanel === "paid" ? String(Number(quoteTotal || 0)) : "");
    }

    setNote("");
  }

  function closePanel() {
    setPanel(null);
    setLoading(false);
  }

  async function updateCommercial() {
    if (receivedStatusSelected) {
      setToast({
        tone: "warning",
        title: "ใช้ขั้นตอนรับเงินแยกต่างหาก",
        description: "ต้องเลือกผู้รับเงินและยืนยัน payment ผ่านปุ่มรับมัดจำ/รับชำระเต็ม",
      });
      return;
    }

    try {
      const payload = await callApi(
        `/api/quotes/${quoteId}/commercial`,
        { paymentTerms: paymentTermsDraft, paymentStatus: paymentStatusDraft },
        "อัปเดตเงื่อนไขการชำระเงินไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: "อัปเดตข้อมูลการเงินแล้ว",
        description: payload?.jobCreated
          ? "ระบบสร้างงานให้แล้วเพราะเงื่อนไขการชำระเงินปลดล็อกการผลิต"
          : `${PAYMENT_TERM_LABELS[paymentTermsDraft]} · ${PAYMENT_STATUS_LABELS[paymentStatusDraft]}`,
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปเดตข้อมูลการเงินไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function updateCommercialStatus(nextStatus: Props["paymentStatus"]) {
    if (!hasSelectedReceiver) {
      setToast({
        tone: "warning",
        title: "ต้องเลือกผู้รับเงินก่อน",
        description: "ลำดับที่ปลอดภัยคือเลือกผู้รับเงิน แล้วค่อยยืนยันรับเงิน",
      });
      return;
    }

    const paymentAmount =
      nextStatus === "paid" ? Number(quoteTotal || 0) : Number(paymentAmountDraft);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setToast({
        tone: "warning",
        title: nextStatus === "partial" ? "กรอกยอดมัดจำก่อน" : "ยอดชำระไม่ถูกต้อง",
        description: "ยอดรับชำระต้องมากกว่า 0",
      });
      return;
    }

    if (!paymentIdempotencyKey) {
      setToast({
        tone: "error",
        title: "ไม่พบ payment idempotency key",
        description: "ปิดแผงนี้แล้วเปิดใหม่ก่อนยืนยันรับเงิน",
      });
      return;
    }

    try {
      const payload = await callApi(
        `/api/quotes/${quoteId}/commercial`,
        {
          paymentStatus: nextStatus,
          paymentAmount,
          paymentIdempotencyKey,
        },
        "บันทึกสถานะชำระเงินไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: nextStatus === "partial" ? "บันทึกรับมัดจำแล้ว" : "บันทึกรับชำระแล้ว",
        description: payload?.jobCreated
          ? "ระบบปลดล็อกการผลิตและสร้างงานให้แล้ว"
          : PAYMENT_STATUS_LABELS[nextStatus],
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "บันทึกสถานะชำระเงินไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function updateReceiverEntity() {
    if (!receiverEntityIdDraft) {
      setToast({
        tone: "warning",
        title: "ยังไม่ได้เลือกผู้รับเงิน",
      });
      return;
    }

    try {
      await callApi(
        "/api/commercial/select-receiver",
        {
          orderId: commercialOrder?.id || undefined,
          quoteId,
          receiverEntityId: receiverEntityIdDraft,
        },
        "เลือกผู้รับเงินไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: "เลือกผู้รับเงิน/ผู้ออกเอกสารแล้ว",
        description: getCommercialReceiverLabel(selectedReceiverEntity),
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "เลือกผู้รับเงินไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function submitQuoteAction(action: "reject_quote" | "rescope_quote") {
    try {
      await callApi(
        `/api/quotes/public/${publicToken}`,
        { action, note: note.trim() || undefined },
        "อัปเดตใบเสนอราคาไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: action === "rescope_quote" ? "ส่งคำขอปรับรายละเอียดแล้ว" : "ปฏิเสธใบเสนอราคาแล้ว",
        description: note.trim() || undefined,
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปเดตใบเสนอราคาไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function issueCommercialDocument() {
    if (!confirmedPaymentId) {
      setToast({
        tone: "warning",
        title: "ยังไม่มี payment ที่ยืนยันแล้ว",
        description: "ต้องยืนยันรับชำระก่อน จึงจะออกเอกสารเชิงพาณิชย์ได้",
      });
      return;
    }

    try {
      const payload = await callApi(
        "/api/commercial/documents/issue",
        { paymentId: confirmedPaymentId },
        "ออกเอกสารเชิงพาณิชย์ไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: "ออกเอกสารหลังรับชำระแล้ว",
        description:
          payload?.documentNumber || payload?.documentType || "Commercial document issued",
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "ออกเอกสารเชิงพาณิชย์ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const canEditTerms = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");
  const canCapturePayment = !hasJob && quoteStatus === "approved" && paymentTerms !== "credit";
  const canRejectQuote = !hasJob && quoteStatus === "sent";
  const canRescopeQuote = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");
  const canShowReceiverAction =
    commercialReceiverEntities.length > 0 &&
    (receiverLocked || (!hasJob && (quoteStatus === "sent" || quoteStatus === "approved")));
  const canIssueCommercialDocument =
    Boolean(confirmedPaymentId) &&
    !issuedDocumentId &&
    requestedDocumentType !== "quote" &&
    paymentStatus === "paid";
  const receiverStatusTone = receiverLocked
    ? "locked"
    : commercialOrder?.selectedReceiverEntityId
      ? "selected"
      : "missing";
  const receiverStatusLabel = receiverLocked
    ? `ล็อก: ${getCommercialReceiverLabel(savedReceiverEntity)}`
    : commercialOrder?.selectedReceiverEntityId
      ? `ผู้รับเงิน: ${getCommercialReceiverLabel(savedReceiverEntity)}`
      : "ยังไม่เลือกผู้รับเงิน";
  const effectiveButtonLabel =
    canShowReceiverAction && receiverStatusTone === "missing"
      ? "เลือกผู้รับเงิน"
      : buttonLabel;

  const actions = [
    canShowReceiverAction
      ? {
          key: "receiver",
          label: receiverLocked
            ? "ดูผู้รับเงินที่ล็อกแล้ว"
            : "เลือกผู้รับเงิน/ผู้ออกเอกสาร",
          description: receiverLocked
            ? getCommercialReceiverLabel(savedReceiverEntity)
            : "ใช้ก่อนยืนยัน payment เพื่อให้เอกสารออกชื่อเดียวกับผู้รับเงิน",
        }
      : null,
    canIssueCommercialDocument
      ? {
          key: "issueDocument",
          label: "ออกเอกสารหลังรับชำระ",
          description:
            requestedDocumentType === "tax_invoice"
              ? "สร้างใบเสร็จรับเงิน/ใบกำกับภาษีจาก receiver ที่ถูก lock แล้ว"
              : "สร้างใบเสร็จรับเงินจาก receiver ที่ถูก lock แล้ว",
        }
      : null,
    canEditTerms
      ? {
          key: "commercial",
          label: "อัปเดตเงื่อนไขการชำระเงิน",
          description: `${PAYMENT_TERM_LABELS[paymentTerms]} · ${PAYMENT_STATUS_LABELS[paymentStatus]}`,
        }
      : null,
    canCapturePayment && paymentTerms === "deposit" && paymentStatus === "unpaid"
      ? {
          key: "deposit",
          label: "บันทึกรับมัดจำ",
          description: hasSelectedReceiver
            ? "ยืนยันยอดมัดจำ สร้าง payment และล็อกผู้รับเงินก่อนปลดล็อก workflow"
            : "ต้องเลือกผู้รับเงินก่อนรับมัดจำ",
          disabled: !hasSelectedReceiver,
        }
      : null,
    canCapturePayment && paymentStatus !== "paid"
      ? {
          key: "paid",
          label: "บันทึกรับชำระเต็ม",
          description: hasSelectedReceiver
            ? "ยืนยันยอดเต็ม สร้าง payment และล็อกผู้รับเงินก่อนปลดล็อก workflow"
            : "ต้องเลือกผู้รับเงินก่อนรับชำระ",
          disabled: !hasSelectedReceiver,
        }
      : null,
    canRescopeQuote
      ? {
          key: "rescope",
          label: "ขอปรับรายละเอียด",
          description: "พา quote กลับไปที่ flow ทบทวนรายละเอียดเดิม",
        }
      : null,
    canRejectQuote
      ? {
          key: "reject",
          label: "ปฏิเสธใบเสนอราคา",
          description: "ปิด quote ชุดนี้และย้าย workflow ไปที่ยกเลิก",
          tone: "destructive" as const,
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <>
      <div className="inline-flex flex-col items-end gap-1.5">
        {canShowReceiverAction ? (
          <span className={receiverStatusClass(receiverStatusTone)} title={receiverStatusLabel}>
            {receiverStatusLabel}
          </span>
        ) : null}
        {issuedDocumentId ? (
          <a
            href={`/commercial/documents/${issuedDocumentId}/download`}
            target="_blank"
            rel="noreferrer"
            className="max-w-52 truncate rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 transition-colors"
            title={issuedDocumentNumber || issuedDocumentType || "issued"}
          >
            ออกเอกสารแล้ว{issuedDocumentNumber ? `: ${issuedDocumentNumber}` : ""} ↗
          </a>
        ) : null}
        <AdminActionMenu
          actions={actions}
          onSelect={(key) => openPanel(key as typeof panel)}
          disabled={loading}
          compact
          label={effectiveButtonLabel}
          buttonVariant={buttonVariant}
        />

        <AdminActionSheet
          open={panel === "issueDocument"}
          onClose={closePanel}
          title="ออกเอกสารหลังรับชำระ"
          description="ใช้ confirmed payment และ receiver ที่ถูก lock เพื่อสร้างเอกสารตาม policy v1"
          badge="Commercial"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closePanel}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={issueCommercialDocument} disabled={loading || !confirmedPaymentId}>
                {loading ? "กำลังออกเอกสาร..." : "ออกเอกสารตอนนี้"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p>
                เอกสารที่จะออก: <span className="font-semibold text-slate-950">
                  {requestedDocumentType === "tax_invoice"
                    ? "ใบเสร็จรับเงิน/ใบกำกับภาษี"
                    : "ใบเสร็จรับเงิน"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ระบบจะใช้ receiver ที่ถูกล็อกหลังยืนยัน payment เท่านั้น
              </p>
            </div>

            {receiverWarnings.length > 0 ? (
              <div className="space-y-2">
                {receiverWarnings.map((warning) => (
                  <div key={`${warning.tone}-${warning.message}`} className={receiverWarningClass(warning)}>
                    {warning.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </AdminActionSheet>
      </div>

      <AdminActionSheet
        open={panel === "commercial"}
        onClose={closePanel}
        title="อัปเดตเงื่อนไขการชำระเงิน"
        description="แก้ payment term และสถานะชำระเงินจากหน้าเดียว โดยยังใช้ logic เดิมของ quote workflow"
        badge="การเงิน"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={updateCommercial} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            ปัจจุบัน: {PAYMENT_TERM_LABELS[paymentTerms]} · {PAYMENT_STATUS_LABELS[paymentStatus]}
          </div>

          <div>
            <label htmlFor={paymentTermsSelectId} className="mb-2 block text-sm font-medium text-slate-800">เงื่อนไขชำระเงิน</label>
            <select
              id={paymentTermsSelectId}
              value={paymentTermsDraft}
              onChange={(event) => setPaymentTermsDraft(event.target.value as PaymentTerm)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {PAYMENT_TERMS.map((term) => (
                <option key={term} value={term}>
                  {PAYMENT_TERM_LABELS[term]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={paymentStatusSelectId} className="mb-2 block text-sm font-medium text-slate-800">สถานะชำระเงิน</label>
            <select
              id={paymentStatusSelectId}
              value={paymentStatusDraft}
              onChange={(event) =>
                setPaymentStatusDraft(event.target.value as Props["paymentStatus"])
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status} disabled={status === "partial" || status === "paid"}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              สถานะ paid/partial ต้องใช้ขั้นตอนรับเงิน เพื่อสร้าง payment และล็อกผู้รับเงินก่อน
            </p>
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "deposit"}
        onClose={closePanel}
        title="บันทึกรับมัดจำ"
        description="ระบบจะอัปเดตสถานะชำระเงินเป็นรับมัดจำแล้ว และปลดล็อกงานทันทีถ้าเงื่อนไขครบ"
        badge="การเงิน"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={() => updateCommercialStatus("partial")} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "ยืนยันรับมัดจำ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            ระบบจะสร้าง confirmed payment และล็อกผู้รับเงินก่อน จึงค่อยปลดล็อก workflow
          </div>
          <div>
            <label htmlFor={paymentAmountInputId} className="mb-2 block text-sm font-medium text-slate-800">
              ยอดมัดจำที่รับจริง
            </label>
            <input
              id={paymentAmountInputId}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paymentAmountDraft}
              onChange={(event) => setPaymentAmountDraft(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="0.00"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              ยอดรวม quote: {Number(quoteTotal || 0).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} บาท
            </p>
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "paid"}
        onClose={closePanel}
        title="บันทึกรับชำระเต็ม"
        description="ใช้เมื่อทีมยืนยันว่าเก็บเงินครบแล้ว และพร้อมปล่อย workflow ต่อ"
        badge="การเงิน"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={() => updateCommercialStatus("paid")} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "ยืนยันชำระครบ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            ระบบจะยืนยัน payment เต็มจำนวน สร้าง lock ผู้รับเงิน แล้วค่อยสร้างงานต่อถ้า gate ปลดล็อกได้
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            ยอดรับชำระเต็ม:{" "}
            <span className="font-semibold text-slate-950">
              {Number(quoteTotal || 0).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} บาท
            </span>
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "receiver"}
        onClose={closePanel}
        title="เลือกผู้รับเงิน/ผู้ออกเอกสาร"
        description="เงินเข้าใคร เอกสารหลังรับเงินต้องออกชื่อนั้น เลือกได้จนกว่า payment จะถูกยืนยันและ lock"
        badge="Commercial Policy"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ปิด
            </Button>
            <Button
              type="button"
              onClick={updateReceiverEntity}
              disabled={loading || receiverLocked || !receiverEntityIdDraft}
            >
              {loading ? "กำลังบันทึก..." : receiverLocked ? "ล็อกแล้ว" : "บันทึกผู้รับเงิน"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            ปัจจุบัน: {getCommercialReceiverLabel(savedReceiverEntity)}
          </div>

          <div className="space-y-2" aria-live="polite">
            <p className="text-sm font-medium text-slate-800">ผลต่อเอกสารหลังรับเงิน</p>
            {receiverWarnings.map((warning) => (
              <div key={warning.message} className={receiverWarningClass(warning)}>
                {warning.message}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">ผู้รับเงิน</p>
            {commercialReceiverEntities.map((entity) => {
              const selected = receiverEntityIdDraft === entity.id;
              return (
                <button
                  key={entity.id}
                  type="button"
                  disabled={receiverLocked || !entity.active}
                  onClick={() => setReceiverEntityIdDraft(entity.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    selected
                      ? "border-sky-300 bg-sky-50 text-sky-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    (!entity.active || receiverLocked) && "cursor-not-allowed opacity-70"
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{entity.displayName}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {entity.legalName} · {entity.role} · {entity.isVatRegistered ? "จด VAT" : "ไม่จด VAT"}
                    </span>
                  </span>
                  <span className="mt-0.5 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500">
                    {entity.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "rescope"}
        onClose={closePanel}
        title="ส่งกลับไปปรับรายละเอียด"
        description="ใช้เมื่อจำเป็นต้องกลับไปทบทวน requirement เดิมก่อนออก quote รอบใหม่"
        badge="การขาย"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={() => submitQuoteAction("rescope_quote")} disabled={loading}>
              {loading ? "กำลังส่ง..." : "ยืนยันส่งกลับรีสโคป"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <p className="font-medium">Quote ชุดนี้จะถูกส่งกลับเพื่อทบทวน</p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              workflow จะย้อนกลับไปที่ขั้นตอนทบทวนรายละเอียด และต้องออก quote รอบใหม่ก่อนดำเนินการต่อ
            </p>
          </div>
          <label className="block text-sm font-medium text-slate-800">เหตุผลหรือสิ่งที่ต้องแก้</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "reject"}
        onClose={closePanel}
        title="ปฏิเสธใบเสนอราคา"
        description="ใช้เมื่อต้องปิด quote ชุดนี้โดยไม่สร้างงานต่อ พร้อมบันทึกเหตุผลให้ทีมตามย้อนกลับได้"
        badge="การขาย"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" variant="destructive" onClick={() => submitQuoteAction("reject_quote")} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "ยืนยันปฏิเสธ quote"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
            <p className="font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <p className="mt-1 text-xs leading-5 text-rose-700">
              Quote จะถูกปิดถาวรและ workflow จะเข้าสู่สถานะ ยกเลิก — ต้องเริ่ม quote ใหม่ถ้าลูกค้าเปลี่ยนใจ
            </p>
          </div>
          <label className="block text-sm font-medium text-slate-800">เหตุผล</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
