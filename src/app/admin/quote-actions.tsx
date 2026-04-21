"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_TERMS,
  type PaymentTerm,
} from "@/lib/types";
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
  paymentTerms: PaymentTerm;
  paymentStatus: keyof typeof PAYMENT_STATUS_LABELS;
  hasJob: boolean;
};

export default function AdminQuoteActions({
  quoteId,
  publicToken,
  quoteStatus,
  paymentTerms,
  paymentStatus,
  hasJob,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [panel, setPanel] = useState<
    "commercial" | "deposit" | "paid" | "reject" | "rescope" | null
  >(null);
  const [paymentTermsDraft, setPaymentTermsDraft] = useState(paymentTerms);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState(paymentStatus);
  const [note, setNote] = useState("");
  const router = useRouter();

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

    if (nextPanel === "rescope") {
      setNote("ลูกค้าขอปรับรายละเอียดและออกใบเสนอราคาใหม่");
      return;
    }

    if (nextPanel === "reject") {
      setNote("ลูกค้าปฏิเสธใบเสนอราคา");
      return;
    }

    setNote("");
  }

  function closePanel() {
    setPanel(null);
    setLoading(false);
  }

  async function updateCommercial() {
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
    try {
      const payload = await callApi(
        `/api/quotes/${quoteId}/commercial`,
        { paymentStatus: nextStatus },
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

  const canEditTerms = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");
  const canCapturePayment = !hasJob && quoteStatus === "approved" && paymentTerms !== "credit";
  const canRejectQuote = !hasJob && quoteStatus === "sent";
  const canRescopeQuote = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");

  const actions = [
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
          description: "ปรับสถานะเป็นรับมัดจำแล้ว และเช็กว่า workflow ต้องปลดล็อกหรือยัง",
        }
      : null,
    canCapturePayment && paymentStatus !== "paid"
      ? {
          key: "paid",
          label: "บันทึกรับชำระเต็ม",
          description: "อัปเดตสถานะชำระเงินและปลดล็อกงานถ้าพร้อมแล้ว",
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
      <AdminActionMenu
        actions={actions}
        onSelect={(key) => openPanel(key as typeof panel)}
        disabled={loading}
        compact
        label="จัดการ"
      />

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
            <label className="mb-2 block text-sm font-medium text-slate-800">เงื่อนไขชำระเงิน</label>
            <select
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
            <label className="mb-2 block text-sm font-medium text-slate-800">สถานะชำระเงิน</label>
            <select
              value={paymentStatusDraft}
              onChange={(event) =>
                setPaymentStatusDraft(event.target.value as Props["paymentStatus"])
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          หลังบันทึกรับมัดจำ quote นี้อาจถูกปลดล็อกไปสู่ขั้นตอนออกแบบทันที ถ้าเงื่อนไขการชำระเงินรองรับ
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          ถ้า payment gate ปลดล็อกได้ ระบบจะสร้างงานต่อให้ตาม logic เดิมของ quote workflow
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
          <label className="block text-sm font-medium text-slate-800">เหตุผลหรือสิ่งที่ต้องแก้</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
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
          <label className="block text-sm font-medium text-slate-800">เหตุผล</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}