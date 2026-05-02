import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { buildCommercialDocumentIssuePlan } from "@/lib/commercial-document-issue";
import { createAdminClient } from "@/lib/supabase/admin";

type IssueDocumentBody = {
  paymentId?: string;
  payment_id?: string;
};

type AllocationRow = {
  document_number: string;
  next_number: number;
  sequence_year: number;
  prefix: string;
};

export async function POST(request: NextRequest) {
  let body: IssueDocumentBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = body.paymentId ?? body.payment_id;

  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, receiver_entity_id, status, amount, currency, paid_at")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json(
      { error: paymentError.message || "Failed to read payment" },
      { status: 500 }
    );
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const { data: existingDocument, error: existingDocumentError } = await supabase
    .from("commercial_documents")
    .select("id, document_number, document_type")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingDocumentError) {
    return NextResponse.json(
      { error: existingDocumentError.message || "Failed to read commercial documents" },
      { status: 500 }
    );
  }

  if (existingDocument) {
    return NextResponse.json(
      {
        error: "DOCUMENT_ALREADY_ISSUED",
        detail: `Payment ${paymentId} already issued ${existingDocument.document_type} ${existingDocument.document_number}.`,
        documentId: existingDocument.id,
        documentNumber: existingDocument.document_number,
      },
      { status: 409 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("commercial_orders")
    .select(
      "id, quote_id, customer_id, selected_receiver_entity_id, payment_receiver_locked_at, customer_tax_profile_id"
    )
    .eq("id", payment.order_id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: orderError.message || "Failed to read commercial order" },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json(
      { error: "Commercial order not found" },
      { status: 404 }
    );
  }

  const { data: receiverEntity, error: receiverError } = await supabase
    .from("commercial_entities")
    .select(
      "id, role, is_vat_registered, active, legal_name, display_name, tax_id, branch_type, branch_code, branch_name, address"
    )
    .eq("id", payment.receiver_entity_id)
    .maybeSingle();

  if (receiverError) {
    return NextResponse.json(
      { error: receiverError.message || "Failed to read receiver entity" },
      { status: 500 }
    );
  }

  if (!receiverEntity) {
    return NextResponse.json(
      { error: "Receiver entity not found" },
      { status: 404 }
    );
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, lead_id, subtotal, discount, vat, total")
    .eq("id", order.quote_id)
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

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, requested_document_type, billing_entity_type, billing_branch_type, billing_branch_code, billing_name, tax_id, billing_address"
    )
    .eq("id", quote.lead_id)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json(
      { error: leadError.message || "Failed to read lead" },
      { status: 500 }
    );
  }

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const issuePlan = buildCommercialDocumentIssuePlan({
    paymentStatus: payment.status,
    paymentReceiverEntityId: payment.receiver_entity_id,
    selectedReceiverEntityId: order.selected_receiver_entity_id,
    paymentReceiverLockedAt: order.payment_receiver_locked_at,
    customerTaxProfileId: order.customer_tax_profile_id,
    customerRequestsTaxInvoice: lead.requested_document_type === "tax_invoice",
    quoteSubtotal: Number(quote.subtotal || 0),
    quoteDiscount: Number(quote.discount || 0),
    quoteVat: Number(quote.vat || 0),
    quoteTotal: Number(quote.total || 0),
    receiverEntity: {
      id: receiverEntity.id,
      role: receiverEntity.role,
      isVatRegistered: receiverEntity.is_vat_registered,
      active: receiverEntity.active,
    },
    issuedAt: payment.paid_at ?? new Date().toISOString(),
  });

  if (!issuePlan.ok) {
    const statusCode =
      issuePlan.error === "PAYMENT_NOT_CONFIRMED" ||
      issuePlan.error === "PAYMENT_RECEIVER_NOT_LOCKED"
        ? 409
        : 422;

    return NextResponse.json(
      {
        error: issuePlan.error,
        detail: issuePlan.detail,
      },
      { status: statusCode }
    );
  }

  let customerTaxProfile: Record<string, unknown> | null = null;

  if (order.customer_tax_profile_id) {
    const { data: taxProfile, error: taxProfileError } = await supabase
      .from("customer_tax_profiles")
      .select(
        "id, legal_name, tax_id, branch_type, branch_code, branch_name, address, email, phone"
      )
      .eq("id", order.customer_tax_profile_id)
      .maybeSingle();

    if (taxProfileError) {
      return NextResponse.json(
        { error: taxProfileError.message || "Failed to read customer tax profile" },
        { status: 500 }
      );
    }

    if (!taxProfile) {
      return NextResponse.json(
        { error: "Customer tax profile not found" },
        { status: 404 }
      );
    }

    customerTaxProfile = taxProfile;
  }

  const { data: allocationData, error: allocationError } = await supabase.rpc(
    "allocate_commercial_document_number",
    {
      p_entity_id: receiverEntity.id,
      p_document_type: issuePlan.value.documentType,
      p_issued_at: issuePlan.value.issuedAt,
      p_prefix: issuePlan.value.prefix,
    }
  );

  if (allocationError) {
    const statusCode = allocationError.message?.includes("DOCUMENT_NUMBER_CONFLICT")
      ? 409
      : 500;
    return NextResponse.json(
      { error: allocationError.message || "Failed to allocate document number" },
      { status: statusCode }
    );
  }

  const allocation = Array.isArray(allocationData)
    ? (allocationData[0] as AllocationRow | undefined)
    : (allocationData as AllocationRow | undefined);

  if (!allocation?.document_number) {
    return NextResponse.json(
      { error: "Failed to allocate document number" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: order.quote_id,
    actionType: "commercial.document_number_generated",
    actorLabel: "Admin",
    payload: {
      order_id: order.id,
      payment_id: payment.id,
      issuer_entity_id: receiverEntity.id,
      document_type: issuePlan.value.documentType,
      document_number: allocation.document_number,
      sequence_year: allocation.sequence_year,
      next_number: allocation.next_number,
      prefix: allocation.prefix,
    },
  });

  const snapshot = {
    policy_version: "COMMERCIAL_DOCUMENT_POLICY_V1",
    order_id: order.id,
    quote_id: order.quote_id,
    payment_id: payment.id,
    issued_at: issuePlan.value.issuedAt,
    locked_at: issuePlan.value.lockedAt,
    document_type: issuePlan.value.documentType,
    document_number: allocation.document_number,
    issuer: {
      id: receiverEntity.id,
      legal_name: receiverEntity.legal_name,
      display_name: receiverEntity.display_name,
      role: receiverEntity.role,
      tax_id: receiverEntity.tax_id,
      is_vat_registered: receiverEntity.is_vat_registered,
      branch_type: receiverEntity.branch_type,
      branch_code: receiverEntity.branch_code,
      branch_name: receiverEntity.branch_name,
      address: receiverEntity.address,
    },
    customer: {
      id: order.customer_id,
      tax_profile_id: order.customer_tax_profile_id,
      requested_document_type: lead.requested_document_type,
      billing_entity_type: lead.billing_entity_type,
      billing_branch_type: lead.billing_branch_type,
      billing_branch_code: lead.billing_branch_code,
      billing_name: lead.billing_name,
      tax_id: lead.tax_id,
      billing_address: lead.billing_address,
      tax_profile: customerTaxProfile,
    },
    payment: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      paid_at: payment.paid_at,
      receiver_entity_id: payment.receiver_entity_id,
    },
    totals: {
      subtotal: issuePlan.value.subtotal,
      discount_amount: issuePlan.value.discountAmount,
      vat_mode: issuePlan.value.vatMode,
      vat_rate: issuePlan.value.vatRate,
      vat_amount: issuePlan.value.vatAmount,
      grand_total: issuePlan.value.grandTotal,
    },
  };

  const { data: insertedDocument, error: insertError } = await supabase
    .from("commercial_documents")
    .insert({
      order_id: order.id,
      quote_id: order.quote_id,
      payment_id: payment.id,
      issuer_entity_id: receiverEntity.id,
      customer_id: order.customer_id,
      customer_tax_profile_id: order.customer_tax_profile_id,
      document_type: issuePlan.value.documentType,
      document_number: allocation.document_number,
      status: "ISSUED",
      vat_mode: issuePlan.value.vatMode,
      vat_rate: issuePlan.value.vatRate,
      subtotal: issuePlan.value.subtotal,
      discount_amount: issuePlan.value.discountAmount,
      vat_amount: issuePlan.value.vatAmount,
      grand_total: issuePlan.value.grandTotal,
      issued_at: issuePlan.value.issuedAt,
      locked_at: issuePlan.value.lockedAt,
      snapshot_json: snapshot,
      updated_at: issuePlan.value.issuedAt,
    })
    .select("id, document_number")
    .single();

  if (insertError) {
    const isConflict = insertError.code === "23505";
    return NextResponse.json(
      {
        error: isConflict ? "DOCUMENT_ALREADY_ISSUED" : insertError.message || "Failed to issue commercial document",
      },
      { status: isConflict ? 409 : 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: order.quote_id,
    actionType: "commercial.document_issued",
    actorLabel: "Admin",
    payload: {
      order_id: order.id,
      payment_id: payment.id,
      document_id: insertedDocument.id,
      issuer_entity_id: receiverEntity.id,
      receiver_entity_id: payment.receiver_entity_id,
      document_type: issuePlan.value.documentType,
      document_number: insertedDocument.document_number,
    },
  });

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    orderId: order.id,
    receiverEntityId: receiverEntity.id,
    documentId: insertedDocument.id,
    documentType: issuePlan.value.documentType,
    documentNumber: insertedDocument.document_number,
    issuedAt: issuePlan.value.issuedAt,
  });
}