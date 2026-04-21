"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types";
import { ALLOWED_JOB_TRANSITIONS } from "@/lib/workflow-transitions";
import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

export default function AdminJobActions({
  jobId,
  currentStatus,
}: {
  jobId: string;
  currentStatus: JobStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const router = useRouter();

  const nextStatuses = ALLOWED_JOB_TRANSITIONS[currentStatus] || [];

  function openStatusAction(nextStatus: JobStatus) {
    setSelectedStatus(nextStatus);
    setNote(
      nextStatus === "CANCELLED"
        ? "ยกเลิกงานโดยทีมแอดมิน"
        : nextStatus === "ON_HOLD_CUSTOMER_INPUT"
          ? "รอข้อมูลเพิ่มเติมจากลูกค้า"
          : `อัปเดตงานเป็น ${JOB_STATUS_LABELS[nextStatus] || nextStatus}`
    );
  }

  function closePanel() {
    setSelectedStatus(null);
    setLoading(false);
  }

  async function updateStatus() {
    if (!selectedStatus) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, note: note.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "อัปเดตสถานะงานไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "อัปเดตสถานะงานแล้ว",
        description: JOB_STATUS_LABELS[selectedStatus] || selectedStatus,
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปเดตสถานะงานไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <>
      <AdminActionMenu
        actions={nextStatuses.map((status) => ({
          key: status,
          label: JOB_STATUS_LABELS[status] || status,
          description: `เปลี่ยนจาก ${JOB_STATUS_LABELS[currentStatus] || currentStatus}`,
          tone: status === "CANCELLED" ? "destructive" : "default",
        }))}
        onSelect={(key) => openStatusAction(key as JobStatus)}
        disabled={loading}
        compact
        label="จัดการ"
      />

      <AdminActionSheet
        open={Boolean(selectedStatus)}
        onClose={closePanel}
        title={selectedStatus ? `เปลี่ยนสถานะเป็น ${JOB_STATUS_LABELS[selectedStatus] || selectedStatus}` : "เปลี่ยนสถานะงาน"}
        description={selectedStatus ? `ยืนยันการเปลี่ยนจาก ${JOB_STATUS_LABELS[currentStatus] || currentStatus}` : undefined}
        badge="งาน"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" variant={selectedStatus === "CANCELLED" ? "destructive" : "default"} onClick={updateStatus} disabled={loading || !selectedStatus}>
              {loading ? "กำลังบันทึก..." : "ยืนยันการเปลี่ยนสถานะ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            สถานะปัจจุบัน: {JOB_STATUS_LABELS[currentStatus] || currentStatus}
          </div>
          <label className="block text-sm font-medium text-slate-800">หมายเหตุสำหรับ timeline</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
