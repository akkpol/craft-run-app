"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  AdminActionSheet,
  AdminActionToast,
  type AdminToastState,
} from "./admin-action-ui";

type Props = {
  leadId: string;
  previewCount: number;
};

export default function LeadSendPreviewActions({
  leadId,
  previewCount,
  buttonVariant = "outline",
}: Props & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<AdminToastState | null>(null);

  if (previewCount <= 0) {
    return null;
  }

  async function sendPreview() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/send-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "ส่งแบบให้ลูกค้าไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "ส่งแบบให้ลูกค้าแล้ว",
        description: `ส่ง preview ${payload.sentCount || previewCount} ภาพ และย้ายงานไปรอ feedback แล้ว`,
      });
      router.refresh();
      setOpen(false);
      setNote("");
    } catch (error) {
      setToast({
        tone: "error",
        title: "ส่งแบบให้ลูกค้าไม่สำเร็จ",
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
        variant={buttonVariant}
        size="xs"
        onClick={() => setOpen(true)}
        disabled={loading}
        className={cn(
          buttonVariant === "outline" && "border-slate-200 text-slate-700",
          buttonVariant === "secondary" && "border-slate-200 bg-slate-100/90 text-slate-800 hover:bg-slate-200/80",
          buttonVariant === "default" && "shadow-[0_12px_24px_rgba(0,94,140,0.18)] hover:shadow-[0_16px_30px_rgba(0,94,140,0.22)]"
        )}
      >
        ส่งให้ลูกค้าตรวจ
      </Button>

      <AdminActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="ส่งแบบให้ลูกค้าตรวจ"
        description="ใช้ภาพ preview ที่สร้างไว้แล้วส่งให้ลูกค้าผ่าน LINE พร้อมลิงก์ status ของงาน"
        badge="Design"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={sendPreview} disabled={loading}>
              {loading ? "กำลังส่ง..." : "ยืนยันส่งให้ลูกค้า"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            จะส่งภาพ preview ปัจจุบัน {previewCount} ภาพให้ลูกค้าผ่าน LINE และย้ายงานไปคิวรอ feedback จากลูกค้า
          </div>
          <label className="block text-sm font-medium text-slate-800">หมายเหตุถึงลูกค้า</label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            placeholder="เช่น ลองดูโทนและองค์ประกอบก่อน ถ้าต้องการแก้ไขตอบกลับใน LINE ได้เลย"
          />
        </div>
      </AdminActionSheet>

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}