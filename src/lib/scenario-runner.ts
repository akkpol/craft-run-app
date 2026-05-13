import type { WebhookEvent } from "@line/bot-sdk";

import { logAiAction, logHumanAction, logSystemAction } from "@/lib/action-log";
import { buildCommercialDocumentIssuePlan } from "@/lib/commercial-document-issue";
import {
  validatePaymentConfirm,
  validateReceiverEntityActive,
} from "@/lib/commercial-validation";
import {
  createFakeLineGateway,
  type FakeLineGateway,
  type FakeLineGatewayCall,
} from "@/lib/fake-line-gateway";
import { submitSimulatedIntake } from "@/lib/intake-business";
import {
  pushCommercialDocumentLink,
  pushLeadDesignPreviewUpdate,
  pushStatusUpdate,
} from "@/lib/line";
import { approveQuote, paymentUnlocksProduction } from "@/lib/quote-workflow";
import {
  createScenarioSupabase,
  type ScenarioRow,
  type ScenarioSupabase,
} from "@/lib/scenario-supabase";
import { processWebhookEvent } from "@/lib/webhook-event-processor";
import type {
  BillingEntityType,
  DesignStatus,
  DocumentRequestType,
  JobStatus,
  PaymentStatus,
  PaymentTerm,
} from "@/lib/types";
import { designStatusNeedsCustomerResponse } from "@/lib/types";
import { validateTransition } from "@/lib/workflow-policy-core.mjs";
import { ALLOWED_JOB_TRANSITIONS } from "@/lib/workflow-transitions";

const SIM_LINE_USER_ID = "sim:line:user-001";
const SIM_DISPLAY_NAME = "ลูกค้าจำลอง 001";
const SIM_RUNTIME_CONFIG = {
  baseUrl: "https://sim.fogus.local",
  liffId: "sim-liff-id",
};
const SIM_PRIMARY_RECEIVER_ID = "sim:commercial-entity:main-company";
const SIM_SECONDARY_RECEIVER_ID = "sim:commercial-entity:personal-account";
const SIM_PAYMENT_ROUTING_CONFIG = {
  paymentAccountName: "FOGUS Main Co., Ltd.",
  paymentBankName: "Kasikorn Bank",
  paymentAccountNumber: "111-1-11111-1",
  paymentPromptPayId: "0105555000001",
  paymentQrCodeUrl: "https://sim.fogus.local/qr/main-company.png",
  paymentQrCodeLabel: "FOGUS Main QR",
  paymentDisplayMode: "qr_and_account",
  paymentInstructions: "ชำระเข้าบริษัทหลัก",
  paymentSecondaryAccountName: "FOGUS Small Job",
  paymentSecondaryBankName: "SCB",
  paymentSecondaryAccountNumber: "222-2-22222-2",
  paymentSecondaryPromptPayId: "0812345678",
  paymentSecondaryQrCodeUrl: "https://sim.fogus.local/qr/small-job.png",
  paymentSecondaryQrCodeLabel: "FOGUS Small Job QR",
  paymentSecondaryDisplayMode: "qr_and_account",
  paymentSecondaryInstructions: "ชำระเข้าบัญชีรองสำหรับงานเล็ก",
  paymentSecondaryMaxQuoteTotal: 300,
  paymentSecondaryCustomerScope: "none",
  paymentSecondaryPaymentTermsScope: "none",
} as const;

type AdminClientLike = Parameters<typeof approveQuote>[0];

export type ScenarioSimulationState = {
  stages: string[];
  userId: string;
  displayName: string;
  conversationId?: string;
  customerId?: string;
  leadId?: string;
  quoteId?: string;
  quoteToken?: string;
  jobId?: string | null;
  commercialOrderId?: string;
  paymentId?: string;
  receiverEntityId?: string;
  documentId?: string;
  previewUrls?: string[];
  requiresPayment?: boolean;
};

type ScenarioPaymentRoutingConfig = Parameters<
  typeof submitSimulatedIntake
>[0]["paymentRoutingConfig"];

type ScenarioIntakeOptions = {
  total?: number;
  paymentTerms?: PaymentTerm;
  paymentStatus?: PaymentStatus;
  requestedDocumentType?: DocumentRequestType;
  billingEntityType?: BillingEntityType;
  paymentRoutingConfig?: ScenarioPaymentRoutingConfig;
  billingName?: string;
  taxId?: string;
  billingAddress?: string;
};

type PaymentRoutingExpectation = {
  sourceProfile: "primary" | "secondary";
  reason:
    | "default"
    | "primary_missing"
    | "secondary_total_threshold"
    | "secondary_customer_scope"
    | "secondary_payment_terms";
};

type FullLifecycleScenarioOptions = ScenarioIntakeOptions &
  PaymentRoutingExpectation & {
    name: string;
    expectedDocumentType: "RECEIPT" | "TAX_INVOICE_RECEIPT";
  };

export type ScenarioRunContext<TState> = {
  runId: string;
  scenarioName: string;
  state: TState;
  lineGateway: FakeLineGateway;
  supabase: ScenarioSupabase;
};

export type ScenarioStepResult = {
  key: string;
  title: string;
  startedAt: string;
  endedAt: string;
  transportCalls: FakeLineGatewayCall[];
};

export type ScenarioStep<TState> = {
  key: string;
  title: string;
  run(context: ScenarioRunContext<TState>): Promise<void> | void;
  assert?(
    result: ScenarioStepResult,
    context: ScenarioRunContext<TState>
  ): Promise<void> | void;
};

export type ScenarioDefinition<TState> = {
  name: string;
  initialState: TState | (() => TState);
  steps: ScenarioStep<TState>[];
  runId?: string;
  lineGateway?: FakeLineGateway;
  supabase?: ScenarioSupabase;
};

export type ScenarioRunResult<TState> = {
  runId: string;
  name: string;
  state: TState;
  steps: ScenarioStepResult[];
  transportCalls: FakeLineGatewayCall[];
  lineGateway: FakeLineGateway;
  supabase: ScenarioSupabase;
};

function createScenarioRunId(name: string) {
  const normalizedName =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "scenario";

  return `${normalizedName}-${Date.now()}`;
}

function createInitialState<TState>(state: TState | (() => TState)): TState {
  if (typeof state === "function") {
    return (state as () => TState)();
  }

  return structuredClone(state);
}

function simulationPayload(runId: string) {
  return { simulation: true, simulation_run_id: runId };
}

function createPaymentRoutingConfig(
  overrides: Partial<NonNullable<ScenarioPaymentRoutingConfig>> = {}
): NonNullable<ScenarioPaymentRoutingConfig> {
  return {
    ...SIM_PAYMENT_ROUTING_CONFIG,
    ...overrides,
  };
}

