"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type DesignActionStatus =
  | "preview_sent"
  | "approved"
  | "revision_requested"
  | "drafting"
  | "not_started";

type Props = {
  leadId: string;
  designStatus: string;
};

export default function AdminLeadDesignActions({ leadId, designStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nextStatus, setNextStatus] = useState<DesignActionStatus | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);

  const defaults: Record<DesignActionStatus, string> = {
    preview_sent: "แอดมิน mark ว่าส่งแบบให้ลูกค้าตรวจแล้ว",
    approved: "แอดมิน mark ว่าลูกค้าอนุมัติแบบแล้ว",
    revision_requested: "ลูกค้าขอแก้แบบ",
    drafting: "รีเซ็ตกลับ drafting",
    not_started: "รีเซ็ตกลับ not_started",
  };

  const labels: Record<DesignActionStatus, string> = {
    preview_sent: "ส่งแบบให้ลูกค้าตรวจ",
    approved: "ยืนยันว่าแบบอนุมัติแล้ว",
    revision_requested: "บันทึกว่าลูกค้าขอแก้แบบ",
    drafting: "รีเซ็ตกลับ drafting",
    not_started: "รีเซ็ตกลับ not started",
  };

  function openAction(status: DesignActionStatus) {
    setNextStatus(status);
    setNote(defaults[status]);
  }

  function closePanel() {
    setNextStatus(null);
    setLoading(false);
  }

  async function updateDesignStatus() {
    if (!nextStatus) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/design-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designStatus: nextStatus, note: note.trim() || undefined }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "อัปเดตสถานะแบบไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "อัปเดตสถานะแบบแล้ว",
        description: labels[nextStatus],
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปเดตสถานะแบบไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  const isPreviewOrRevision = designStatus === "preview_sent" || designStatus === "revision_requested";
  const isApproved = designStatus === "approved";
  const isDraftingOrNotStarted = designStatus === "drafting" || designStatus === "not_started";
  const actions = [
    {
      key: "preview_sent",
      label: labels.preview_sent,
      description: "ย้ายงานไปสถานะรอลูกค้าตรวจแบบ",
      disabled: designStatus === "preview_sent",
    },
    (isPreviewOrRevision || isApproved)
      ? {
          key: "revision_requested",
          label: labels.revision_requested,
          description: "บันทึกว่าลูกค้ายังต้องการแก้แบบเพิ่มเติม",
          disabled: designStatus === "revision_requested",
        }
      : null,
    !isDraftingOrNotStarted
      ? {
          key: "drafting",
          label: labels.drafting,
          description: "ดึงสถานะกลับมาฝั่งทีมเพื่อทำแบบต่อ",
        }
      : null,
    {
      key: "approved",
      label: labels.approved,
      description: "ใช้เมื่อทีมยืนยันว่าแบบผ่านแล้วและพร้อมไปต่อ",
      disabled: designStatus === "approved",
    },
    !isDraftingOrNotStarted
      ? {
          key: "not_started",
          label: labels.not_started,
          description: "รีเซ็ตงานออกแบบกลับไปจุดเริ่มต้น",
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <>
      <AdminActionMenu
        actions={actions}
        onSelect={(key) => openAction(key as DesignActionStatus)}
        disabled={loading}
        compact
        label="จัดการ"
      />

      <AdminActionSheet
        open={Boolean(nextStatus)}
        onClose={closePanel}
        title={nextStatus ? labels[nextStatus] : "จัดการสถานะแบบ"}
        description="บันทึกการเปลี่ยนสถานะแบบพร้อมหมายเหตุ โดยยังใช้ route และ workflow logic เดิมของ lead"
        badge="Design"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={updateDesignStatus} disabled={loading || !nextStatus}>
              {loading ? "กำลังบันทึก..." : "ยืนยันอัปเดตสถานะแบบ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            สถานะปัจจุบัน: {designStatus}
          </div>
          <label className="block text-sm font-medium text-slate-800">หมายเหตุ</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}