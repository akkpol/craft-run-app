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
  const localCommand = `pwsh -File .\\scripts\\invoke-gpt-image-2.ps1 -LeadId "${leadId}" -PromptFromClipboard`;

  if (!prompt) {
    return null;
  }

  async function copyValue(value: string, title: string, description: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({
        tone: "success",
        title,
        description,
      });
    } catch {
      window.prompt("คัดลอกข้อความนี้", value);
    }
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
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-xl">
                <p className="font-medium text-slate-900">Local GPT Image 2 handoff</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  ใช้กับ /studio หรือ local design assist ได้โดยคัดลอก prompt แล้วรัน wrapper ใน repo นี้บนเครื่อง dev
                  เส้นทางนี้เป็น local workflow ไม่ใช่ provider ของ production route
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    copyValue(
                      prompt,
                      "คัดลอก prompt แล้ว",
                      "พร้อมใช้กับ GPT Image 2 local หรือ workflow อื่นฝั่ง studio"
                    )
                  }
                >
                  คัดลอก prompt
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    copyValue(
                      localCommand,
                      "คัดลอกคำสั่ง GPT Image 2 แล้ว",
                      "รันจาก root ของ repo นี้ และเติม -DryRun ถ้าต้องการเช็ก command ก่อน"
                    )
                  }
                >
                  คัดลอกคำสั่ง GPT Image 2
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}