function asAdminClient(supabase: ScenarioSupabase) {
  return supabase as unknown as AdminClientLike;
}

function assertScenario(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function latestRow<T extends ScenarioRow>(
  supabase: ScenarioSupabase,
  tableName: string,
  predicate: (row: T) => boolean = () => true
): T | null {
  const rows = supabase.table<T>(tableName).filter(predicate);
  return rows[rows.length - 1] ?? null;
}

function requiredLatestRow<T extends ScenarioRow>(
  supabase: ScenarioSupabase,
  tableName: string,
  predicate?: (row: T) => boolean
): T {
  const row = latestRow<T>(supabase, tableName, predicate);
  assertScenario(row, `Scenario expected a row in ${tableName}`);
  return row;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getQuotePaymentProfileSnapshot(
  supabase: ScenarioSupabase,
  quoteId?: string
) {
  const quote = requiredLatestRow(supabase, "quotes", (row) =>
    quoteId ? row.id === quoteId : true
  );
  return asRecord(quote.payment_profile_snapshot);
}

function assertPaymentRouting(
  context: ScenarioRunContext<ScenarioSimulationState>,
  expected: PaymentRoutingExpectation
) {
  const snapshot = getQuotePaymentProfileSnapshot(
    context.supabase,
    context.state.quoteId
  );

  assertScenario(snapshot, "Scenario expected quote payment_profile_snapshot");
  assertScenario(
    snapshot.sourceProfile === expected.sourceProfile,
    `Expected payment source ${expected.sourceProfile}, got ${String(snapshot.sourceProfile)}`
  );
  assertScenario(
    snapshot.reason === expected.reason,
    `Expected payment routing reason ${expected.reason}, got ${String(snapshot.reason)}`
  );
}

function createTextMessageEvent(input: {
  userId: string;
  messageId: string;
  replyToken: string;
  text: string;
}): Extract<WebhookEvent, { type: "message" }> {
  return {
    type: "message",
    mode: "active",
    timestamp: Date.now(),
    webhookEventId: `sim:${input.messageId}`,
    deliveryContext: {
      isRedelivery: false,
    },
    source: {
      type: "user",
      userId: input.userId,
    },
    replyToken: input.replyToken,
    message: {
      id: input.messageId,
      type: "text",
      text: input.text,
    },
  } as Extract<WebhookEvent, { type: "message" }>;
}

function createFollowEvent(userId: string): Extract<WebhookEvent, { type: "follow" }> {
  return {
    type: "follow",
    mode: "active",
    timestamp: Date.now(),
    webhookEventId: `sim:follow:${userId}`,
    deliveryContext: {
      isRedelivery: false,
    },
    source: {
      type: "user",
      userId,
    },
    replyToken: `sim:reply:follow:${userId}`,
  } as Extract<WebhookEvent, { type: "follow" }>;
}

async function sendInboundText(
  context: ScenarioRunContext<ScenarioSimulationState>,
  text: string,
  key: string
) {
  await processWebhookEvent(
    createTextMessageEvent({
      userId: context.state.userId,
      messageId: `sim:msg:${context.runId}:${key}`,
      replyToken: `sim:reply:${context.runId}:${key}`,
      text,
    }),
    {
      supabase: asAdminClient(context.supabase),
      lineClient: context.lineGateway,
      runtimeConfig: SIM_RUNTIME_CONFIG,
      simulation: { runId: context.runId },
    }
  );

  const conversation = requiredLatestRow(context.supabase, "conversations");
  context.state.conversationId = String(conversation.id);
}

async function submitIntake(
  context: ScenarioRunContext<ScenarioSimulationState>,
  options: ScenarioIntakeOptions = {}
) {
  const result = await submitSimulatedIntake({
    supabase: asAdminClient(context.supabase),
    lineGateway: context.lineGateway,
    auditSupabase: asAdminClient(context.supabase),
    actionLogPayload: simulationPayload(context.runId),
    runtimeConfig: SIM_RUNTIME_CONFIG,
    lineUserId: context.state.userId,
    displayName: context.state.displayName,
    productType: "vinyl",
    widthMm: 1200,
    heightMm: 800,
    qty: 2,
    total: options.total ?? 2400,
    paymentTerms: options.paymentTerms ?? "prepaid",
    paymentStatus: options.paymentStatus,
    requestedDocumentType: options.requestedDocumentType ?? "quote",
    billingEntityType: options.billingEntityType ?? "person",
    billingName: options.billingName,
    taxId: options.taxId,
    billingAddress: options.billingAddress,
    paymentRoutingConfig:
      options.paymentRoutingConfig ?? createPaymentRoutingConfig(),
    simulationRunId: context.runId,
  });

  context.state.conversationId = result.conversationId;
  context.state.customerId = result.customerId;
  context.state.leadId = result.leadId;
  context.state.quoteId = result.quoteId;
  context.state.quoteToken = result.quoteToken;
}

async function approveLatestQuote(context: ScenarioRunContext<ScenarioSimulationState>) {
  const quote = requiredLatestRow(context.supabase, "quotes", (row) =>
    context.state.quoteId ? row.id === context.state.quoteId : true
  );
  const lead = requiredLatestRow(context.supabase, "leads", (row) => row.id === quote.lead_id);
  const jobs = context.supabase
    .table("jobs")
    .filter((row) => row.quote_id === quote.id)
    .map((row) => ({ id: String(row.id) }));

  const result = await approveQuote(
    asAdminClient(context.supabase),
    {
      id: String(quote.id),
      lead_id: String(quote.lead_id),
      public_token: String(quote.public_token),
      total: Number(quote.total ?? 0),
      status: quote.status as never,
      payment_terms: quote.payment_terms as PaymentTerm,
      payment_status: quote.payment_status as PaymentStatus,
      payment_profile_snapshot: quote.payment_profile_snapshot ?? null,
      jobs,
      leads: {
        conversation_id: String(lead.conversation_id),
      },
    },
    {
      lineGateway: context.lineGateway,
      auditSupabase: asAdminClient(context.supabase),
      actionLogPayload: simulationPayload(context.runId),
      runtimeConfig: SIM_RUNTIME_CONFIG,
    }
  );

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: String(quote.id),
    actionType: "quote.approved",
    actorId: context.state.userId,
    actorLabel: context.state.displayName,
    payload: {
      requires_payment: result.requiresPayment,
      job_id: result.jobId,
      ...simulationPayload(context.runId),
    },
  });

  context.state.requiresPayment = result.requiresPayment;
  context.state.jobId = result.jobId;
}

