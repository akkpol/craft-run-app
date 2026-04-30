import type {
  PaymentStatus,
  PaymentTerm,
  QuoteStatus,
} from "@/lib/types";

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (query: string) => any;
    upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>;
  };
};

type ExistingQuotePaymentRecord = {
  payment_status?: PaymentStatus | null;
  opened_at?: string | null;
  last_status_changed_at?: string | null;
  partially_paid_at?: string | null;
  paid_at?: string | null;
  closed_at?: string | null;
  payment_profile_snapshot?: unknown;
};

export type QuotePaymentRecordSyncInput = {
  quoteId: string;
  leadId: string;
  quoteStatus: QuoteStatus;
  total: number;
  paymentTerms: PaymentTerm;
  paymentStatus: PaymentStatus;
  paymentProfileSnapshot?: unknown;
  now?: string;
  existingRecord?: ExistingQuotePaymentRecord | null;
};

export type MonthlyAccountingExportItem = {
  quote: {
    id: string;
    publicToken: string;
    createdAt: string;
    status: string;
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    paymentTerms: string;
    paymentStatus: string;
    paymentProfileSnapshot?: unknown;
  };
  lead: {
    requestedDocumentType?: string | null;
    billingEntityType?: string | null;
    billingBranchType?: string | null;
    billingBranchCode?: string | null;
    billingName?: string | null;
    taxId?: string | null;
    billingAddress?: string | null;
  };
  customer: {
    displayName?: string | null;
    phone?: string | null;
  };
  paymentRecord?: {
    paymentStatus?: string | null;
    amountDue?: number | null;
    openedAt?: string | null;
    lastStatusChangedAt?: string | null;
    partiallyPaidAt?: string | null;
    paidAt?: string | null;
    closedAt?: string | null;
    proofReference?: string | null;
    proofReceivedAt?: string | null;
    note?: string | null;
    paymentProfileSnapshot?: unknown;
  } | null;
};

