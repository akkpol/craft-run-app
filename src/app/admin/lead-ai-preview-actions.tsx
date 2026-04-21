"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type Props = {
  leadId: string;
  prompt: string;
  status: string;
};

export default function LeadAiPreviewActions({ leadId, prompt, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);

  if (!prompt) {
    return null;
  }

  async function generatePreview() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/ai-preview`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "สร้างภาพ AI ไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "สร้างภาพ AI แล้ว",
        description: "ระบบอัปเดต lead และส่งงานเข้าสู่ขั้นตอนให้ลูกค้าตรวจแบบแล้ว",
      });
      router.refresh();
      setOpen(false);
    } catch (error) {
      setToast({
        tone: "error",
        title: "สร้างภาพ AI ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={loading || status === "pending"}
        onClick={() => setOpen(true)}
        className="border-slate-200 text-slate-700"
      >
        {loading || status === "pending" ? "กำลังสร้างภาพ..." : "สร้างภาพ AI"}
      </Button>

      <AdminActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="สร้างภาพตัวอย่างด้วย AI"
        description="ระบบจะใช้ prompt เดิมของ lead เพื่อ generate preview และเลื่อนสถานะไปยังขั้นตอนให้ลูกค้าตรวจแบบ"
        badge="Design"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={generatePreview} disabled={loading || status === "pending"}>
              {loading || status === "pending" ? "กำลังสร้างภาพ..." : "ยืนยันสร้างภาพ AI"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            prompt นี้จะถูกใช้ตรง ๆ กับ AI pipeline ของระบบ
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
            {prompt}
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}