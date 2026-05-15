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
    "commercial" | "deposit" | "paid" | "balance" | "receiver" | "issueDocument" | "items" | "reject" | "rescope" | null
  >(null);
  const [itemDraft, setItemDraft] = useState<{ label: string; qty: string; unitPrice: string }>(
    { label: "", qty: "1", unitPrice: "" }
  );
  const [itemsList, setItemsList] = useState<
    Array<{ id: string; label: string; qty: number; unit_price: number; line_total: number }> | null
  >(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [paymentTermsDraft, setPaymentTermsDraft] = useState(paymentTerms);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState(paymentStatus);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState("");
  const [whtAmountDraft, setWhtAmountDraft] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");
  const [balanceBreakdown, setBalanceBreakdown] = useState<{
    total: number;
    paid: number;
    outstanding: number;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
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
    setWhtAmountDraft("");
    setBalanceBreakdown(null);
    setItemDraft({ label: "", qty: "1", unitPrice: "" });

    if (nextPanel === "items") {
      setItemsLoading(true);
      fetch(`/api/admin/quotes/${quoteId}/items`, { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "โหลดรายการไม่สำเร็จ");
          setItemsList(data.items ?? []);
        })
        .catch((err) => {
          setToast({
            tone: "error",
            title: "โหลดรายการไม่สำเร็จ",
            description: err instanceof Error ? err.message : undefined,
          });
        })
        .finally(() => setItemsLoading(false));
    }

    if (nextPanel === "rescope") {
      setNote("ลูกค้าขอปรับรายละเอียดและออกใบเสนอราคาใหม่");
      return;
    }

    if (nextPanel === "reject") {
      setNote("ลูกค้าปฏิเสธใบเสนอราคา");
      return;
    }

    if (nextPanel === "deposit" || nextPanel === "paid" || nextPanel === "balance") {
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${quoteId}-${nextPanel}-${Date.now()}-${Math.random()}`;
      setPaymentIdempotencyKey(key);
      if (nextPanel === "paid") {
        setPaymentAmountDraft(String(Number(quoteTotal || 0)));
      } else if (nextPanel === "balance") {
        // Fetch outstanding from server (don't trust client math).
        setBalanceLoading(true);
        fetch(`/api/quotes/${quoteId}/balance`, { cache: "no-store" })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "โหลด outstanding balance ไม่สำเร็จ");
            setBalanceBreakdown({
              total: Number(data.total ?? 0),
              paid: Number(data.paid ?? 0),
              outstanding: Number(data.outstanding ?? 0),
            });
            setPaymentAmountDraft(String(Number(data.outstanding ?? 0)));
          })
          .catch((err) => {
            setToast({
              tone: "error",
              title: "โหลด outstanding balance ไม่สำเร็จ",
              description: err instanceof Error ? err.message : undefined,
            });
          })
          .finally(() => {
            setBalanceLoading(false);
          });
      }
    }

    setNote("");
  }

  function closePanel() {
    setPanel(null);
    setLoading(false);
  }

  async function cloneQuote() {
    if (!confirm("ยืนยันสร้างใบเสนอราคาใหม่จากใบนี้?")) {
      return;
    }
    try {
      const payload = await callApi(
        `/api/admin/quotes/${quoteId}/clone`,
        {},
        "ทำใบใหม่ไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: "สร้างใบใหม่แล้ว",
        description: payload?.newQuoteToken
          ? `Token: ${payload.newQuoteToken}`
          : `Quote: ${payload?.newQuoteId}`,
      });
      router.refresh();
    } catch (err) {
      setToast({
        tone: "error",
        title: "ทำใบใหม่ไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function reloadItems() {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/items`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "โหลดรายการไม่สำเร็จ");
      setItemsList(data.items ?? []);
    } catch (err) {
      setToast({
        tone: "error",
        title: "โหลดรายการไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function addItem() {
    const labelTrim = itemDraft.label.trim();
    const qtyNum = Number(itemDraft.qty);
    const unitNum = Number(itemDraft.unitPrice);
    if (!labelTrim) {
      setToast({ tone: "warning", title: "ใส่ชื่อรายการก่อน" });
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setToast({ tone: "warning", title: "จำนวนต้องมากกว่า 0" });
      return;
    }
    if (!Number.isFinite(unitNum) || unitNum < 0) {
      setToast({ tone: "warning", title: "ราคา/หน่วย ต้อง ≥ 0" });
      return;
    }
    try {
      const payload = await callApi(
        `/api/admin/quotes/${quoteId}/items`,
        { label: labelTrim, qty: qtyNum, unitPrice: unitNum },
        "เพิ่มรายการไม่สำเร็จ"
      );
      setToast({
        tone: "success",
        title: "เพิ่มรายการแล้ว",
        description: `ยอดใหม่: ${Number(payload?.totals?.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
      });
      setItemDraft({ label: "", qty: "1", unitPrice: "" });
      await reloadItems();
      router.refresh();
    } catch (err) {
      setToast({
        tone: "error",
        title: "เพิ่มรายการไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function removeItem(itemId: string) {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "ลบรายการไม่สำเร็จ");
      }
      setToast({
        tone: "success",
        title: "ลบรายการแล้ว",
        description: `ยอดใหม่: ${Number(data?.totals?.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
      });
      await reloadItems();
      router.refresh();
    } catch (err) {
      setToast({
        tone: "error",
        title: "ลบรายการไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
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

    // Withholding tax (50ทวิ) per-payment. Optional; admin enters baht
    // withheld by B2B customer if any. RPC enforces amount + wht ≤ outstanding.
    const whtAmount = whtAmountDraft.trim() === "" ? 0 : Number(whtAmountDraft);
    if (!Number.isFinite(whtAmount) || whtAmount < 0) {
      setToast({
        tone: "warning",
        title: "WHT amount ไม่ถูกต้อง",
        description: "ยอดหัก ณ ที่จ่ายต้องเป็นจำนวนมากกว่าหรือเท่ากับ 0",
      });
      return;
    }

    // Balance panel: paymentAmount = outstanding - wht so that
    // amount + wht_amount == outstanding inside the RPC's cumulative check.
    // Legacy "paid" upfront panel: amount = quote.total - wht.
    const baselineForPaid =
      panel === "balance" && balanceBreakdown
        ? Number(balanceBreakdown.outstanding)
        : Number(quoteTotal || 0);
    const paymentAmount =
      nextStatus === "paid"
        ? Math.max(0, baselineForPaid - whtAmount)
        : Number(paymentAmountDraft);

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
          whtAmount,
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
  // v1 freeze: document issuance is only after full payment.
  // Deposit + partial intentionally blocked until a follow-up packet
  // teaches the issue flow to document deposit amount + Thai-tax-law
  // partial tax invoice rules. See:
  //   docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md
  //   plan/feature-commercial-documents-1.md TASK-014
  //   docs/CLAUDE_LESSONS.md L2 (Codex P1 on PR #56)
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
    canEditTerms && quoteStatus === "sent"
      ? {
          key: "items",
          label: "เพิ่ม / ลบรายการในใบเสนอราคา",
          description: "ใช้สำหรับงานหลายขนาด/หลายสินค้าในใบเดียว — ระบบจะคำนวณยอดใหม่ให้",
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
    canCapturePayment && paymentStatus === "unpaid"
      ? {
          key: "paid",
          label: "บันทึกรับชำระเต็ม",
          description: hasSelectedReceiver
            ? "ยืนยันยอดเต็ม สร้าง payment และล็อกผู้รับเงินก่อนปลดล็อก workflow"
            : "ต้องเลือกผู้รับเงินก่อนรับชำระ",
          disabled: !hasSelectedReceiver,
        }
      : null,
    (quoteStatus === "approved" || quoteStatus === "sent") &&
    paymentTerms === "deposit" &&
    paymentStatus === "partial"
      ? {
          key: "balance",
          label: "บันทึกรับชำระยอดที่เหลือ",
          description: hasSelectedReceiver
            ? "ดึง outstanding balance อัตโนมัติ → สร้าง payment ส่วนที่เหลือและปิดยอด"
            : "ต้องเลือกผู้รับเงินก่อน (ปกติล็อกอยู่แล้วจากมัดจำ)",
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
    // Reorder/clone: available on any quote that has been issued (sent or
    // beyond). Useful when a returning customer says "เอาแบบเดิม".
    quoteStatus !== "draft"
      ? {
          key: "clone",
          label: "ทำใบใหม่จากใบนี้ (เอาแบบเดิม)",
          description: "สร้าง quote ใหม่จากรายการ/ราคา/billing เดิม — เริ่ม sales cycle ใหม่",
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
          onSelect={(key) => {
            if (key === "clone") {
              void cloneQuote();
              return;
            }
            openPanel(key as typeof panel);
          }}
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
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              หัก ณ ที่จ่าย (50ทวิ) — ออปชั่น
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={whtAmountDraft}
              onChange={(event) => setWhtAmountDraft(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">
              ถ้าลูกค้านิติบุคคลหักภาษี ณ ที่จ่าย ใส่ยอดที่หักไว้ — ระบบจะนับเป็นยอดที่ชำระแล้วเช่นกัน
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
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              หัก ณ ที่จ่าย (50ทวิ) — ออปชั่น
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={whtAmountDraft}
              onChange={(event) => setWhtAmountDraft(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">
              ถ้าลูกค้าโอนน้อยกว่ายอดเต็มเพราะหัก WHT ให้ระบุยอดที่ถูกหักที่นี่ — ระบบนับรวมเป็นยอดที่ชำระแล้ว
            </p>
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "balance"}
        onClose={closePanel}
        title="บันทึกรับชำระยอดที่เหลือ"
        description="ปิดยอดส่วนที่เหลือหลังรับมัดจำ — ระบบดึง outstanding มาจาก server ไม่ให้เกินยอดใบเสนอราคา"
        badge="การเงิน"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={() => updateCommercialStatus("paid")}
              disabled={
                loading ||
                balanceLoading ||
                !balanceBreakdown ||
                balanceBreakdown.outstanding <= 0
              }
            >
              {loading ? "กำลังบันทึก..." : "ยืนยันรับชำระยอดที่เหลือ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {balanceLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              กำลังโหลดยอดคงค้าง...
            </div>
          ) : balanceBreakdown ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="uppercase tracking-wide text-slate-500">ยอดใบ</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {balanceBreakdown.total.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <p className="uppercase tracking-wide text-emerald-600">รับแล้ว</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    {balanceBreakdown.paid.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <p className="uppercase tracking-wide text-amber-600">คงเหลือ</p>
                  <p className="mt-1 text-sm font-semibold text-amber-900">
                    {balanceBreakdown.outstanding.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
              {balanceBreakdown.outstanding <= 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  ยอดนี้ชำระครบแล้ว ไม่มียอดคงค้างให้รับเพิ่ม
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  ระบบจะ insert payment row ใหม่ ยอด{" "}
                  <span className="font-semibold text-slate-950">
                    {balanceBreakdown.outstanding.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  {" "}แล้วเลื่อน quote.payment_status เป็น <code>paid</code>
                </div>
              )}
              {balanceBreakdown.outstanding > 0 ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-800">
                    หัก ณ ที่จ่าย (50ทวิ) ในยอดที่เหลือ — ออปชั่น
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={whtAmountDraft}
                    onChange={(event) => setWhtAmountDraft(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ถ้าลูกค้านิติบุคคลโอนน้อยกว่า outstanding เพราะหักภาษี — ระบุยอดหักที่นี่ เพื่อให้ amount + wht = outstanding
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              โหลดข้อมูลคงค้างไม่สำเร็จ ปิดหน้าต่างนี้แล้วลองใหม่
            </div>
          )}
        </div>
      </AdminActionSheet>

      <AdminActionSheet
        open={panel === "items"}
        onClose={closePanel}
        title="รายการในใบเสนอราคา"
        description="เพิ่ม/ลบรายการที่ต้องคิดเงิน ระบบจะคำนวณยอดรวม VAT ใหม่ทันที — เปลี่ยนได้ก่อนจะมี payment"
        badge="ใบเสนอราคา"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ปิด
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            ใช้เมื่อ: walk-in/manual intake เพิ่มสินค้าอีกขนาด, ลูกค้าขอเพิ่มงาน, หรือแก้รายการก่อนส่งใบ — ห้ามแก้หลังเก็บเงินไปแล้ว
          </div>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">รายการปัจจุบัน</h4>
            {itemsLoading ? (
              <p className="text-xs text-slate-500">กำลังโหลด...</p>
            ) : itemsList && itemsList.length > 0 ? (
              <ul className="space-y-2">
                {itemsList.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-slate-500">
                        {Number(item.qty).toLocaleString("th-TH")} ×{" "}
                        {Number(item.unit_price).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ={" "}
                        <span className="font-semibold text-slate-900">
                          {Number(item.line_total).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          บาท
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">ยังไม่มีรายการ</p>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
            <h4 className="text-sm font-semibold text-emerald-950">เพิ่มรายการใหม่</h4>
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs text-slate-700">
                <span>ชื่อรายการ</span>
                <input
                  type="text"
                  value={itemDraft.label}
                  onChange={(e) => setItemDraft((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="เช่น สติกเกอร์ 10x10 ซม. แพ็ก 50 ดวง"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  maxLength={200}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs text-slate-700">
                  <span>จำนวน</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={itemDraft.qty}
                    onChange={(e) => setItemDraft((prev) => ({ ...prev, qty: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="grid gap-1 text-xs text-slate-700">
                  <span>ราคา/หน่วย (บาท)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={itemDraft.unitPrice}
                    onChange={(e) => setItemDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void addItem()}
              disabled={loading}
              className="self-start"
            >
              {loading ? "กำลังเพิ่ม..." : "เพิ่มรายการ"}
            </Button>
          </section>
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
