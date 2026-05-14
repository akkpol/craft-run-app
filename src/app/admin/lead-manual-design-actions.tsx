"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminActionToast, type AdminToastState } from "./admin-action-ui";

type Props = {
  leadId: string;
};

export default function LeadManualDesignActions({ leadId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/leads/${leadId}/manual-design`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "อัปโหลด design ไม่สำเร็จ");
      }

      setToast({
        tone: "success",
        title: "อัปโหลด design แล้ว",
        description: "ใช้แทน AI image ของ lead นี้ — กดส่ง preview ให้ลูกค้าได้ทันที",
      });
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        title: "อัปโหลด design ไม่สำเร็จ",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        {loading ? "กำลังอัปโหลด..." : "อัปโหลด design เอง"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <AdminActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
