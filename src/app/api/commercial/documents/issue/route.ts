import { NextRequest, NextResponse } from "next/server";

import { logHumanAction, logSystemAction } from "@/lib/action-log";
import {
  buildCommercialDocumentDeliverySkipAudit,
  buildCommercialDocumentIssueFailureAudit,
} from "@/lib/commercial-audit";
import { buildCommercialDocumentIssuePlan } from "@/lib/commercial-document-issue";
import { pushCommercialDocumentLink } from "@/lib/line";
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
    .select("id, lead_id, public_token, subtotal, discount, vat, total")
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
      "id, conversation_id, requested_document_type, billing_entity_type, billing_branch_type, billing_branch_code, billing_name, tax_id, billing_address, ai_generated_images"
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

  let customerTaxProfile: Record<string, unknown> | null = null;

  if (order.customer_tax_profile_id) {
    const { data: taxProfile, error: taxProfileError } = await supabase
      .from("customer_tax_profiles")
      .select(
        "id, customer_id, legal_name, tax_id, branch_type, branch_code, branch_name, address, email, phone"
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

  const issuePlan = buildCommercialDocumentIssuePlan({
    paymentStatus: payment.status,
    paymentReceiverEntityId: payment.receiver_entity_id,
    selectedReceiverEntityId: order.selected_receiver_entity_id,
    paymentReceiverLockedAt: order.payment_receiver_locked_at,
    customerId: order.customer_id,
    customerTaxProfileId: order.customer_tax_profile_id,
    customerTaxProfileCustomerId:
      customerTaxProfile && typeof customerTaxProfile.customer_id === "string"
        ? customerTaxProfile.customer_id
        : null,
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

    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      actorLabel: "Admin",
      ...buildCommercialDocumentIssueFailureAudit({
        error: issuePlan.error,
        detail: issuePlan.detail,
        paymentId: payment.id,
        orderId: order.id,
        quoteId: order.quote_id,
        receiverEntityId: payment.receiver_entity_id,
        requestedTaxInvoice: lead.requested_document_type === "tax_invoice",
      }),
    }).catch(() => null);

    return NextResponse.json(
      {
        error: issuePlan.error,
        detail: issuePlan.detail,
      },
      { status: statusCode }
    );
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

    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      actorLabel: "Admin",
      ...buildCommercialDocumentIssueFailureAudit({
        error: allocationError.message?.includes("DOCUMENT_NUMBER_CONFLICT")
          ? "DOCUMENT_NUMBER_CONFLICT"
          : "DOCUMENT_ALREADY_ISSUED",
        detail: allocationError.message || "Failed to allocate document number",
        paymentId: payment.id,
        orderId: order.id,
        quoteId: order.quote_id,
        receiverEntityId: receiverEntity.id,
        requestedTaxInvoice: lead.requested_document_type === "tax_invoice",
        documentType: issuePlan.value.documentType,
      }),
    }).catch(() => null);

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

  const leadImages = Array.isArray(lead.ai_generated_images) ? lead.ai_generated_images : [];
  const perOrderImageUrl = leadImages.find(
    (url: unknown): url is string => typeof url === "string" && url.length > 0
  ) ?? null;
  const documentAppendix = perOrderImageUrl
    ? {
        image_url: perOrderImageUrl,
        image_name: null,
        source: "lead_ai_generated_images",
      }
    : null;

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
    document_appendix: documentAppendix,
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

    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      actorLabel: "Admin",
      ...buildCommercialDocumentIssueFailureAudit({
        error: "DOCUMENT_ALREADY_ISSUED",
        detail:
          insertError.message || "Failed to issue commercial document",
        paymentId: payment.id,
        orderId: order.id,
        quoteId: order.quote_id,
        receiverEntityId: receiverEntity.id,
        requestedTaxInvoice: lead.requested_document_type === "tax_invoice",
        documentType: issuePlan.value.documentType,
        documentNumber: allocation.document_number,
      }),
    }).catch(() => null);

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

  const logDocumentDeliverySkipped = (
    reason:
      | "missing_public_token"
      | "missing_conversation_id"
      | "conversation_not_found"
      | "missing_line_user_id",
    detail: string,
    conversationId?: string | null,
    lineUserId?: string | null
  ) =>
    logSystemAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      serviceName: "document_delivery",
      ...buildCommercialDocumentDeliverySkipAudit({
        reason,
        detail,
        paymentId: payment.id,
        orderId: order.id,
        quoteId: order.quote_id,
        documentId: insertedDocument.id,
        documentType: issuePlan.value.documentType,
        documentNumber: insertedDocument.document_number,
        conversationId,
        lineUserId,
      }),
    });

  if (!quote.public_token) {
    await logDocumentDeliverySkipped(
      "missing_public_token",
      "Quote has no public token for customer-safe document delivery link.",
      lead.conversation_id
    );
  } else if (!lead.conversation_id) {
    await logDocumentDeliverySkipped(
      "missing_conversation_id",
      "Lead has no conversation id for LINE delivery correlation."
    );
  } else {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("line_user_id")
      .eq("id", lead.conversation_id)
      .maybeSingle();

    if (!conversation) {
      await logDocumentDeliverySkipped(
        "conversation_not_found",
        `Conversation ${lead.conversation_id} was not found for document delivery.`,
        lead.conversation_id
      );
    } else if (!conversation.line_user_id) {
      await logDocumentDeliverySkipped(
        "missing_line_user_id",
        "Conversation exists but has no LINE user id for customer delivery.",
        lead.conversation_id
      );
    } else {
      try {
        await pushCommercialDocumentLink({
          userId: conversation.line_user_id,
          quoteToken: quote.public_token,
          documentId: insertedDocument.id,
          documentType: issuePlan.value.documentType,
          documentNumber: insertedDocument.document_number,
        });

        await logSystemAction(supabase, {
          entityType: "quote",
          entityId: order.quote_id,
          actionType: "commercial.document_sent",
          serviceName: "line_push",
          note: "Delivered commercial document link to customer",
          payload: {
            order_id: order.id,
            payment_id: payment.id,
            document_id: insertedDocument.id,
            document_type: issuePlan.value.documentType,
            document_number: insertedDocument.document_number,
            quote_token: quote.public_token,
            conversation_id: lead.conversation_id,
            line_user_id: conversation.line_user_id,
          },
        });
      } catch (error) {
        console.error("Failed to push commercial document link:", error);
      }
    }
  }

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