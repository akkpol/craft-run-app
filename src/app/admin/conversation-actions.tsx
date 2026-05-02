"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  WORKFLOW_STATE_LABELS,
  type WorkflowState,
} from "@/lib/types";
import { ALLOWED_CONVERSATION_TRANSITIONS } from "@/lib/workflow-transitions";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

export default function AdminConversationActions({
  conversationId,
  currentState,
  compact = false,
  buttonVariant = "outline",
  buttonLabel,
}: {
  conversationId: string;
  currentState: WorkflowState;
  compact?: boolean;
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState<WorkflowState | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const router = useRouter();
  const nextStates = ALLOWED_CONVERSATION_TRANSITIONS[currentState] || [];

  function openStateAction(nextState: WorkflowState) {
    setSelectedState(nextState);
    setNote(
      nextState === "HUMAN_REVIEW_REQUIRED"
        ? "ต้องการให้ทีมงานตรวจสอบ"
        : nextState === "ON_HOLD_CUSTOMER_INPUT"
          ? "รอข้อมูลเพิ่มเติมจากลูกค้า"
          : `อัปเดต workflow เป็น ${WORKFLOW_STATE_LABELS[nextState]}`
    );
  }

  function closePanel() {
    setSelectedState(null);
    setLoading(false);
  }

  async function updateState() {
    if (!selectedState) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: selectedState,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "อัปเดต workflow ไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "อัปเดต workflow แล้ว",
        description: WORKFLOW_STATE_LABELS[selectedState],
      });
      router.refresh();
      closePanel();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปเดต workflow ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  if (nextStates.length === 0) {
    return null;
  }

  return (
    <>
      <AdminActionMenu
        actions={nextStates.map((state) => ({
          key: state,
          label: WORKFLOW_STATE_LABELS[state],
          description: `เปลี่ยนจาก ${WORKFLOW_STATE_LABELS[currentState]}`,
          tone: state === "CANCELLED" ? "destructive" : "default",
        }))}
        onSelect={(key) => openStateAction(key as WorkflowState)}
        disabled={loading}
        compact={compact}
        label={buttonLabel || (compact ? "ขยับ workflow" : "จัดการ workflow")}
        buttonVariant={buttonVariant}
      />

      <AdminActionSheet
        open={Boolean(selectedState)}
        onClose={closePanel}
        title={selectedState ? `เปลี่ยน workflow เป็น ${WORKFLOW_STATE_LABELS[selectedState]}` : "เปลี่ยน workflow"}
        description={selectedState ? `ขั้นตอนปัจจุบันคือ ${WORKFLOW_STATE_LABELS[currentState]}` : undefined}
        badge="Inbox"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel}>
              ยกเลิก
            </Button>
            <Button type="button" variant={selectedState === "CANCELLED" ? "destructive" : "default"} onClick={updateState} disabled={loading || !selectedState}>
              {loading ? "กำลังบันทึก..." : "ยืนยันการเปลี่ยน workflow"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            สถานะปัจจุบัน: {WORKFLOW_STATE_LABELS[currentState]}
          </div>
          <label className="block text-sm font-medium text-slate-800">เหตุผลหรือโน้ตสำหรับทีม</label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}