function seedCommercialReceiverEntities(supabase: ScenarioSupabase) {
  supabase.upsertRow(
    "commercial_entities",
    {
      id: SIM_PRIMARY_RECEIVER_ID,
      role: "MAIN_COMPANY",
      is_vat_registered: true,
      active: true,
      legal_name: "FOGUS Main Co., Ltd.",
      display_name: "FOGUS Main",
      tax_id: "0105555000001",
      branch_type: "head_office",
      branch_code: null,
      branch_name: null,
      address: "1 Main Road Bangkok",
    },
    ["id"]
  );

  supabase.upsertRow(
    "commercial_entities",
    {
      id: SIM_SECONDARY_RECEIVER_ID,
      role: "PERSONAL_ACCOUNT",
      is_vat_registered: false,
      active: true,
      legal_name: "FOGUS Small Job",
      display_name: "FOGUS Small Job",
      tax_id: null,
      branch_type: null,
      branch_code: null,
      branch_name: null,
      address: "Scenario secondary receiver",
    },
    ["id"]
  );
}

function createScenarioCustomerTaxProfile(
  context: ScenarioRunContext<ScenarioSimulationState>,
  lead: ScenarioRow
) {
  assertScenario(context.state.customerId, "Scenario expected customerId for tax profile");

  return context.supabase.insertRow("customer_tax_profiles", {
    customer_id: context.state.customerId,
    legal_name: lead.billing_name ?? context.state.displayName,
    tax_id: lead.tax_id ?? "0105555000001",
    branch_type: lead.billing_branch_type ?? "head_office",
    branch_code: lead.billing_branch_code ?? null,
    branch_name: null,
    address: lead.billing_address ?? "Scenario billing address",
    email: "scenario@example.test",
    phone: "0800000000",
  });
}

async function confirmPayment(context: ScenarioRunContext<ScenarioSimulationState>) {
  assertScenario(context.state.quoteId, "Scenario expected quoteId before payment");
  assertScenario(context.state.customerId, "Scenario expected customerId before payment");

  seedCommercialReceiverEntities(context.supabase);

  const quote = requiredLatestRow(context.supabase, "quotes", (row) =>
    context.state.quoteId ? row.id === context.state.quoteId : false
  );
  const lead = requiredLatestRow(context.supabase, "leads", (row) => row.id === quote.lead_id);
  const profileSnapshot = asRecord(quote.payment_profile_snapshot);
  const receiverEntityId =
    profileSnapshot?.sourceProfile === "secondary"
      ? SIM_SECONDARY_RECEIVER_ID
      : SIM_PRIMARY_RECEIVER_ID;
  const receiverEntity = requiredLatestRow(context.supabase, "commercial_entities", (row) =>
    row.id === receiverEntityId
  );
  const now = new Date().toISOString();
  const requestedDocumentType = String(
    lead.requested_document_type ?? "quote"
  ) as DocumentRequestType;
  const customerTaxProfileId =
    requestedDocumentType === "tax_invoice"
      ? createScenarioCustomerTaxProfile(context, lead).id
      : null;
  const order = context.supabase.insertRow("commercial_orders", {
    quote_id: quote.id,
    customer_id: context.state.customerId,
    selected_receiver_entity_id: receiverEntityId,
    payment_receiver_locked_at: null,
    customer_tax_profile_id: customerTaxProfileId,
  });
  const payment = context.supabase.insertRow("payments", {
    order_id: order.id,
    receiver_entity_id: receiverEntityId,
    status: "PENDING",
    amount: Number(quote.total ?? 0),
    currency: "THB",
    proof_reference: `sim-proof-${context.runId}`,
    proof_received_at: now,
  });

  const confirmValidation = validatePaymentConfirm({
    paymentReceiverEntityId: String(payment.receiver_entity_id),
    selectedReceiverEntityId: String(order.selected_receiver_entity_id),
    paymentReceiverLockedAt: null,
  });
  assertScenario(
    confirmValidation.ok,
    confirmValidation.ok ? "" : confirmValidation.detail
  );

  const entityValidation = validateReceiverEntityActive({
    id: String(receiverEntity.id),
    active: Boolean(receiverEntity.active),
  });
  assertScenario(entityValidation.ok, entityValidation.ok ? "" : entityValidation.detail);

  await context.supabase
    .from("payments")
    .update({ status: "CONFIRMED", paid_at: now })
    .eq("id", payment.id);

  await context.supabase
    .from("commercial_orders")
    .update({ payment_receiver_locked_at: now })
    .eq("id", order.id);

  await context.supabase
    .from("quotes")
    .update({ payment_status: "paid" })
    .eq("id", context.state.quoteId);

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: context.state.quoteId,
    actionType: "quote.payment_updated",
    actorLabel: "Admin",
    payload: {
      payment_status: "paid",
      ...simulationPayload(context.runId),
    },
  });

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: context.state.quoteId,
    actionType: "commercial.payment_confirmed",
    actorLabel: "Admin",
    payload: {
      payment_id: payment.id,
      order_id: order.id,
      receiver_entity_id: receiverEntityId,
      amount: quote.total,
      payment_receiver_locked_at: now,
      ...simulationPayload(context.runId),
    },
  });

  await approveLatestQuote(context);
  await context.supabase
    .from("quote_payment_records")
    .update({
      proof_reference: payment.proof_reference,
      proof_received_at: payment.proof_received_at,
      note: "Scenario admin approved deterministic payment proof",
    })
    .eq("quote_id", context.state.quoteId);

  const job = requiredLatestRow(context.supabase, "jobs", (row) =>
    context.state.quoteId ? row.quote_id === context.state.quoteId : false
  );
  context.state.commercialOrderId = String(order.id);
  context.state.paymentId = String(payment.id);
  context.state.receiverEntityId = receiverEntityId;
  context.state.jobId = String(job.id);
}

