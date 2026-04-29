"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  AdminActionMenu,
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type Props = {
  leadId: string;
  prompt: string;
  promptRoutingLabel?: string | null;
};

export default function LeadPromptActions({
  leadId,
  prompt,
  promptRoutingLabel,
  buttonVariant = "outline",
  buttonLabel = "ดู/แก้ prompt",
}: Props & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(prompt);
  const [toast, setToast] = useState<AdminToastState | null>(null);

  useEffect(() => {
    setDraftPrompt(prompt);
  }, [prompt]);

  async function copyPromptValue() {
    if (!prompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setToast({
        tone: "success",
        title: "คัดลอก prompt แล้ว",
        description: "พร้อมใช้ต่อใน /studio หรือ workflow ฝั่งแอดมิน",
      });
    } catch {
      window.prompt("คัดลอกข้อความนี้", prompt);
    }
  }

  async function savePrompt() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: draftPrompt }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "บันทึก prompt ไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: draftPrompt.trim()
          ? "บันทึก prompt แล้ว"
          : "ล้าง prompt override แล้ว",
        description: draftPrompt.trim()
          ? "รอบถัดไประบบจะใช้ prompt นี้เป็น explicit override"
          : "ระบบจะกลับไปใช้ prompt อัตโนมัติจากข้อมูล lead",
      });
      router.refresh();
      setOpen(false);
    } catch (error) {
      setToast({
        tone: "error",
        title: "บันทึก prompt ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminActionMenu
        actions={[
          {
            key: "edit",
            label: "ดูหรือแก้ prompt",
            description: promptRoutingLabel || "เปิด prompt ล่าสุดของ lead และแก้ไขได้ทันที",
          },
          {
            key: "copy",
            label: "คัดลอก prompt",
            description: "คัดลอก prompt ล่าสุดไปใช้ต่อใน workflow อื่น",
            disabled: !prompt,
          },
        ]}
        onSelect={(key) => {
          if (key === "copy") {
            void copyPromptValue();
            return;
          }

          setOpen(true);
        }}
        disabled={loading}
        compact
        label={buttonLabel}
        buttonVariant={buttonVariant}
      />

      <AdminActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="ตรวจหรือแก้ prompt"
        description="แก้ข้อความ prompt ตรงนี้เพื่อบังคับ explicit override ของ lead นี้ หรือบันทึกค่าว่างเพื่อกลับไปใช้ prompt อัตโนมัติ"
        badge="Prompt"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={savePrompt} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึก prompt"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {promptRoutingLabel || "ถ้ายังไม่มี explicit override ระบบจะประกอบ prompt จาก product, size และรายละเอียดของ lead ให้อัตโนมัติ"}
          </div>
          <label className="block text-sm font-medium text-slate-800">Prompt override สำหรับ lead นี้</label>
          <Textarea
            value={draftPrompt}
            onChange={(event) => setDraftPrompt(event.target.value)}
            rows={12}
            placeholder="วางหรือแก้ prompt ที่ต้องการใช้กับ AI pipeline ได้ที่นี่"
          />
          <p className="text-xs leading-5 text-slate-500">
            ลบข้อความทั้งหมดแล้วกดบันทึก หากต้องการกลับไปใช้ prompt อัตโนมัติจากข้อมูลสินค้าและรายละเอียดลูกค้า
          </p>
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}