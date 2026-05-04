import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin-auth";
import {
  APP_SETTINGS_ID,
  getAppSettings,
  getDefaultAiImageModel,
  getRuntimeAppConfig,
  getWebhookUrlFromBase,
  getLiffEndpointUrlFromBase,
  isAiImageProvider,
} from "@/lib/app-settings";
import { logHumanAction } from "@/lib/action-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProductionSettings,
  normalizeProductionRetentionDays,
} from "@/lib/production-settings";
import {
  DEFAULT_PAYMENT_DISPLAY_MODE,
  isPaymentDisplayMode,
} from "@/lib/payment-display";
import {
  isPaymentRoutingCustomerScope,
  isPaymentRoutingTermScope,
} from "@/lib/payment-routing";

type SettingsPayload = {
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  paymentAccountName?: string;
  paymentBankName?: string;
  paymentAccountNumber?: string;
  paymentPromptPayId?: string;
  paymentQrCodeUrl?: string;
  paymentQrCodeLabel?: string;
  paymentDisplayMode?: string;
  paymentSecondaryAccountName?: string;
  paymentSecondaryBankName?: string;
  paymentSecondaryAccountNumber?: string;
  paymentSecondaryPromptPayId?: string;
  paymentSecondaryQrCodeUrl?: string;
  paymentSecondaryQrCodeLabel?: string;
  paymentSecondaryDisplayMode?: string;
  paymentSecondaryInstructions?: string;
  paymentSecondaryMaxQuoteTotal?: number | null;
  paymentSecondaryCustomerScope?: string;
  paymentSecondaryPaymentTermsScope?: string;
  paymentInstructions?: string;
  businessLogoUrl?: string;
  businessCatalogUrl?: string;
  businessCatalogName?: string;
  customerUploadUrl?: string;
  customerUploadLabel?: string;
  productionUploadEnabled?: boolean;
  productionCustomerAutoSendEnabled?: boolean;
  productionAssetRetentionDays?: number;
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  liffId?: string;
  baseUrl?: string;
  aiImageEnabled?: boolean;
  aiImageProvider?: string;
  aiImageModel?: string;
  aiImageApiKey?: string;
};

const PAYMENT_SETTINGS_SCHEMA_ERROR =
  "Database schema is missing payment settings columns. Run migration 013_payment_instruction_settings.sql before saving payment instructions.";

function normalizeAuditValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value ?? null;
}

function getChangedSettingsFields(
  previousSettings: Record<string, unknown>,
  nextSettings: Record<string, unknown>
) {
  return Object.entries(nextSettings).reduce<string[]>((changedFields, [field, nextValue]) => {
    if (normalizeAuditValue(previousSettings[field]) !== normalizeAuditValue(nextValue)) {
      changedFields.push(field);
    }

    return changedFields;
  }, []);
}

