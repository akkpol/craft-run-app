"use client";

import { useState, type ComponentProps } from "react";
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

const BLOCKING_REQUIREMENT_COPY: Record<string, string> = {
  "payment must be cleared": "ต้องเคลียร์สถานะรับชำระให้ปลดล็อก production ก่อน",
  "design_status must be approved or not_started": "งานนี้ต้องอนุมัติแบบแล้ว หรือเป็นงานที่ไม่ต้องผ่านขั้นออกแบบก่อน",
  "required commercial document must be issued or explicitly waived": "ต้องออกเอกสารหลังรับชำระให้ครบก่อน จึงจะย้ายงานเข้า production ได้",
};

function formatBlockingRequirement(requirement: string) {
  return BLOCKING_REQUIREMENT_COPY[requirement] || requirement;
}

export default function AdminJobActions({
  jobId,
  currentStatus,
  buttonVariant = "outline",
  buttonLabel = "อัปเดตงาน",
}: {
  jobId: string;
  currentStatus: JobStatus;
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [blockingDetails, setBlockingDetails] = useState<string[]>([]);
  const router = useRouter();

  const nextStatuses = ALLOWED_JOB_TRANSITIONS[currentStatus] || [];

  function openStatusAction(nextStatus: JobStatus) {
    setSelectedStatus(nextStatus);
    setBlockingDetails([]);
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
    setBlockingDetails([]);
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

      const data = (await res.json()) as {
        error?: string;
        missingRequirements?: string[];
      };

      if (!res.ok) {
        const details = Array.isArray(data.missingRequirements)
          ? data.missingRequirements.filter(
              (requirement): requirement is string => Boolean(requirement)
            ).map((requirement) => formatBlockingRequirement(requirement))
          : [];

        setBlockingDetails(details);

        const description = [data.error || "อัปเดตสถานะงานไม่สำเร็จ", ...details]
          .filter(Boolean)
          .join(" | ");

        throw new Error(description);
      }

      setBlockingDetails([]);
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
        label={buttonLabel}
        buttonVariant={buttonVariant}
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
          {selectedStatus === "IN_PRODUCTION" ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                ระบบจะตรวจ payment, design approval และ commercial document gate ก่อนย้ายงานเข้า production
              </div>
              {blockingDetails.length > 0 ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-medium">ตอนนี้ยังย้ายเข้า production ไม่ได้</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {blockingDetails.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm font-medium text-slate-800">หมายเหตุสำหรับ timeline</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
