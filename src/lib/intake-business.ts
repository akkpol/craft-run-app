import { logSystemAction } from "@/lib/action-log";
import { pushQuoteLink, type LineGatewayOptions } from "@/lib/line";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BillingBranchType,
  BillingEntityType,
  DocumentRequestType,
  FulfillmentMode,
  PaymentStatus,
  PaymentTerm,
  WorkflowState,
} from "@/lib/types";
import { getLeadOperationalDefaults } from "@/lib/quote-workflow";
import { getReusableConversationState } from "@/lib/workflow-transitions";

type AdminClient = ReturnType<typeof createAdminClient>;

type ExistingConversation = {
  id: string;
  state?: string | null;
};

type ResolveInboundConversationInput = {
  supabase: AdminClient;
  userId: string;
  existingConversation: ExistingConversation | null;
  midProductionStates: WorkflowState[];
  actionLogPayload?: Record<string, unknown>;
};

export type ResolvedInboundConversation = {
  conversationId: string;
  conversationState: WorkflowState;
  reusedConversation: boolean;
};

export async function resolveInboundConversation(
  input: ResolveInboundConversationInput
): Promise<ResolvedInboundConversation> {
  const reusableCollectionState = getReusableConversationState(
    input.existingConversation?.state,
    "COLLECTING_REQUIREMENTS"
  );
  const reusableReviewState =
    reusableCollectionState ??
    getReusableConversationState(
      input.existingConversation?.state,
      "REQUIREMENTS_REVIEW"
    );
  const isActiveMidProduction =
    !!input.existingConversation &&
    input.midProductionStates.includes(
      input.existingConversation.state as WorkflowState
    );

  if (input.existingConversation && reusableReviewState) {
    const conversationUpdate: {
      last_message_at: string;
      state?: WorkflowState;
    } = {
      last_message_at: new Date().toISOString(),
    };

    if (reusableReviewState !== input.existingConversation.state) {
      conversationUpdate.state = reusableReviewState;
    }

    const { error } = await input.supabase
      .from("conversations")
      .update(conversationUpdate)
      .eq("id", input.existingConversation.id);

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return {
      conversationId: input.existingConversation.id,
      conversationState: reusableReviewState,
      reusedConversation: true,
    };
  }

  if (isActiveMidProduction && input.existingConversation) {
    const { error } = await input.supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", input.existingConversation.id);

    if (error) {
      throw new Error(
        `Failed to update last_message_at for conversation ${input.existingConversation.id}: ${error.message}`
      );
    }

    return {
      conversationId: input.existingConversation.id,
      conversationState: input.existingConversation.state as WorkflowState,
      reusedConversation: true,
    };
  }

  const { data: newConversation, error } = await input.supabase
    .from("conversations")
    .insert({ line_user_id: input.userId, state: "NEW_MESSAGE" })
    .select("id")
    .single();

  if (!newConversation?.id) {
    throw new Error(
      `Failed to create conversation: ${
        error?.message || "conversation insert returned null"
      }`
    );
  }

  await logSystemAction(input.supabase, {
    entityType: "conversation",
    entityId: newConversation.id,
    actionType: "conversation.created",
    serviceName: "webhook",
    note: "New conversation from LINE message",
    payload: {
      state: "NEW_MESSAGE",
      line_user_id: input.userId,
      previous_state: input.existingConversation?.state ?? null,
      ...input.actionLogPayload,
    },
  });

  return {
    conversationId: newConversation.id,
    conversationState: "NEW_MESSAGE",
    reusedConversation: false,
  };
}

export type SimulatedIntakeInput = LineGatewayOptions & {
  supabase: AdminClient;
  lineUserId: string;
  displayName?: string;
  productType?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
  total?: number;
  paymentTerms?: PaymentTerm;
  paymentStatus?: PaymentStatus;
  requestedDocumentType?: DocumentRequestType;
  billingEntityType?: BillingEntityType;
  billingBranchType?: BillingBranchType;
  billingBranchCode?: string | null;
  billingName?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
  customerPhone?: string | null;
  fulfillmentMode?: FulfillmentMode;
  paymentRoutingConfig?: Parameters<typeof resolvePaymentProfileFromConfig>[0];
  simulationRunId?: string;
};

export type SimulatedIntakeResult = {
  conversationId: string;
  customerId: string;
  leadId: string;
  quoteId: string;
  quoteToken: string;
};

function simulationPayload(runId: string | undefined): Record<string, unknown> {
  return runId ? { simulation: true, simulation_run_id: runId } : {};
}