export async function GET() {
  const settings = await getAppSettings();
  const runtimeConfig = await getRuntimeAppConfig();
  const defaultProductionSettings = getDefaultProductionSettings();
  const hasLineChannelAccessToken = Boolean(
    settings?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN
  );
  const hasLineChannelSecret = Boolean(
    settings?.line_channel_secret || process.env.LINE_CHANNEL_SECRET
  );
  const aiImageProvider = runtimeConfig.aiImageProvider;
  const hasAiImageApiKey = Boolean(
    settings?.ai_image_api_key ||
      (aiImageProvider === "google"
        ? process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
        : process.env.OPENAI_API_KEY)
  );

  return NextResponse.json({
    settings: {
      businessName: settings?.business_name || runtimeConfig.businessName || "",
      businessPhone: settings?.business_phone || runtimeConfig.businessPhone || "",
      businessEmail: settings?.business_email || runtimeConfig.businessEmail || "",
      paymentAccountName:
        settings?.payment_account_name || runtimeConfig.paymentAccountName || "",
      paymentBankName: settings?.payment_bank_name || runtimeConfig.paymentBankName || "",
      paymentAccountNumber:
        settings?.payment_account_number || runtimeConfig.paymentAccountNumber || "",
      paymentPromptPayId:
        settings?.payment_promptpay_id || runtimeConfig.paymentPromptPayId || "",
      paymentQrCodeUrl:
        settings?.payment_qr_code_url || runtimeConfig.paymentQrCodeUrl || "",
      paymentQrCodeLabel:
        settings?.payment_qr_code_label || runtimeConfig.paymentQrCodeLabel || "",
      paymentDisplayMode:
        settings?.payment_display_mode || runtimeConfig.paymentDisplayMode || DEFAULT_PAYMENT_DISPLAY_MODE,
      paymentSecondaryAccountName:
        settings?.payment_secondary_account_name || runtimeConfig.paymentSecondaryAccountName || "",
      paymentSecondaryBankName:
        settings?.payment_secondary_bank_name || runtimeConfig.paymentSecondaryBankName || "",
      paymentSecondaryAccountNumber:
        settings?.payment_secondary_account_number || runtimeConfig.paymentSecondaryAccountNumber || "",
      paymentSecondaryPromptPayId:
        settings?.payment_secondary_promptpay_id || runtimeConfig.paymentSecondaryPromptPayId || "",
      paymentSecondaryQrCodeUrl:
        settings?.payment_secondary_qr_code_url || runtimeConfig.paymentSecondaryQrCodeUrl || "",
      paymentSecondaryQrCodeLabel:
        settings?.payment_secondary_qr_code_label || runtimeConfig.paymentSecondaryQrCodeLabel || "",
      paymentSecondaryDisplayMode:
        settings?.payment_secondary_display_mode || runtimeConfig.paymentSecondaryDisplayMode || DEFAULT_PAYMENT_DISPLAY_MODE,
      paymentSecondaryInstructions:
        settings?.payment_secondary_instructions || runtimeConfig.paymentSecondaryInstructions || "",
      paymentSecondaryMaxQuoteTotal:
        settings?.payment_secondary_max_quote_total ?? runtimeConfig.paymentSecondaryMaxQuoteTotal ?? null,
      paymentSecondaryCustomerScope:
        settings?.payment_secondary_customer_scope || runtimeConfig.paymentSecondaryCustomerScope || "none",
      paymentSecondaryPaymentTermsScope:
        settings?.payment_secondary_payment_terms_scope || runtimeConfig.paymentSecondaryPaymentTermsScope || "none",
      paymentInstructions:
        settings?.payment_instructions || runtimeConfig.paymentInstructions || "",
      businessLogoUrl: settings?.business_logo_url || runtimeConfig.businessLogoUrl || "",
      businessCatalogUrl: settings?.business_catalog_url || runtimeConfig.businessCatalogUrl || "",
      businessCatalogName: settings?.business_catalog_name || runtimeConfig.businessCatalogName || "",
      customerUploadUrl: settings?.customer_upload_url || runtimeConfig.customerUploadUrl || "",
      customerUploadLabel: settings?.customer_upload_label || runtimeConfig.customerUploadLabel || "",
      productionUploadEnabled:
        settings?.production_upload_enabled ??
        runtimeConfig.productionUploadEnabled ??
        defaultProductionSettings.productionUploadEnabled,
      productionCustomerAutoSendEnabled:
        settings?.production_customer_auto_send_enabled ??
        runtimeConfig.productionCustomerAutoSendEnabled ??
        defaultProductionSettings.productionCustomerAutoSendEnabled,
      productionAssetRetentionDays: normalizeProductionRetentionDays(
        settings?.production_asset_retention_days ??
          runtimeConfig.productionAssetRetentionDays ??
          defaultProductionSettings.productionAssetRetentionDays
      ),
      lineChannelAccessToken: "",
      lineChannelSecret: "",
      hasLineChannelAccessToken,
      hasLineChannelSecret,
      liffId: settings?.liff_id || runtimeConfig.liffId || "",
      baseUrl: settings?.base_url || runtimeConfig.baseUrl || "",
      webhookUrl: getWebhookUrlFromBase(runtimeConfig.baseUrl),
      liffEndpointUrl: getLiffEndpointUrlFromBase(runtimeConfig.baseUrl),
      aiImageEnabled: settings?.ai_image_enabled ?? runtimeConfig.aiImageEnabled,
      aiImageProvider,
      aiImageModel: settings?.ai_image_model || runtimeConfig.aiImageModel,
      hasAiImageApiKey,
      updatedAt: settings?.updated_at || null,
    },
  });
}