async function issueCommercialDocument(
  context: ScenarioRunContext<ScenarioSimulationState>
) {
  assertScenario(context.state.quoteId, "Scenario expected quoteId before document issue");
  assertScenario(context.state.quoteToken, "Scenario expected quoteToken before document issue");
  assertScenario(context.state.paymentId, "Scenario expected paymentId before document issue");
  assertScenario(
    context.state.commercialOrderId,
    "Scenario expected commercialOrderId before document issue"
  );

  const payment = requiredLatestRow(context.supabase, "payments", (row) =>
    row.id === context.state.paymentId
  );
  const order = requiredLatestRow(context.supabase, "commercial_orders", (row) =>
    row.id === context.state.commercialOrderId
  );
  const quote = requiredLatestRow(context.supabase, "quotes", (row) =>
    row.id === context.state.quoteId
  );
  const lead = requiredLatestRow(context.supabase, "leads", (row) => row.id === quote.lead_id);
  const receiverEntity = requiredLatestRow(context.supabase, "commercial_entities", (row) =>
    row.id === payment.receiver_entity_id
  );
  const customerTaxProfile = order.customer_tax_profile_id
    ? requiredLatestRow(context.supabase, "customer_tax_profiles", (row) =>
        row.id === order.customer_tax_profile_id
      )
    : null;

  const issuePlan = buildCommercialDocumentIssuePlan({
    paymentStatus: String(payment.status),
    paymentReceiverEntityId: String(payment.receiver_entity_id),
    selectedReceiverEntityId: String(order.selected_receiver_entity_id ?? ""),
    paymentReceiverLockedAt: String(order.payment_receiver_locked_at ?? ""),
    customerId: String(order.customer_id),
    customerTaxProfileId: order.customer_tax_profile_id
      ? String(order.customer_tax_profile_id)
      : null,
    customerTaxProfileCustomerId: customerTaxProfile?.customer_id
      ? String(customerTaxProfile.customer_id)
      : null,
    customerRequestsTaxInvoice: lead.requested_document_type === "tax_invoice",
    quoteSubtotal: Number(quote.subtotal ?? 0),
    quoteDiscount: Number(quote.discount ?? 0),
    quoteVat: Number(quote.vat ?? 0),
    quoteTotal: Number(quote.total ?? 0),
    receiverEntity: {
      id: String(receiverEntity.id),
      role: receiverEntity.role as never,
      isVatRegistered: Boolean(receiverEntity.is_vat_registered),
      active: Boolean(receiverEntity.active),
    },
    issuedAt: String(payment.paid_at ?? new Date().toISOString()),
  });

  assertScenario(issuePlan.ok, issuePlan.ok ? "" : issuePlan.detail);

  const documentNumber = `${issuePlan.value.prefix}-${issuePlan.value.sequenceYear}-SIM-${String(
    context.supabase.table("commercial_documents").length + 1
  ).padStart(4, "0")}`;
  const document = context.supabase.insertRow("commercial_documents", {
    order_id: order.id,
    quote_id: context.state.quoteId,
    payment_id: payment.id,
    issuer_entity_id: receiverEntity.id,
    customer_id: order.customer_id,
    customer_tax_profile_id: order.customer_tax_profile_id ?? null,
    document_type: issuePlan.value.documentType,
    document_number: documentNumber,
    status: "ISSUED",
    vat_mode: issuePlan.value.vatMode,
    vat_rate: issuePlan.value.vatRate,
    subtotal: issuePlan.value.subtotal,
    discount_amount: issuePlan.value.discountAmount,
    vat_amount: issuePlan.value.vatAmount,
    grand_total: issuePlan.value.grandTotal,
    issued_at: issuePlan.value.issuedAt,
    locked_at: issuePlan.value.lockedAt,
    snapshot_json: {
      policy_version: "COMMERCIAL_DOCUMENT_POLICY_V1",
      order_id: order.id,
      quote_id: quote.id,
      payment_id: payment.id,
      issuer: {
        id: receiverEntity.id,
        role: receiverEntity.role,
        is_vat_registered: receiverEntity.is_vat_registered,
      },
      customer: {
        id: order.customer_id,
        tax_profile_id: order.customer_tax_profile_id ?? null,
        requested_document_type: lead.requested_document_type ?? null,
      },
      totals: {
        subtotal: issuePlan.value.subtotal,
        discount_amount: issuePlan.value.discountAmount,
        vat_amount: issuePlan.value.vatAmount,
        grand_total: issuePlan.value.grandTotal,
      },
    },
  });
  context.state.documentId = String(document.id);

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: context.state.quoteId,
    actionType: "commercial.document_number_generated",
    actorLabel: "Admin",
    payload: {
      order_id: order.id,
      payment_id: payment.id,
      issuer_entity_id: receiverEntity.id,
      document_type: issuePlan.value.documentType,
      document_number: documentNumber,
      sequence_year: issuePlan.value.sequenceYear,
      prefix: issuePlan.value.prefix,
      ...simulationPayload(context.runId),
    },
  });

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: context.state.quoteId,
    actionType: "commercial.document_issued",
    actorLabel: "Admin",
    payload: {
      document_id: document.id,
      document_type: document.document_type,
      document_number: document.document_number,
      order_id: order.id,
      payment_id: payment.id,
      receiver_entity_id: payment.receiver_entity_id,
      ...simulationPayload(context.runId),
    },
  });

  await pushCommercialDocumentLink(
    {
      userId: context.state.userId,
      quoteToken: context.state.quoteToken,
      documentId: String(document.id),
      documentType: String(document.document_type),
      documentNumber: String(document.document_number),
    },
    {
      lineGateway: context.lineGateway,
      auditSupabase: asAdminClient(context.supabase),
      actionLogPayload: simulationPayload(context.runId),
      runtimeConfig: SIM_RUNTIME_CONFIG,
    }
  );

  await logSystemAction(asAdminClient(context.supabase), {
    entityType: "quote",
    entityId: context.state.quoteId,
    actionType: "commercial.document_sent",
    serviceName: "scenario-runner",
    payload: {
      document_id: document.id,
      line_user_id: context.state.userId,
      ...simulationPayload(context.runId),
    },
  });
}

function appendNote(existing: unknown, note: string) {
  const existingText = typeof existing === "string" ? existing.trim() : "";
  return existingText ? `${existingText}\n${note}` : note;
}

async function generateFakeAiPreview(
  context: ScenarioRunContext<ScenarioSimulationState>
) {
  assertScenario(context.state.leadId, "Scenario expected leadId before AI preview");
  assertScenario(context.state.jobId, "Scenario expected jobId before AI preview");
  assertScenario(context.state.quoteToken, "Scenario expected quoteToken before AI preview");

  const previewUrls = [
    `${SIM_RUNTIME_CONFIG.baseUrl}/scenario/${context.runId}/ai-preview-1.png`,
  ];

  await context.supabase
    .from("leads")
    .update({
      ai_image_status: "generated",
      ai_generated_images: previewUrls,
      ai_prompt_snapshot: "scenario deterministic AI preview prompt",
      design_status: "preview_sent",
      design_assignment_mode: "auto",
      design_executor: "ai",
      hold_reason: null,
    })
    .eq("id", context.state.leadId);

  await context.supabase
    .from("jobs")
    .update({ status: "ON_HOLD_CUSTOMER_INPUT", production_status: "queued" })
    .eq("id", context.state.jobId);

  await context.supabase.from("job_timeline").insert({
    job_id: context.state.jobId,
    status: "ON_HOLD_CUSTOMER_INPUT",
    note: "Scenario AI preview generated and waits for customer approval",
  });

  if (context.state.conversationId) {
    await context.supabase
      .from("conversations")
      .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
      .eq("id", context.state.conversationId);
  }

  await logAiAction(asAdminClient(context.supabase), {
    entityType: "lead",
    entityId: context.state.leadId,
    actionType: "ai.preview_generated",
    actorId: "scenario-fake-ai",
    actorLabel: "Scenario fake AI",
    payload: {
      preview_count: previewUrls.length,
      quote_token: context.state.quoteToken,
      job_id: context.state.jobId,
      ...simulationPayload(context.runId),
    },
  });

  context.state.previewUrls = previewUrls;
}

