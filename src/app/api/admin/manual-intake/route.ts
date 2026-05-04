import { NextRequest, NextResponse } from "next/server";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { logHumanAction } from "@/lib/action-log";
import { buildLeadPromptFields } from "@/lib/intake-payload";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import {
  calculateProductCatalogPrice,
  findProductCatalogItem,
  resolveProductCatalogLabel,
} from "@/lib/product-catalog";
import { getProductCatalog } from "@/lib/product-catalog-store";
import { getLeadOperationalDefaults } from "@/lib/quote-workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  calculatePrice,
  isBillingBranchType,
  isBillingEntityType,
  isDocumentRequestType,
  isFulfillmentMode,
  isPaymentTerm,
  toMM,
  type BillingBranchType,
  type BillingEntityType,
  type DocumentRequestType,
  type FulfillmentMode,
  type PaymentTerm,
  type UnitType,
} from "@/lib/types";
import {
  formatTaxDocumentIntakeErrors,
  validateTaxDocumentIntake,
} from "@/lib/tax-document-intake";

type ManualIntakePayload = {
  customerName?: string;
  phone?: string;
  email?: string;
  source?: string;
  productType?: string;
  width?: number | string;
  height?: number | string;
  unit?: UnitType;
  qty?: number | string;
  dueDate?: string;
  note?: string;
  referenceInfo?: string;
  designBrief?: string;
  aiImagePrompt?: string;
  requestedDocumentType?: DocumentRequestType;
  billingEntityType?: BillingEntityType;
  billingBranchType?: BillingBranchType;
  billingBranchCode?: string;
  billingName?: string;
  taxId?: string;
  billingAddress?: string;
  paymentTerms?: PaymentTerm;
  fulfillmentMode?: FulfillmentMode;
  createQuote?: boolean;
};

