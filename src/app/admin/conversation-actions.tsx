"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WORKFLOW_STATE_LABELS,
  type WorkflowState,
} from "@/lib/types";
import { ALLOWED_CONVERSATION_TRANSITIONS } from "@/lib/workflow-transitions";

export default function AdminConversationActions({
  conversationId,
  currentState,
  compact = false,
}: {
  conversationId: string;
  currentState: WorkflowState;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const nextStates = ALLOWED_CONVERSATION_TRANSITIONS[currentState] || [];

  async function updateState(nextState: WorkflowState) {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: nextState,
          note:
            nextState === "HUMAN_REVIEW_REQUIRED"
              ? "ต้องการให้ทีมงานตรวจสอบ"
              : nextState === "ON_HOLD_CUSTOMER_INPUT"
                ? "รอข้อมูลเพิ่มเติมจากลูกค้า"
                : "Updated by admin",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update conversation");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to update conversation");
    } finally {
      setLoading(false);
    }
  }

  if (nextStates.length === 0) {
    return null;
  }

  return (
    <select
      disabled={loading}
      onChange={(e) => {
        if (e.target.value) {
          updateState(e.target.value as WorkflowState);
        }
      }}
      className={compact
        ? "text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
        : "text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
      }
      defaultValue=""
    >
      <option value="" disabled>
        เปลี่ยน workflow
      </option>
      {nextStates.map((state) => (
        <option key={state} value={state}>
          {WORKFLOW_STATE_LABELS[state]}
        </option>
      ))}
    </select>
  );
}