async function sendFakeDesignPreview(
  context: ScenarioRunContext<ScenarioSimulationState>
) {
  assertScenario(context.state.leadId, "Scenario expected leadId before preview send");
  assertScenario(context.state.jobId, "Scenario expected jobId before preview send");
  assertScenario(context.state.quoteToken, "Scenario expected quoteToken before preview send");

  const lead = requiredLatestRow(context.supabase, "leads", (row) =>
    row.id === context.state.leadId
  );
  const previewUrls = Array.isArray(lead.ai_generated_images)
    ? lead.ai_generated_images.filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    : [];
  assertScenario(previewUrls.length > 0, "Scenario expected generated preview URLs");

  await pushLeadDesignPreviewUpdate(
    {
      userId: context.state.userId,
      statusToken: context.state.quoteToken,
      note: "Scenario admin approved preview",
      assetUrls: previewUrls,
    },
    {
      lineGateway: context.lineGateway,
      auditSupabase: asAdminClient(context.supabase),
      actionLogPayload: simulationPayload(context.runId),
      runtimeConfig: SIM_RUNTIME_CONFIG,
    }
  );

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "lead",
    entityId: context.state.leadId,
    actionType: "lead.design_preview_sent",
    actorId: "scenario-admin",
    actorLabel: "Scenario Admin",
    note: "ส่งแบบให้ลูกค้าตรวจผ่าน fake LINE",
    payload: {
      preview_count: previewUrls.length,
      quote_token: context.state.quoteToken,
      job_id: context.state.jobId,
      ...simulationPayload(context.runId),
    },
  });
}

async function approveFakeDesignAsCustomer(
  context: ScenarioRunContext<ScenarioSimulationState>
) {
  assertScenario(context.state.leadId, "Scenario expected leadId before design approval");
  assertScenario(context.state.jobId, "Scenario expected jobId before design approval");

  const lead = requiredLatestRow(context.supabase, "leads", (row) =>
    row.id === context.state.leadId
  );
  const job = requiredLatestRow(context.supabase, "jobs", (row) =>
    row.id === context.state.jobId
  );
  assertScenario(
    designStatusNeedsCustomerResponse(lead.design_status as DesignStatus),
    "Scenario expected design preview to wait for customer approval"
  );

  await context.supabase
    .from("leads")
    .update({
      design_status: "approved",
      hold_reason: null,
      note_from_chat: appendNote(lead.note_from_chat, "อนุมัติแบบ: scenario customer approved"),
    })
    .eq("id", context.state.leadId);

  if (job.status === "ON_HOLD_CUSTOMER_INPUT") {
    await context.supabase
      .from("jobs")
      .update({ status: "IN_DESIGN", production_status: "queued" })
      .eq("id", context.state.jobId);

    await context.supabase.from("job_timeline").insert({
      job_id: context.state.jobId,
      status: "IN_DESIGN",
      note: "Scenario customer approved design",
    });
  }

  if (context.state.conversationId) {
    await context.supabase
      .from("conversations")
      .update({ state: "IN_DESIGN" })
      .eq("id", context.state.conversationId);
  }

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "lead",
    entityId: context.state.leadId,
    actionType: "lead.design_status_changed",
    actorId: context.state.userId,
    actorLabel: context.state.displayName,
    note: "ลูกค้าจำลองอนุมัติแบบแล้ว",
    payload: {
      design_status: "approved",
      job_id: context.state.jobId,
      ...simulationPayload(context.runId),
    },
  });
}

function getLeadStatusForJobStatus(status: JobStatus): string {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "IN_PRODUCTION" || status === "READY_FOR_FULFILLMENT") {
    return "in_progress";
  }

  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "approved";
}

async function moveScenarioJob(
  context: ScenarioRunContext<ScenarioSimulationState>,
  nextStatus: JobStatus,
  note: string
) {
  assertScenario(context.state.jobId, "Scenario expected jobId before job transition");
  assertScenario(context.state.quoteId, "Scenario expected quoteId before job transition");
  assertScenario(context.state.quoteToken, "Scenario expected quoteToken before job transition");

  const job = requiredLatestRow(context.supabase, "jobs", (row) =>
    row.id === context.state.jobId
  );
  const quote = requiredLatestRow(context.supabase, "quotes", (row) =>
    row.id === context.state.quoteId
  );
  const lead = requiredLatestRow(context.supabase, "leads", (row) => row.id === job.lead_id);
  const currentStatus = job.status as JobStatus;

  assertScenario(
    ALLOWED_JOB_TRANSITIONS[currentStatus]?.includes(nextStatus),
    `Invalid scenario transition from ${currentStatus} to ${nextStatus}`
  );

  if (nextStatus === "IN_PRODUCTION") {
    const paymentTerms = quote.payment_terms as PaymentTerm;
    const paymentStatus = quote.payment_status as PaymentStatus;
    const paymentReady = paymentUnlocksProduction(paymentTerms, paymentStatus);
    const commercialOrder = requiredLatestRow(context.supabase, "commercial_orders", (row) =>
      row.quote_id === quote.id
    );
    const issuedDocument = latestRow(context.supabase, "commercial_documents", (row) =>
      row.order_id === commercialOrder.id && row.status === "ISSUED"
    );
    const requestedDocumentType = lead.requested_document_type || null;
    const requiredCommercialDocumentType = paymentReady
      ? requestedDocumentType === "tax_invoice"
        ? "tax_invoice"
        : requestedDocumentType === "receipt"
          ? "receipt"
          : null
      : null;
    const transitionValidation = validateTransition({
      entity: "job",
      action: "move_to_production",
      from_state: {
        job_status: currentStatus,
        design_status: String(lead.design_status ?? ""),
        payment_terms: paymentTerms,
        payment_status: paymentStatus,
        required_document_type: requiredCommercialDocumentType,
        required_document_issued: Boolean(issuedDocument?.id),
        commercial_review_required:
          Boolean(requiredCommercialDocumentType) &&
          (!commercialOrder.selected_receiver_entity_id ||
            !commercialOrder.payment_receiver_locked_at),
        payment_receiver_locked: Boolean(commercialOrder.payment_receiver_locked_at),
      },
    });

    assertScenario(
      transitionValidation.decision === "allowed",
      `Workflow policy blocked production: ${transitionValidation.reason}`
    );
  }

  const jobUpdate: Record<string, string | null> = { status: nextStatus };
  if (nextStatus === "IN_PRODUCTION") {
    jobUpdate.production_status = "in_progress";
    jobUpdate.fulfillment_status = "not_ready";
  }
  if (nextStatus === "READY_FOR_FULFILLMENT") {
    jobUpdate.production_status = "done";
    jobUpdate.fulfillment_status = "ready";
  }
  if (nextStatus === "COMPLETED") {
    jobUpdate.production_status = "done";
    jobUpdate.fulfillment_status =
      lead.fulfillment_mode === "pickup" ? "picked_up" : "delivered";
    jobUpdate.completion_package_status = "sent";
    jobUpdate.completed_at = new Date().toISOString();
  }

  await context.supabase.from("jobs").update(jobUpdate).eq("id", context.state.jobId);

  await context.supabase.from("job_timeline").insert({
    job_id: context.state.jobId,
    status: nextStatus,
    note,
  });

  if (context.state.conversationId) {
    await context.supabase
      .from("conversations")
      .update({ state: nextStatus })
      .eq("id", context.state.conversationId);
  }

  const leadUpdate: Record<string, string | null> = {
    status: getLeadStatusForJobStatus(nextStatus),
    hold_reason: null,
    human_review_reason: null,
  };
  if (nextStatus === "IN_PRODUCTION") {
    leadUpdate.design_status = "approved";
  }

  await context.supabase.from("leads").update(leadUpdate).eq("id", job.lead_id);

  await pushStatusUpdate(context.state.userId, nextStatus, context.state.quoteToken, {
    lineGateway: context.lineGateway,
    auditSupabase: asAdminClient(context.supabase),
    actionLogPayload: simulationPayload(context.runId),
    runtimeConfig: SIM_RUNTIME_CONFIG,
  });

  await logHumanAction(asAdminClient(context.supabase), {
    entityType: "job",
    entityId: context.state.jobId,
    actionType: "job.status_changed",
    actorId: "scenario-admin",
    actorLabel: "Scenario Admin",
    note,
    payload: {
      from: currentStatus,
      to: nextStatus,
      ...simulationPayload(context.runId),
    },
  });
}