const MANUAL_SOURCE_LABELS: Record<string, string> = {
  walk_in: "หน้าร้าน",
  phone: "โทรศัพท์",
  facebook: "Facebook",
  email: "อีเมล",
  other: "อื่น ๆ",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeManualSource(value: unknown) {
  const source = normalizeText(value).toLowerCase();
  return MANUAL_SOURCE_LABELS[source] ? source : "other";
}

function buildManualLineUserId(source: string) {
  return `manual:${source}:${crypto.randomUUID()}`;
}

function getQuoteUrl(baseUrl: string, publicToken: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return normalizedBaseUrl ? `${normalizedBaseUrl}/quote/${publicToken}` : `/quote/${publicToken}`;
}

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);

  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ManualIntakePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerName = normalizeText(body.customerName) || "ลูกค้า manual";
  const phone = normalizeText(body.phone);
  const email = normalizeText(body.email);
  const source = normalizeManualSource(body.source);
  const productType = normalizeText(body.productType);
  const width = parsePositiveNumber(body.width);
  const height = parsePositiveNumber(body.height);
  const unit = body.unit || "cm";
  const qty = Math.max(1, Math.floor(parsePositiveNumber(body.qty) || 1));
  const dueDate = normalizeText(body.dueDate) || null;
  const note = normalizeText(body.note);
  const referenceInfo = normalizeText(body.referenceInfo);
  const designBrief = normalizeText(body.designBrief);
  const aiImagePrompt = normalizeText(body.aiImagePrompt);
  const requestedDocumentType =
    body.requestedDocumentType && isDocumentRequestType(body.requestedDocumentType)
      ? body.requestedDocumentType
      : "quote";
  const billingEntityType =
    body.billingEntityType && isBillingEntityType(body.billingEntityType)
      ? body.billingEntityType
      : "person";
  const normalizedBillingBranchType =
    body.billingBranchType && isBillingBranchType(body.billingBranchType)
      ? body.billingBranchType
      : "head_office";
  const billingBranchType = billingEntityType === "company" ? normalizedBillingBranchType : null;
  const billingBranchCode =
    billingEntityType === "company" && normalizedBillingBranchType === "branch"
      ? normalizeText(body.billingBranchCode) || null
      : null;
  const billingName = normalizeText(body.billingName) || customerName;
  const taxId = normalizeText(body.taxId) || null;
  const billingAddress = normalizeText(body.billingAddress) || null;
  const paymentTerms = body.paymentTerms && isPaymentTerm(body.paymentTerms) ? body.paymentTerms : "prepaid";
  const fulfillmentMode =
    body.fulfillmentMode && isFulfillmentMode(body.fulfillmentMode)
      ? body.fulfillmentMode
      : "delivery";
  const createQuote = body.createQuote !== false;

  const errors: string[] = [];
  if (!phone && !email) errors.push("ต้องมีเบอร์โทรหรืออีเมลอย่างน้อยหนึ่งช่องทาง");
  if (!productType) errors.push("กรุณาเลือกประเภทงาน");
  if (!width) errors.push("กรุณาระบุความกว้าง");
  if (!height) errors.push("กรุณาระบุความสูง");
  if (!qty) errors.push("กรุณาระบุจำนวน");

  const taxDocumentValidation = validateTaxDocumentIntake({
    requestedDocumentType,
    billingEntityType,
    billingBranchType,
    billingBranchCode,
    billingName,
    taxId,
    billingAddress,
  });

  if (taxDocumentValidation.errors.length > 0) {
    errors.push(formatTaxDocumentIntakeErrors(taxDocumentValidation.errors));
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("\n") }, { status: 400 });
  }

  const supabase = createAdminClient();
  const manualSnapshot = {
    collectedAt: new Date().toISOString(),
    source: "admin-manual-intake",
    channel: source,
    channelLabel: MANUAL_SOURCE_LABELS[source],
    createdBy: access.email,
  };

  let customer: { id: string; line_user_id: string } | null = null;

  if (phone) {
    const { data } = await supabase
      .from("customers")
      .select("id, line_user_id")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    customer = data;
  }

  if (!customer && email) {
    const { data } = await supabase
      .from("customers")
      .select("id, line_user_id")
      .eq("line_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    customer = data;
  }

  if (customer) {
    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update({
        display_name: customerName,
        phone: phone || null,
        line_email: email || null,
        last_liff_context: manualSnapshot,
      })
      .eq("id", customer.id);

    if (updateCustomerError) {
      return NextResponse.json({ error: updateCustomerError.message }, { status: 500 });
    }
  } else {
    const { data: insertedCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        line_user_id: buildManualLineUserId(source),
        display_name: customerName,
        phone: phone || null,
        line_email: email || null,
        last_liff_context: manualSnapshot,
      })
      .select("id, line_user_id")
      .single();

    if (!insertedCustomer || customerError) {
      return NextResponse.json(
        { error: customerError?.message || "Failed to create customer" },
        { status: 500 }
      );
    }

    customer = insertedCustomer;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ line_user_id: customer.line_user_id, state: "REQUIREMENTS_REVIEW" })
    .select("id")
    .single();

  if (!conversation || conversationError) {
    return NextResponse.json(
      { error: conversationError?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }

  const widthMm = toMM(width || 0, unit);
  const heightMm = toMM(height || 0, unit);
  const { items: runtimeProductCatalog } = await getProductCatalog({ activeOnly: false });
  const selectedProduct = findProductCatalogItem(runtimeProductCatalog, productType);
  const productLabel = resolveProductCatalogLabel({
    productType,
    productLabelSnapshot: selectedProduct?.label || null,
  });
  const leadDefaults = getLeadOperationalDefaults(fulfillmentMode);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      conversation_id: conversation.id,
      customer_id: customer.id,
      product_type: productType,
      product_label_snapshot: productLabel,
      product_category_snapshot: selectedProduct?.category || null,
      product_category_label_snapshot: selectedProduct?.categoryLabel || null,
      width_mm: widthMm,
      height_mm: heightMm,
      qty,
      due_date: dueDate,
      ...buildLeadPromptFields({ designBrief, note, referenceInfo, aiImagePrompt }),
      note_from_chat: `Manual intake: ${MANUAL_SOURCE_LABELS[source]}`,
      requested_document_type: requestedDocumentType,
      billing_entity_type: billingEntityType,
      billing_branch_type: billingBranchType,
      billing_branch_code: billingBranchCode,
      billing_name: billingName || null,
      tax_id: taxId,
      billing_address: billingAddress,
      liff_profile_snapshot: null,
      liff_context_snapshot: manualSnapshot,
      fulfillment_mode: leadDefaults.fulfillment_mode,
      design_assignment_mode: leadDefaults.design_assignment_mode,
      design_executor: leadDefaults.design_executor,
      design_status: leadDefaults.design_status,
      hold_reason: createQuote ? null : "รับงานแบบ manual แล้ว รอทีมตรวจ requirement และออก quote",
      status: createQuote ? "quoted" : "new",
    })
    .select("id")
    .single();

  if (!lead || leadError) {
    return NextResponse.json(
      { error: leadError?.message || "Failed to create lead" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "lead",
    entityId: lead.id,
    actionType: "lead.created",
    actorId: access.email || undefined,
    actorLabel: access.email || "Admin",
    note: "Manual intake lead created by staff",
    payload: {
      conversation_id: conversation.id,
      source,
      create_quote: createQuote,
    },
  });

  if (!createQuote) {
    return NextResponse.json({
      success: true,
      customerId: customer.id,
      conversationId: conversation.id,
      leadId: lead.id,
      quoteId: null,
      quoteUrl: null,
      nextState: "REQUIREMENTS_REVIEW",
    });
  }

  const subtotal = selectedProduct
    ? calculateProductCatalogPrice(selectedProduct, widthMm, heightMm, qty)
    : calculatePrice(productType, widthMm, heightMm, qty);
  const vat = Math.round(subtotal * 0.07 * 100) / 100;
  const total = subtotal + vat;
  const appConfig = await getRuntimeAppConfig();
  const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
    total,
    billingEntityType,
    paymentTerms,
  });

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: lead.id,
      subtotal,
      discount: 0,
      vat,
      total,
      status: "sent",
      payment_terms: paymentTerms,
      payment_status: paymentTerms === "credit" ? "not_required" : "unpaid",
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .select("id, public_token")
    .single();

  if (!quote || quoteError) {
    return NextResponse.json(
      { error: quoteError?.message || "Failed to create quote" },
      { status: 500 }
    );
  }

  await supabase.from("quote_items").insert({
    quote_id: quote.id,
    label: `${productLabel} (${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)} ซม.) × ${qty}`,
    qty: 1,
    unit_price: subtotal,
  });

  await supabase
    .from("conversations")
    .update({ state: "WAITING_QUOTE_APPROVAL" })
    .eq("id", conversation.id);

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.created",
    actorId: access.email || undefined,
    actorLabel: access.email || "Admin",
    note: "Manual intake quote created by staff",
    payload: {
      lead_id: lead.id,
      total,
      payment_terms: paymentTerms,
      to_state: "WAITING_QUOTE_APPROVAL",
      source,
    },
  });

  return NextResponse.json({
    success: true,
    customerId: customer.id,
    conversationId: conversation.id,
    leadId: lead.id,
    quoteId: quote.id,
    quoteToken: quote.public_token,
    quoteUrl: getQuoteUrl(appConfig.baseUrl, quote.public_token),
    total,
    nextState: "WAITING_QUOTE_APPROVAL",
  });
}
