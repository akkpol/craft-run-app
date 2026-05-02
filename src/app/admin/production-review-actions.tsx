"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type ReviewAction = "approve" | "reject" | "send";

export default function ProductionReviewActions({
  eventId,
  reviewStatus,
  buttonVariant = "outline",
  buttonLabel = "ตรวจหลักฐาน",
}: {
  eventId: string;
  reviewStatus: "pending" | "approved" | "rejected" | "sent";
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonLabel?: string;
}) {
  const [loading, setLoading] = useState<ReviewAction | "">("");
  const [selectedAction, setSelectedAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const router = useRouter();

  const actionLabels: Record<ReviewAction, string> = {
    approve: "อนุมัติ",
    reject: "ตีกลับ",
    send: "ส่งให้ลูกค้า",
  };

  async function submitAction(action: ReviewAction) {
    setLoading(action);
    try {
      const response = await fetch(`/api/admin/production-events/${eventId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: reviewNote.trim() || undefined }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "จัดการ production review ไม่สำเร็จ");
      }

      setToast({
        tone: payload.notificationError ? "warning" : "success",
        title: `บันทึกการ${actionLabels[action]}แล้ว`,
        description: payload.notificationError || reviewNote.trim() || undefined,
      });
      if (payload.notificationError) {
        setToast({
          tone: "warning",
          title: `บันทึกการ${actionLabels[action]}แล้ว แต่แจ้งลูกค้าไม่สำเร็จ`,
          description: payload.notificationError,
        });
      }

      if (payload.notificationError) {
        alert(payload.notificationError);
      }

      router.refresh();
      setSelectedAction(null);
      setReviewNote("");
    } catch (error) {
      setToast({
        tone: "error",
        title: "จัดการ production review ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading("");
    }
  }

  const actions = [
    reviewStatus === "pending"
      ? {
          key: "approve",
          label: actionLabels.approve,
          description: "เก็บ review ไว้เป็น approved โดยยังไม่ส่งถึงลูกค้าทันที",
        }
      : null,
    {
      key: "reject",
      label: actionLabels.reject,
      description: "ตีกลับหลักฐานชุดนี้พร้อมบันทึกเหตุผลให้ทีมหน้างาน",
      tone: "destructive" as const,
    },
    {
      key: "send",
      label: actionLabels.send,
      description: "ส่งหลักฐานให้ลูกค้าผ่าน LINE พร้อมอัปเดตสถานะ review",
    },
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <>
      <AdminActionMenu
        actions={actions}
        onSelect={(key) => {
          setSelectedAction(key as ReviewAction);
          setReviewNote("");
        }}
        disabled={Boolean(loading)}
        label={buttonLabel}
        buttonVariant={buttonVariant}
      />

      <AdminActionSheet
        open={Boolean(selectedAction)}
        onClose={() => {
          setSelectedAction(null);
          setLoading("");
        }}
        title={selectedAction ? actionLabels[selectedAction] : "จัดการ production review"}
        description="บันทึกเหตุผลประกอบการ review ก่อนอัปเดตหลักฐานหน้างาน"
        badge="Production"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelectedAction(null)}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant={selectedAction === "reject" ? "destructive" : "default"}
              onClick={() => selectedAction && submitAction(selectedAction)}
              disabled={!selectedAction || Boolean(loading)}
            >
              {loading ? "กำลังบันทึก..." : "ยืนยันการดำเนินการ"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            สถานะปัจจุบัน: {reviewStatus}
          </div>
          <label className="block text-sm font-medium text-slate-800">หมายเหตุ review</label>
          <Textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            rows={5}
            placeholder="เช่น อนุมัติแล้ว, ต้องถ่ายใหม่, พร้อมส่งให้ลูกค้า"
          />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