async function completeScenarioProduction(
  context: ScenarioRunContext<ScenarioSimulationState>
) {
  await moveScenarioJob(context, "IN_PRODUCTION", "Scenario starts production");
  await moveScenarioJob(
    context,
    "READY_FOR_FULFILLMENT",
    "Scenario production ready for fulfillment"
  );
  await moveScenarioJob(context, "COMPLETED", "Scenario production completed");
}

function defaultState(): ScenarioSimulationState {
  return {
    stages: [],
    userId: SIM_LINE_USER_ID,
    displayName: SIM_DISPLAY_NAME,
  };
}

export async function runScenario<TState>(
  definition: ScenarioDefinition<TState>
): Promise<ScenarioRunResult<TState>> {
  const state = createInitialState(definition.initialState);
  const lineGateway =
    definition.lineGateway ??
    createFakeLineGateway({
      profiles: {
        [SIM_LINE_USER_ID]: { displayName: SIM_DISPLAY_NAME },
      },
    });
  const supabase = definition.supabase ?? createScenarioSupabase();
  const runId = definition.runId ?? createScenarioRunId(definition.name);
  const context: ScenarioRunContext<TState> = {
    runId,
    scenarioName: definition.name,
    state,
    lineGateway,
    supabase,
  };
  const steps: ScenarioStepResult[] = [];

  for (const step of definition.steps) {
    const startedAt = new Date().toISOString();
    const callStartIndex = lineGateway.getCalls().length;

    await step.run(context);

    const endedAt = new Date().toISOString();
    const transportCalls = lineGateway.getCalls().slice(callStartIndex);
    const result: ScenarioStepResult = {
      key: step.key,
      title: step.title,
      startedAt,
      endedAt,
      transportCalls,
    };

    if (step.assert) {
      await step.assert(result, context);
    }

    steps.push(result);
  }

  return {
    runId,
    name: definition.name,
    state,
    steps,
    transportCalls: lineGateway.getCalls(),
    lineGateway,
    supabase,
  };
}

const inboundLeadStep: ScenarioStep<ScenarioSimulationState> = {
  key: "line-inbound-new-lead",
  title: "Fake customer sends first LINE message",
  async run(context) {
    context.state.stages.push("line-inbound-new-lead");
    await processWebhookEvent(createFollowEvent(context.state.userId), {
      supabase: asAdminClient(context.supabase),
      lineClient: context.lineGateway,
      runtimeConfig: SIM_RUNTIME_CONFIG,
      simulation: { runId: context.runId },
    });
    await sendInboundText(context, "สวัสดี ขอใบเสนอราคา", "new-lead");
  },
  assert(_result, context) {
    const conversation = requiredLatestRow(context.supabase, "conversations");
    assertScenario(
      conversation.state === "COLLECTING_REQUIREMENTS",
      "New lead scenario must move conversation to COLLECTING_REQUIREMENTS"
    );
  },
};

const submitQuoteIntakeStep: ScenarioStep<ScenarioSimulationState> = {
  key: "submit-intake-create-quote",
  title: "Fake LIFF intake creates lead and quote",
  async run(context) {
    context.state.stages.push("submit-intake-create-quote");
    await submitIntake(context, { paymentTerms: "prepaid" });
  },
  assert(_result, context) {
    const conversation = requiredLatestRow(context.supabase, "conversations", (row) =>
      context.state.conversationId ? row.id === context.state.conversationId : true
    );
    const quote = requiredLatestRow(context.supabase, "quotes");
    assertScenario(
      conversation.state === "WAITING_QUOTE_APPROVAL",
      "Intake must move conversation to WAITING_QUOTE_APPROVAL"
    );
    assertScenario(quote.status === "sent", "Intake must create a sent quote");
  },
};

function createSubmitQuoteIntakeStep(
  options: ScenarioIntakeOptions,
  expectedPaymentRouting?: PaymentRoutingExpectation
): ScenarioStep<ScenarioSimulationState> {
  return {
    ...submitQuoteIntakeStep,
    async run(context) {
      context.state.stages.push("submit-intake-create-quote");
      await submitIntake(context, options);
    },
    assert(result, context) {
      submitQuoteIntakeStep.assert?.(result, context);
      if (expectedPaymentRouting) {
        assertPaymentRouting(context, expectedPaymentRouting);
      }
    },
  };
}