export async function submitSimulatedIntake(
  input: SimulatedIntakeInput
): Promise<SimulatedIntakeResult> {
  const now = new Date().toISOString();
  const paymentTerms = input.paymentTerms ?? "prepaid";
  const paymentStatus =
    input.paymentStatus ?? (paymentTerms === "credit" ? "not_required" : "unpaid");
  const displayName = input.displayName?.trim() || "ลูกค้าจำลอง";
  const requestedDocumentType = input.requestedDocumentType ?? "quote";
  const billingEntityType = input.billingEntityType ?? "person";
  const billingBranchType = input.billingBranchType ?? "head_office";
  const fulfillmentMode = input.fulfillmentMode ?? "delivery";
  const productType = input.productType ?? "vinyl";
  const widthMm = input.widthMm ?? 1000;
  const heightMm = input.heightMm ?? 500;
  const qty = input.qty ?? 1;
  const subtotal = input.total ?? 1200;
  const total = subtotal;
  const auditPayload = simulationPayload(input.simulationRunId);
  const paymentProfileSnapshot = input.paymentRoutingConfig
    ? resolvePaymentProfileFromConfig(input.paymentRoutingConfig, {
        total,
        billingEntityType,
        paymentTerms,
      })
    : null;

  const { data: customer } = await input.supabase
    .from("customers")
    .upsert(
      {
        line_user_id: input.lineUserId,
        display_name: displayName,
        phone: input.customerPhone ?? null,
        updated_at: now,
      },
      { onConflict: "line_user_id" }
    )
    .select("id")
    .single();

  const { data: existingConversationRows } = await input.supabase
    .from("conversations")
    .select("id, state")
    .eq("line_user_id", input.lineUserId)
    .order("created_at", { ascending: false })
    .limit(1);
  const existingConversation = existingConversationRows?.[0] ?? null;

  let conversationId = existingConversation?.id as string | undefined;
  if (!conversationId) {
    const { data: conversation } = await input.supabase
      .from("conversations")
      .insert({ line_user_id: input.lineUserId, state: "REQUIREMENTS_REVIEW" })
      .select("id")
      .single();
    conversationId = conversation?.id;
  } else {
    await input.supabase
      .from("conversations")
      .update({ state: "REQUIREMENTS_REVIEW", last_message_at: now })
      .eq("id", conversationId);
  }

  if (!customer?.id || !conversationId) {
    throw new Error("Failed to create simulated intake customer/conversation");
  }

  const leadDefaults = getLeadOperationalDefaults(fulfillmentMode);
  const { data: lead } = await input.supabase
    .from("leads")
    .insert({
      conversation_id: conversationId,
      customer_id: customer.id,
      product_type: productType,
      product_label_snapshot: productType,
      width_mm: widthMm,
      height_mm: heightMm,
      qty,
      status: "new",
      requested_document_type: requestedDocumentType,
      requested_document_types: ["quote", requestedDocumentType].filter(
        (value, index, values) => values.indexOf(value) === index
      ),
      billing_entity_type: billingEntityType,
      billing_branch_type: billingBranchType,
      billing_branch_code: input.billingBranchCode ?? null,
      billing_name: input.billingName ?? displayName,
      tax_id: input.taxId ?? null,
      billing_address: input.billingAddress ?? null,
      ...leadDefaults,
    })
    .select("id")
    .single();

  if (!lead?.id) {
    throw new Error("Failed to create simulated intake lead");
  }

  const { data: quote } = await input.supabase
    .from("quotes")
    .insert({
      lead_id: lead.id,
      subtotal,
      discount: 0,
      vat: 0,
      total,
      status: "sent",
      public_token: `sim-token-${input.simulationRunId ?? Date.now()}`,
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .select("id, public_token")
    .single();

  if (!quote?.id || !quote.public_token) {
    throw new Error("Failed to create simulated intake quote");
  }

  await input.supabase.from("quote_items").insert({
    quote_id: quote.id,
    label: `${productType} ${widthMm}x${heightMm} mm x ${qty}`,
    qty: 1,
    unit_price: subtotal,
  });

  await input.supabase
    .from("conversations")
    .update({ state: "WAITING_QUOTE_APPROVAL" })
    .eq("id", conversationId);

  await logSystemAction(input.supabase, {
    entityType: "lead",
    entityId: lead.id,
    actionType: "lead.created",
    serviceName: "scenario-runner",
    payload: {
      conversation_id: conversationId,
      product_type: productType,
      to_state: "WAITING_QUOTE_APPROVAL",
      ...auditPayload,
    },
  });

  await logSystemAction(input.supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.created",
    serviceName: "scenario-runner",
    payload: {
      lead_id: lead.id,
      total,
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      payment_profile_source:
        paymentProfileSnapshot?.sourceProfile ?? null,
      payment_profile_reason: paymentProfileSnapshot?.reason ?? null,
      to_state: "WAITING_QUOTE_APPROVAL",
      ...auditPayload,
    },
  });

  await pushQuoteLink(
    input.lineUserId,
    quote.public_token,
    `${productType} ${widthMm}x${heightMm} mm x ${qty}\nTotal: ${total}`,
    {
      lineGateway: input.lineGateway,
      auditSupabase: input.auditSupabase ?? input.supabase,
      actionLogPayload: auditPayload,
      runtimeConfig: input.runtimeConfig,
    }
  );

  await logSystemAction(input.supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.sent",
    serviceName: "scenario-runner",
    payload: {
      lead_id: lead.id,
      quote_token: quote.public_token,
      ...auditPayload,
    },
  });

  return {
    conversationId,
    customerId: customer.id,
    leadId: lead.id,
    quoteId: quote.id,
    quoteToken: quote.public_token,
  };
}