export async function POST(request: NextRequest) {
  let body: SettingsPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const baseUrl = (body.baseUrl || "").trim().replace(/\/$/, "");
  const businessLogoUrl = (body.businessLogoUrl || "").trim();
  const businessCatalogUrl = (body.businessCatalogUrl || "").trim();
  const businessCatalogName = (body.businessCatalogName || "").trim();
  const paymentAccountName = (body.paymentAccountName || "").trim();
  const paymentBankName = (body.paymentBankName || "").trim();
  const paymentAccountNumber = (body.paymentAccountNumber || "").trim();
  const paymentPromptPayId = (body.paymentPromptPayId || "").trim();
  const paymentQrCodeUrl = (body.paymentQrCodeUrl || "").trim();
  const paymentQrCodeLabel = (body.paymentQrCodeLabel || "").trim();
  const paymentDisplayMode = (body.paymentDisplayMode || DEFAULT_PAYMENT_DISPLAY_MODE).trim();
  const paymentSecondaryAccountName = (body.paymentSecondaryAccountName || "").trim();
  const paymentSecondaryBankName = (body.paymentSecondaryBankName || "").trim();
  const paymentSecondaryAccountNumber = (body.paymentSecondaryAccountNumber || "").trim();
  const paymentSecondaryPromptPayId = (body.paymentSecondaryPromptPayId || "").trim();
  const paymentSecondaryQrCodeUrl = (body.paymentSecondaryQrCodeUrl || "").trim();
  const paymentSecondaryQrCodeLabel = (body.paymentSecondaryQrCodeLabel || "").trim();
  const paymentSecondaryDisplayMode = (body.paymentSecondaryDisplayMode || DEFAULT_PAYMENT_DISPLAY_MODE).trim();
  const paymentSecondaryInstructions = (body.paymentSecondaryInstructions || "").trim();
  const paymentSecondaryMaxQuoteTotal =
    typeof body.paymentSecondaryMaxQuoteTotal === "number" &&
    Number.isFinite(body.paymentSecondaryMaxQuoteTotal)
      ? body.paymentSecondaryMaxQuoteTotal
      : null;
  const paymentSecondaryCustomerScope =
    (body.paymentSecondaryCustomerScope || "none").trim();
  const paymentSecondaryPaymentTermsScope =
    (body.paymentSecondaryPaymentTermsScope || "none").trim();
  const paymentInstructions = (body.paymentInstructions || "").trim();
  const wantsToSavePaymentSettings = Boolean(
    paymentAccountName ||
      paymentBankName ||
      paymentAccountNumber ||
      paymentPromptPayId ||
      paymentQrCodeUrl ||
      paymentQrCodeLabel ||
        paymentSecondaryAccountName ||
        paymentSecondaryBankName ||
        paymentSecondaryAccountNumber ||
        paymentSecondaryPromptPayId ||
        paymentSecondaryQrCodeUrl ||
        paymentSecondaryQrCodeLabel ||
        paymentSecondaryInstructions ||
        paymentSecondaryMaxQuoteTotal !== null ||
        paymentSecondaryCustomerScope !== "none" ||
          paymentSecondaryPaymentTermsScope !== "none" ||
      paymentInstructions
  );
  const customerUploadUrl = (body.customerUploadUrl || "").trim();
  const customerUploadLabel = (body.customerUploadLabel || "").trim();
  const productionAssetRetentionDays = normalizeProductionRetentionDays(
    body.productionAssetRetentionDays
  );
  const lineChannelAccessToken = (body.lineChannelAccessToken || "").trim();
  const lineChannelSecret = (body.lineChannelSecret || "").trim();
  const aiImageProviderCandidate = (body.aiImageProvider || "openai").trim().toLowerCase();
  const aiImageApiKey = (body.aiImageApiKey || "").trim();

  if (!isAiImageProvider(aiImageProviderCandidate)) {
    return NextResponse.json({ error: "Unsupported AI image provider" }, { status: 400 });
  }

  const aiImageProvider = aiImageProviderCandidate;
  const aiImageModel =
    (body.aiImageModel || getDefaultAiImageModel(aiImageProvider)).trim() ||
    getDefaultAiImageModel(aiImageProvider);

  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json(
      { error: "Base URL must start with http:// or https://" },
      { status: 400 }
    );
  }

  for (const assetUrl of [
    businessLogoUrl,
    businessCatalogUrl,
    paymentQrCodeUrl,
    paymentSecondaryQrCodeUrl,
  ]) {
    if (assetUrl && !/^https?:\/\//i.test(assetUrl)) {
      return NextResponse.json(
        { error: "Asset URL must start with http:// or https://" },
        { status: 400 }
      );
    }
  }

  if (customerUploadUrl && !/^https?:\/\//i.test(customerUploadUrl)) {
    return NextResponse.json(
      { error: "Customer upload URL must start with http:// or https://" },
      { status: 400 }
    );
  }

  if (!isPaymentDisplayMode(paymentDisplayMode)) {
    return NextResponse.json({ error: "Unsupported payment display mode" }, { status: 400 });
  }

  if (!isPaymentDisplayMode(paymentSecondaryDisplayMode)) {
    return NextResponse.json(
      { error: "Unsupported secondary payment display mode" },
      { status: 400 }
    );
  }

  if (!isPaymentRoutingCustomerScope(paymentSecondaryCustomerScope)) {
    return NextResponse.json(
      { error: "Unsupported secondary payment customer scope" },
      { status: 400 }
    );
  }

  if (!isPaymentRoutingTermScope(paymentSecondaryPaymentTermsScope)) {
    return NextResponse.json(
      { error: "Unsupported secondary payment terms scope" },
      { status: 400 }
    );
  }

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);

  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClaims = authData?.claims;
  const adminEmail = access.email;
  const adminActorId =
    adminEmail || (typeof adminClaims?.sub === "string" ? adminClaims.sub : undefined);

  const supabase = createAdminClient();
  const currentSettings = await getAppSettings();
  const currentSettingsRecord = (currentSettings ?? {}) as Record<string, unknown>;
  const defaultSettings = getDefaultProductionSettings();
  const currentAiImageProviderRaw = (currentSettings?.ai_image_provider || "").trim();
  const currentAiImageProvider = isAiImageProvider(currentAiImageProviderRaw)
    ? currentAiImageProviderRaw
    : "openai";
  const preservedAiImageApiKey =
    aiImageProvider === currentAiImageProvider ? currentSettings?.ai_image_api_key : null;
  const basePayload = {
    id: APP_SETTINGS_ID,
    business_name: (body.businessName || "").trim() || null,
    business_phone: (body.businessPhone || "").trim() || null,
    business_email: (body.businessEmail || "").trim() || null,
    business_logo_url: businessLogoUrl || null,
    business_catalog_url: businessCatalogUrl || null,
    business_catalog_name: businessCatalogName || null,
    line_channel_access_token:
      lineChannelAccessToken || currentSettings?.line_channel_access_token || null,
    line_channel_secret:
      lineChannelSecret || currentSettings?.line_channel_secret || null,
    liff_id: (body.liffId || "").trim() || null,
    base_url: baseUrl || null,
    ai_image_enabled: Boolean(body.aiImageEnabled),
    ai_image_provider: aiImageProvider,
    ai_image_model: aiImageModel,
    ai_image_api_key: aiImageApiKey || preservedAiImageApiKey || null,
  };
  const fullPayload = {
    ...basePayload,
    payment_account_name: paymentAccountName || null,
    payment_bank_name: paymentBankName || null,
    payment_account_number: paymentAccountNumber || null,
    payment_promptpay_id: paymentPromptPayId || null,
    payment_qr_code_url: paymentQrCodeUrl || null,
    payment_qr_code_label: paymentQrCodeLabel || null,
    payment_display_mode: paymentDisplayMode,
    payment_secondary_account_name: paymentSecondaryAccountName || null,
    payment_secondary_bank_name: paymentSecondaryBankName || null,
    payment_secondary_account_number: paymentSecondaryAccountNumber || null,
    payment_secondary_promptpay_id: paymentSecondaryPromptPayId || null,
    payment_secondary_qr_code_url: paymentSecondaryQrCodeUrl || null,
    payment_secondary_qr_code_label: paymentSecondaryQrCodeLabel || null,
    payment_secondary_display_mode: paymentSecondaryDisplayMode,
    payment_secondary_instructions: paymentSecondaryInstructions || null,
    payment_secondary_max_quote_total: paymentSecondaryMaxQuoteTotal,
    payment_secondary_customer_scope: paymentSecondaryCustomerScope,
    payment_secondary_payment_terms_scope: paymentSecondaryPaymentTermsScope,
    payment_instructions: paymentInstructions || null,
    customer_upload_url: customerUploadUrl || null,
    customer_upload_label: customerUploadLabel || null,
    production_upload_enabled:
      body.productionUploadEnabled ?? defaultSettings.productionUploadEnabled,
    production_customer_auto_send_enabled:
      body.productionCustomerAutoSendEnabled ??
      defaultSettings.productionCustomerAutoSendEnabled,
    production_asset_retention_days: productionAssetRetentionDays,
  };

  let error: { message: string } | null = null;
  let persistedPayload: Record<string, unknown> = fullPayload;

  const primaryResult = await supabase.from("app_settings").upsert(fullPayload, {
    onConflict: "id",
  });

  error = primaryResult.error;

  if (
    error &&
    /(payment_(account_name|bank_name|account_number|promptpay_id|qr_code_url|qr_code_label|display_mode|secondary_account_name|secondary_bank_name|secondary_account_number|secondary_promptpay_id|secondary_qr_code_url|secondary_qr_code_label|secondary_display_mode|secondary_instructions|secondary_max_quote_total|secondary_customer_scope|secondary_payment_terms_scope|instructions)|customer_upload_(url|label)|production_(upload_enabled|customer_auto_send_enabled|asset_retention_days))/i.test(
      error.message
    )
  ) {
    if (
      wantsToSavePaymentSettings &&
      /payment_(account_name|bank_name|account_number|promptpay_id|qr_code_url|qr_code_label|display_mode|secondary_account_name|secondary_bank_name|secondary_account_number|secondary_promptpay_id|secondary_qr_code_url|secondary_qr_code_label|secondary_display_mode|secondary_instructions|secondary_max_quote_total|secondary_customer_scope|secondary_payment_terms_scope|instructions)/i.test(
        error.message
      )
    ) {
      return NextResponse.json(
        { error: PAYMENT_SETTINGS_SCHEMA_ERROR },
        { status: 409 }
      );
    }

    const fallbackResult = await supabase.from("app_settings").upsert(basePayload, {
      onConflict: "id",
    });
    error = fallbackResult.error;
    persistedPayload = basePayload;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const changedFields = getChangedSettingsFields(currentSettingsRecord, persistedPayload);

  if (changedFields.length > 0) {
    await logHumanAction(supabase, {
      entityType: "system",
      actionType: "settings.updated",
      actorId: adminActorId,
      actorLabel: adminEmail ?? "Admin",
      payload: {
        app_settings_id: APP_SETTINGS_ID,
        changed_fields: changedFields,
        used_schema_fallback: persistedPayload === basePayload,
      },
    });
  }

  return NextResponse.json({ success: true });
}