const approveQuoteStep: ScenarioStep<ScenarioSimulationState> = {
  key: "customer-approves-quote",
  title: "Fake customer approves quote",
  async run(context) {
    context.state.stages.push("customer-approves-quote");
    await approveLatestQuote(context);
  },
  assert(_result, context) {
    const conversation = requiredLatestRow(context.supabase, "conversations", (row) =>
      context.state.conversationId ? row.id === context.state.conversationId : true
    );
    assertScenario(
      conversation.state === "WAITING_PAYMENT",
      "Prepaid approved quote must wait for payment"
    );
    assertScenario(context.state.requiresPayment, "Quote approval must require payment");
  },
};

const confirmPaymentStep: ScenarioStep<ScenarioSimulationState> = {
  key: "admin-confirms-payment",
  title: "Fake admin confirms payment and unlocks production",
  async run(context) {
    context.state.stages.push("admin-confirms-payment");
    await confirmPayment(context);
  },
  assert(_result, context) {
    const conversation = requiredLatestRow(context.supabase, "conversations", (row) =>
      context.state.conversationId ? row.id === context.state.conversationId : true
    );
    const job = requiredLatestRow(context.supabase, "jobs");
    assertScenario(conversation.state === "IN_DESIGN", "Payment must unlock IN_DESIGN");
    assertScenario(job.status === "IN_DESIGN", "Payment must create an IN_DESIGN job");
  },
};

const issueDocumentStep: ScenarioStep<ScenarioSimulationState> = {
  key: "issue-commercial-document",
  title: "Fake admin issues and sends commercial document",
  async run(context) {
    context.state.stages.push("issue-commercial-document");
    await issueCommercialDocument(context);
  },
  assert(result, context) {
    const document = requiredLatestRow(context.supabase, "commercial_documents");
    assertScenario(document.status === "ISSUED", "Document scenario must issue a document");
    assertScenario(
      result.transportCalls.some((call) => call.method === "pushMessage"),
      "Document scenario must push a document link"
    );
  },
};

function createIssueDocumentStep(
  expectedDocumentType: "RECEIPT" | "TAX_INVOICE_RECEIPT"
): ScenarioStep<ScenarioSimulationState> {
  return {
    ...issueDocumentStep,
    assert(result, context) {
      issueDocumentStep.assert?.(result, context);
      const document = requiredLatestRow(context.supabase, "commercial_documents");
      assertScenario(
        document.document_type === expectedDocumentType,
        `Expected ${expectedDocumentType}, got ${String(document.document_type)}`
      );
    },
  };
}

const generateFakeAiPreviewStep: ScenarioStep<ScenarioSimulationState> = {
  key: "fake-ai-generates-preview",
  title: "Fake deterministic AI generates a design preview",
  async run(context) {
    context.state.stages.push("fake-ai-generates-preview");
    await generateFakeAiPreview(context);
  },
  assert(_result, context) {
    const lead = requiredLatestRow(context.supabase, "leads", (row) =>
      context.state.leadId ? row.id === context.state.leadId : true
    );
    const job = requiredLatestRow(context.supabase, "jobs", (row) =>
      context.state.jobId ? row.id === context.state.jobId : true
    );
    assertScenario(lead.ai_image_status === "generated", "AI preview must be generated");
    assertScenario(lead.design_status === "preview_sent", "Design preview must wait for customer");
    assertScenario(
      job.status === "ON_HOLD_CUSTOMER_INPUT",
      "Generated preview must hold the job for customer input"
    );
  },
};

const sendDesignPreviewStep: ScenarioStep<ScenarioSimulationState> = {
  key: "admin-sends-design-preview",
  title: "Fake admin sends the AI preview to LINE",
  async run(context) {
    context.state.stages.push("admin-sends-design-preview");
    await sendFakeDesignPreview(context);
  },
  assert(result) {
    assertScenario(
      result.transportCalls.some((call) => call.method === "pushMessage"),
      "Design preview step must push a LINE preview"
    );
  },
};

const approveDesignStep: ScenarioStep<ScenarioSimulationState> = {
  key: "customer-approves-design-preview",
  title: "Fake customer approves the design preview",
  async run(context) {
    context.state.stages.push("customer-approves-design-preview");
    await approveFakeDesignAsCustomer(context);
  },
  assert(_result, context) {
    const lead = requiredLatestRow(context.supabase, "leads", (row) =>
      context.state.leadId ? row.id === context.state.leadId : true
    );
    const job = requiredLatestRow(context.supabase, "jobs", (row) =>
      context.state.jobId ? row.id === context.state.jobId : true
    );
    const conversation = requiredLatestRow(context.supabase, "conversations", (row) =>
      context.state.conversationId ? row.id === context.state.conversationId : true
    );
    assertScenario(lead.design_status === "approved", "Customer must approve design");
    assertScenario(job.status === "IN_DESIGN", "Customer approval must resume design job");
    assertScenario(conversation.state === "IN_DESIGN", "Conversation must resume IN_DESIGN");
  },
};

const completeProductionStep: ScenarioStep<ScenarioSimulationState> = {
  key: "complete-production",
  title: "Fake admin completes production",
  async run(context) {
    context.state.stages.push("complete-production");
    await completeScenarioProduction(context);
  },
  assert(_result, context) {
    const job = requiredLatestRow(context.supabase, "jobs", (row) =>
      context.state.jobId ? row.id === context.state.jobId : true
    );
    const lead = requiredLatestRow(context.supabase, "leads", (row) =>
      context.state.leadId ? row.id === context.state.leadId : true
    );
    const conversation = requiredLatestRow(context.supabase, "conversations", (row) =>
      context.state.conversationId ? row.id === context.state.conversationId : true
    );
    assertScenario(job.status === "COMPLETED", "Job must complete production");
    assertScenario(job.production_status === "done", "Completed job must have done production");
    assertScenario(
      job.completion_package_status === "sent",
      "Completed job must send completion package"
    );
    assertScenario(lead.status === "completed", "Lead must finish as completed");
    assertScenario(conversation.state === "COMPLETED", "Conversation must finish as completed");
  },
};

const escalationStep: ScenarioStep<ScenarioSimulationState> = {
  key: "customer-escalates-to-human",
  title: "Fake customer requests human support",
  async run(context) {
    context.state.stages.push("customer-escalates-to-human");
    await sendInboundText(context, "ขอคุยกับแอดมิน", "escalation");
  },
  assert(result, context) {
    const conversation = requiredLatestRow(context.supabase, "conversations");
    const escalation = requiredLatestRow(context.supabase, "escalations");
    assertScenario(
      conversation.state === "HUMAN_REVIEW_REQUIRED",
      "Escalation must move conversation to HUMAN_REVIEW_REQUIRED"
    );
    assertScenario(escalation.status === "open", "Escalation row must be open");
    assertScenario(
      result.transportCalls.some((call) => call.method === "replyMessage"),
      "Escalation must send an acknowledgement reply"
    );
  },
};

