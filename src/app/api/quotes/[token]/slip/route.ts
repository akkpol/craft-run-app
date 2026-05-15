import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import {
  PAYMENT_SLIP_MAX_BYTES,
  isAllowedPaymentSlipMime,
  uploadPaymentSlipFile,
} from "@/lib/payment-slip-storage";
import { paymentUnlocksProduction } from "@/lib/quote-workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPaymentStatus,
  isPaymentTerm,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 500)
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > PAYMENT_SLIP_MAX_BYTES) {
    return NextResponse.json(
      { error: "File size out of range" },
      { status: 400 }
    );
  }
  if (!isAllowedPaymentSlipMime(file.type || "")) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, public_token, lead_id, status, payment_terms, payment_status, jobs(id)")
    .eq("public_token", token)
    .maybeSingle();

  if (quoteError) {
    return NextResponse.json(
      { error: quoteError.message || "Failed to read quote" },
      { status: 500 }
    );
  }
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const paymentTerms = isPaymentTerm(quote.payment_terms)
    ? (quote.payment_terms as PaymentTerm)
    : null;
  const paymentStatus = isPaymentStatus(quote.payment_status)
    ? (quote.payment_status as PaymentStatus)
    : null;
  const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;
  const waitingPayment =
    quote.status === "approved" &&
    paymentTerms !== null &&
    paymentStatus !== null &&
    !hasJob &&
    !paymentUnlocksProduction(paymentTerms, paymentStatus);

  if (!waitingPayment || paymentTerms === "credit") {
    return NextResponse.json(
      {
        error: "QUOTE_NOT_WAITING_PAYMENT",
        detail: "This quote is not accepting payment slip uploads.",
      },
      { status: 409 }
    );
  }

  let uploadResult;
  try {
    uploadResult = await uploadPaymentSlipFile(quote.id, file);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload payment slip",
      },
      { status: 500 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("payment_slips")
    .insert({
      quote_id: quote.id,
      storage_path: uploadResult.storagePath,
      original_file_name: uploadResult.originalFileName,
      mime_type: uploadResult.mimeType,
      file_size_bytes: uploadResult.size,
      uploader: "customer",
      status: "pending",
      note,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        error: insertError?.message || "Failed to record payment slip",
      },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "payment.slip_uploaded",
    actorLabel: "Customer",
    note: note ?? undefined,
    payload: {
      slip_id: inserted.id,
      uploader: "customer",
      storage_path: uploadResult.storagePath,
      mime_type: uploadResult.mimeType,
      size_bytes: uploadResult.size,
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    slipId: inserted.id,
    uploadedAt: inserted.created_at,
  });
}
