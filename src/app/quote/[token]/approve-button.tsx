"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  PencilLine,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  quoteToken: string;
  allowApprove?: boolean;
  allowReject?: boolean;
  allowRescope?: boolean;
};

export default function QuoteApproveButton({
  quoteToken,
  allowApprove = true,
  allowReject = false,
  allowRescope = false,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<
    "approve_quote" | "reject_quote" | "rescope_quote" | null
  >(null);
  const [successState, setSuccessState] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [requiresPayment, setRequiresPayment] = useState(false);
  const router = useRouter();

  async function handleAction(action: "approve_quote" | "reject_quote" | "rescope_quote") {
    if (
      action === "approve_quote" &&
      !confirm("ยืนยันอนุมัติใบเสนอราคานี้?")
    ) {
      return;
    }

    const note =
      action === "rescope_quote"
        ? window.prompt("บอกทีมงานว่าต้องการแก้ส่วนไหน", "ต้องการปรับรายละเอียดก่อนออกใบเสนอราคาใหม่")
        : action === "reject_quote"
          ? window.prompt("ระบุเหตุผลที่ไม่รับใบเสนอราคานี้", "ยังไม่สะดวกดำเนินงานตามใบเสนอราคานี้")
          : undefined;

    if (note === null) {
      return;
    }

    setLoadingAction(action);
    setError("");

    try {
      const res = await fetch(`/api/quotes/public/${quoteToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setSuccessMessage(data.message || "ดำเนินการเรียบร้อย");
      setRequiresPayment(Boolean(data.requiresPayment));
      setSuccessState(action);
      router.refresh();
    } catch {
      setError("ไม่สามารถดำเนินการได้ กรุณาลองใหม่");
    } finally {
      setLoadingAction(null);
    }
  }

  if (successState) {
    const successTone = requiresPayment
      ? {
          container: "border-amber-200 bg-amber-50 text-amber-900",
          iconWrap: "bg-amber-100 text-amber-700",
          helper: "ทีมงานจะรอยืนยันการชำระเงินก่อนเริ่มผลิต",
          icon: Clock3,
        }
      : successState === "reject_quote"
        ? {
            container: "border-rose-200 bg-rose-50 text-rose-900",
            iconWrap: "bg-rose-100 text-rose-700",
            helper: "หากต้องการกลับมาคุยต่อ สามารถแจ้งทีมงานเพื่อออกใบเสนอราคาใหม่ได้",
            icon: XCircle,
          }
        : {
            container: "border-emerald-200 bg-emerald-50 text-emerald-900",
            iconWrap: "bg-emerald-100 text-emerald-700",
            helper: "ทีมงานได้รับคำตอบของคุณแล้ว และจะอัปเดตขั้นตอนถัดไปให้โดยเร็ว",
            icon: CheckCircle2,
          };
    const SuccessIcon = successTone.icon;

    return (
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm ${successTone.container}`}
      >
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${successTone.iconWrap}`}
        >
          <SuccessIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{successMessage}</p>
          <p className="mt-1 text-xs opacity-80">{successTone.helper}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {allowApprove && (
          <Button
            type="button"
            size="lg"
            onClick={() => handleAction("approve_quote")}
            disabled={loadingAction !== null}
            className="w-full justify-center"
          >
            {loadingAction === "approve_quote" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {loadingAction === "approve_quote"
              ? "กำลังดำเนินการ..."
              : "อนุมัติใบเสนอราคา"}
          </Button>
        )}

        {(allowRescope || allowReject) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {allowRescope && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => handleAction("rescope_quote")}
                disabled={loadingAction !== null}
                className="w-full justify-center bg-background"
              >
                {loadingAction === "rescope_quote" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PencilLine className="size-4" />
                )}
                ขอปรับรายละเอียด
              </Button>
            )}
            {allowReject && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => handleAction("reject_quote")}
                disabled={loadingAction !== null}
                className="w-full justify-center"
              >
                {loadingAction === "reject_quote" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                ปฏิเสธใบเสนอราคา
              </Button>
            )}
          </div>
        )}

        <p className="text-center text-xs leading-relaxed text-slate-500">
          การดำเนินการนี้จะอัปเดตสถานะใบเสนอราคาในระบบทันที
        </p>
      </div>
    </div>
  );
}