function assertSimulationAudit(result: ScenarioRunResult<ScenarioSimulationState>) {
  const simulatedActions = result.supabase
    .table("action_log")
    .filter((row) => {
      const payload = row.payload as Record<string, unknown> | null | undefined;
      return payload?.simulation === true;
    });

  assertScenario(
    simulatedActions.length > 0,
    `${result.name} must write simulation-tagged action_log rows`
  );
}

export const newLeadScenario: ScenarioDefinition<ScenarioSimulationState> = {
  name: "new-lead",
  initialState: defaultState,
  steps: [inboundLeadStep],
};

export const quoteScenario: ScenarioDefinition<ScenarioSimulationState> = {
  name: "quote",
  initialState: defaultState,
  steps: [inboundLeadStep, submitQuoteIntakeStep, approveQuoteStep],
};

export const paymentScenario: ScenarioDefinition<ScenarioSimulationState> = {
  name: "payment",
  initialState: defaultState,
  steps: [
    inboundLeadStep,
    submitQuoteIntakeStep,
    approveQuoteStep,
    confirmPaymentStep,
  ],
};

export const documentScenario: ScenarioDefinition<ScenarioSimulationState> = {
  name: "document",
  initialState: defaultState,
  steps: [
    inboundLeadStep,
    createSubmitQuoteIntakeStep({
      paymentTerms: "prepaid",
      requestedDocumentType: "tax_invoice",
      billingEntityType: "company",
      billingName: "Scenario Tax Customer Co., Ltd.",
      taxId: "0105555999999",
      billingAddress: "Scenario tax billing address",
    }),
    approveQuoteStep,
    confirmPaymentStep,
    createIssueDocumentStep("TAX_INVOICE_RECEIPT"),
  ],
};

export const escalationScenario: ScenarioDefinition<ScenarioSimulationState> = {
  name: "escalation",
  initialState: defaultState,
  steps: [escalationStep],
};

function createPaymentRoutingScenario(
  name: string,
  intakeOptions: ScenarioIntakeOptions,
  expected: PaymentRoutingExpectation
): ScenarioDefinition<ScenarioSimulationState> {
  return {
    name,
    initialState: defaultState,
    steps: [inboundLeadStep, createSubmitQuoteIntakeStep(intakeOptions, expected)],
  };
}

function createFullLifecycleScenario(
  options: FullLifecycleScenarioOptions
): ScenarioDefinition<ScenarioSimulationState> {
  const {
    name,
    sourceProfile,
    reason,
    expectedDocumentType,
    ...intakeOptions
  } = options;

  return {
    name,
    initialState: defaultState,
    steps: [
      inboundLeadStep,
      createSubmitQuoteIntakeStep(intakeOptions, { sourceProfile, reason }),
      approveQuoteStep,
      confirmPaymentStep,
      createIssueDocumentStep(expectedDocumentType),
      generateFakeAiPreviewStep,
      sendDesignPreviewStep,
      approveDesignStep,
      completeProductionStep,
    ],
  };
}

export const routing200SecondaryScenario = createPaymentRoutingScenario(
  "routing-200-secondary",
  {
    total: 200,
    billingEntityType: "person",
    paymentTerms: "prepaid",
    paymentRoutingConfig: createPaymentRoutingConfig(),
  },
  {
    sourceProfile: "secondary",
    reason: "secondary_total_threshold",
  }
);

export const routing10000PrimaryScenario = createPaymentRoutingScenario(
  "routing-10000-primary",
  {
    total: 10000,
    billingEntityType: "person",
    paymentTerms: "prepaid",
    paymentRoutingConfig: createPaymentRoutingConfig(),
  },
  {
    sourceProfile: "primary",
    reason: "default",
  }
);

export const routingCompanySecondaryScenario = createPaymentRoutingScenario(
  "routing-company-secondary",
  {
    total: 10000,
    billingEntityType: "company",
    paymentTerms: "prepaid",
    paymentRoutingConfig: createPaymentRoutingConfig({
      paymentSecondaryCustomerScope: "company",
    }),
  },
  {
    sourceProfile: "secondary",
    reason: "secondary_customer_scope",
  }
);

export const routingTermSecondaryScenario = createPaymentRoutingScenario(
  "routing-term-secondary",
  {
    total: 10000,
    billingEntityType: "person",
    paymentTerms: "deposit",
    paymentRoutingConfig: createPaymentRoutingConfig({
      paymentSecondaryPaymentTermsScope: "deposit",
    }),
  },
  {
    sourceProfile: "secondary",
    reason: "secondary_payment_terms",
  }
);

export const receiptFullLifecycle200Scenario = createFullLifecycleScenario({
  name: "receipt-full-lifecycle-200",
  total: 200,
  paymentTerms: "prepaid",
  requestedDocumentType: "receipt",
  billingEntityType: "person",
  paymentRoutingConfig: createPaymentRoutingConfig(),
  sourceProfile: "secondary",
  reason: "secondary_total_threshold",
  expectedDocumentType: "RECEIPT",
});

export const taxInvoiceFullLifecycle10000Scenario = createFullLifecycleScenario({
  name: "tax-invoice-full-lifecycle-10000",
  total: 10000,
  paymentTerms: "prepaid",
  requestedDocumentType: "tax_invoice",
  billingEntityType: "company",
  billingName: "Scenario Tax Customer Co., Ltd.",
  taxId: "0105555999999",
  billingAddress: "Scenario tax billing address",
  paymentRoutingConfig: createPaymentRoutingConfig(),
  sourceProfile: "primary",
  reason: "default",
  expectedDocumentType: "TAX_INVOICE_RECEIPT",
});

export const paymentRoutingScenarioDefinitions = [
  routing200SecondaryScenario,
  routing10000PrimaryScenario,
  routingCompanySecondaryScenario,
  routingTermSecondaryScenario,
] as const;

export const fullLifecycleScenarioDefinitions = [
  receiptFullLifecycle200Scenario,
  taxInvoiceFullLifecycle10000Scenario,
] as const;

export const coreScenarioDefinitions = [
  newLeadScenario,
  quoteScenario,
  paymentScenario,
  documentScenario,
  escalationScenario,
  ...paymentRoutingScenarioDefinitions,
  ...fullLifecycleScenarioDefinitions,
] as const;

export async function runCoreScenarios() {
  const results = [];
  for (const definition of coreScenarioDefinitions) {
    const result = await runScenario(definition);
    assertSimulationAudit(result);
    results.push(result);
  }
  return results;
}