type PaymentProfileSnapshot = {
  sourceProfile?: string | null;
  reason?: string | null;
  profile?: {
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    promptPayId?: string | null;
    qrCodeUrl?: string | null;
    qrCodeLabel?: string | null;
    instructions?: string | null;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asPaymentProfileSnapshot(value: unknown): PaymentProfileSnapshot | null {
  const root = asRecord(value);

  if (!root) {
    return null;
  }

  const profile = asRecord(root.profile);

  return {
    sourceProfile: typeof root.sourceProfile === "string" ? root.sourceProfile : null,
    reason: typeof root.reason === "string" ? root.reason : null,
    profile: profile
      ? {
          bankName: typeof profile.bankName === "string" ? profile.bankName : null,
          accountName: typeof profile.accountName === "string" ? profile.accountName : null,
          accountNumber: typeof profile.accountNumber === "string" ? profile.accountNumber : null,
          promptPayId: typeof profile.promptPayId === "string" ? profile.promptPayId : null,
          qrCodeUrl: typeof profile.qrCodeUrl === "string" ? profile.qrCodeUrl : null,
          qrCodeLabel: typeof profile.qrCodeLabel === "string" ? profile.qrCodeLabel : null,
          instructions: typeof profile.instructions === "string" ? profile.instructions : null,
        }
      : null,
  };
}

function stringifyCsvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeAccountingMonth(month: string | null | undefined, now = new Date()) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [, rawMonth] = month.split("-");
    const monthNumber = Number(rawMonth);

    if (monthNumber >= 1 && monthNumber <= 12) {
      return month;
    }
  }

  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getAccountingMonthRange(month: string | null | undefined, now = new Date()) {
  const normalizedMonth = normalizeAccountingMonth(month, now);
  const [yearText, monthText] = normalizedMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  return {
    month: normalizedMonth,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function buildQuotePaymentRecordMutation(input: QuotePaymentRecordSyncInput) {
  const now = input.now || new Date().toISOString();
  const normalizedPaymentStatus =
    input.paymentTerms === "credit" ? "not_required" : input.paymentStatus;
  const shouldPersist =
    (input.quoteStatus === "approved" && input.paymentTerms !== "credit") ||
    Boolean(input.existingRecord);

  if (!shouldPersist) {
    return null;
  }

  const existingRecord = input.existingRecord;
  const statusChanged = existingRecord?.payment_status !== normalizedPaymentStatus;
  const requiresAction =
    normalizedPaymentStatus !== "paid" && normalizedPaymentStatus !== "not_required";

  return {
    quote_id: input.quoteId,
    lead_id: input.leadId,
    amount_due: input.total,
    payment_terms: input.paymentTerms,
    payment_status: normalizedPaymentStatus,
    payment_profile_snapshot:
      input.paymentProfileSnapshot ?? existingRecord?.payment_profile_snapshot ?? null,
    requires_action: requiresAction,
    opened_at: existingRecord?.opened_at ?? now,
    last_status_changed_at:
      statusChanged || !existingRecord?.last_status_changed_at
        ? now
        : existingRecord.last_status_changed_at,
    partially_paid_at:
      normalizedPaymentStatus === "partial"
        ? existingRecord?.partially_paid_at ?? now
        : existingRecord?.partially_paid_at ?? null,
    paid_at:
      normalizedPaymentStatus === "paid"
        ? existingRecord?.paid_at ?? now
        : existingRecord?.paid_at ?? null,
    closed_at:
      normalizedPaymentStatus === "paid" || normalizedPaymentStatus === "not_required"
        ? existingRecord?.closed_at ?? now
        : null,
    updated_at: now,
  };
}

export async function syncQuotePaymentRecord(
  supabase: SupabaseLikeClient,
  input: QuotePaymentRecordSyncInput
) {
  const { data: existingRecord, error: readError } = await supabase
    .from("quote_payment_records")
    .select(
      "payment_status, opened_at, last_status_changed_at, partially_paid_at, paid_at, closed_at, payment_profile_snapshot"
    )
    .eq("quote_id", input.quoteId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message || "Failed to read quote payment record");
  }

  const mutation = buildQuotePaymentRecordMutation({
    ...input,
    existingRecord: (existingRecord as ExistingQuotePaymentRecord | null | undefined) ?? null,
  });

  if (!mutation) {
    return null;
  }

  const { error: writeError } = await supabase
    .from("quote_payment_records")
    .upsert(mutation, { onConflict: "quote_id" });

  if (writeError) {
    throw new Error(writeError.message || "Failed to sync quote payment record");
  }

  return mutation;
}

export function buildMonthlyAccountingCsv(items: MonthlyAccountingExportItem[]) {
  const headers = [
    "quote_created_at",
    "quote_id",
    "public_token",
    "quote_status",
    "payment_terms",
    "quote_payment_status",
    "payment_record_status",
    "amount_due",
    "subtotal",
    "discount",
    "vat",
    "total",
    "requested_document_type",
    "billing_entity_type",
    "billing_branch_type",
    "billing_branch_code",
    "billing_name",
    "tax_id",
    "billing_address",
    "customer_name",
    "customer_phone",
    "payment_opened_at",
    "payment_last_status_changed_at",
    "payment_partially_paid_at",
    "payment_paid_at",
    "payment_closed_at",
    "payment_proof_reference",
    "payment_proof_received_at",
    "payment_note",
    "payment_profile_source",
    "payment_profile_reason",
    "payment_bank_name",
    "payment_account_name",
    "payment_account_number",
    "payment_promptpay_id",
    "payment_qr_code_url",
    "payment_qr_code_label",
    "payment_instructions",
  ];

  const lines = [headers.join(",")];

  for (const item of items) {
    const paymentProfile = asPaymentProfileSnapshot(
      item.paymentRecord?.paymentProfileSnapshot ?? item.quote.paymentProfileSnapshot ?? null
    );

    const row = [
      item.quote.createdAt,
      item.quote.id,
      item.quote.publicToken,
      item.quote.status,
      item.quote.paymentTerms,
      item.quote.paymentStatus,
      item.paymentRecord?.paymentStatus ?? "",
      item.paymentRecord?.amountDue ?? item.quote.total,
      item.quote.subtotal,
      item.quote.discount,
      item.quote.vat,
      item.quote.total,
      item.lead.requestedDocumentType ?? "",
      item.lead.billingEntityType ?? "",
      item.lead.billingBranchType ?? "",
      item.lead.billingBranchCode ?? "",
      item.lead.billingName ?? "",
      item.lead.taxId ?? "",
      item.lead.billingAddress ?? "",
      item.customer.displayName ?? "",
      item.customer.phone ?? "",
      item.paymentRecord?.openedAt ?? "",
      item.paymentRecord?.lastStatusChangedAt ?? "",
      item.paymentRecord?.partiallyPaidAt ?? "",
      item.paymentRecord?.paidAt ?? "",
      item.paymentRecord?.closedAt ?? "",
      item.paymentRecord?.proofReference ?? "",
      item.paymentRecord?.proofReceivedAt ?? "",
      item.paymentRecord?.note ?? "",
      paymentProfile?.sourceProfile ?? "",
      paymentProfile?.reason ?? "",
      paymentProfile?.profile?.bankName ?? "",
      paymentProfile?.profile?.accountName ?? "",
      paymentProfile?.profile?.accountNumber ?? "",
      paymentProfile?.profile?.promptPayId ?? "",
      paymentProfile?.profile?.qrCodeUrl ?? "",
      paymentProfile?.profile?.qrCodeLabel ?? "",
      paymentProfile?.profile?.instructions ?? "",
    ].map((value) => stringifyCsvValue(value));

    lines.push(row.join(","));
  }

  return `\uFEFF${lines.join("\n")}`;
}