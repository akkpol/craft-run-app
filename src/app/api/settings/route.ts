import { NextRequest, NextResponse } from "next/server";
import {
  APP_SETTINGS_ID,
  getAppSettings,
  getRuntimeAppConfig,
  getWebhookUrlFromBase,
  getLiffEndpointUrlFromBase,
} from "@/lib/app-settings";
import { logHumanAction } from "@/lib/action-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProductionSettings,
  normalizeProductionRetentionDays,
} from "@/lib/production-settings";

type SettingsPayload = {
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  paymentAccountName?: string;
  paymentBankName?: string;
  paymentAccountNumber?: string;
  paymentPromptPayId?: string;
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
      lineChannelAccessToken:
        settings?.line_channel_access_token || runtimeConfig.lineChannelAccessToken || "",
      lineChannelSecret:
        settings?.line_channel_secret || runtimeConfig.lineChannelSecret || "",
      liffId: settings?.liff_id || runtimeConfig.liffId || "",
      baseUrl: settings?.base_url || runtimeConfig.baseUrl || "",
      webhookUrl: getWebhookUrlFromBase(runtimeConfig.baseUrl),
      liffEndpointUrl: getLiffEndpointUrlFromBase(runtimeConfig.baseUrl),
      aiImageEnabled: settings?.ai_image_enabled ?? runtimeConfig.aiImageEnabled,
      aiImageProvider: settings?.ai_image_provider || runtimeConfig.aiImageProvider || "openai",
      aiImageModel: settings?.ai_image_model || runtimeConfig.aiImageModel || "gpt-image-1",
      hasAiImageApiKey: Boolean(settings?.ai_image_api_key || process.env.OPENAI_API_KEY),
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
  const paymentInstructions = (body.paymentInstructions || "").trim();
  const wantsToSavePaymentSettings = Boolean(
    paymentAccountName ||
      paymentBankName ||
      paymentAccountNumber ||
      paymentPromptPayId ||
      paymentInstructions
  );
  const customerUploadUrl = (body.customerUploadUrl || "").trim();
  const customerUploadLabel = (body.customerUploadLabel || "").trim();
  const productionAssetRetentionDays = normalizeProductionRetentionDays(
    body.productionAssetRetentionDays
  );
  const aiImageProvider = (body.aiImageProvider || "openai").trim() || "openai";
  const aiImageModel = (body.aiImageModel || "gpt-image-1").trim() || "gpt-image-1";
  const aiImageApiKey = (body.aiImageApiKey || "").trim();

  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json(
      { error: "Base URL must start with http:// or https://" },
      { status: 400 }
    );
  }

  for (const assetUrl of [businessLogoUrl, businessCatalogUrl]) {
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

  if (aiImageProvider !== "openai") {
    return NextResponse.json({ error: "Unsupported AI image provider" }, { status: 400 });
  }

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const adminClaims = authData?.claims;
  const adminEmail = typeof adminClaims?.email === "string" ? adminClaims.email : null;
  const adminActorId =
    adminEmail || (typeof adminClaims?.sub === "string" ? adminClaims.sub : undefined);

  const supabase = createAdminClient();
  const currentSettings = await getAppSettings();
  const currentSettingsRecord = (currentSettings ?? {}) as Record<string, unknown>;
  const defaultSettings = getDefaultProductionSettings();
  const basePayload = {
    id: APP_SETTINGS_ID,
    business_name: (body.businessName || "").trim() || null,
    business_phone: (body.businessPhone || "").trim() || null,
    business_email: (body.businessEmail || "").trim() || null,
    business_logo_url: businessLogoUrl || null,
    business_catalog_url: businessCatalogUrl || null,
    business_catalog_name: businessCatalogName || null,
    line_channel_access_token: (body.lineChannelAccessToken || "").trim() || null,
    line_channel_secret: (body.lineChannelSecret || "").trim() || null,
    liff_id: (body.liffId || "").trim() || null,
    base_url: baseUrl || null,
    ai_image_enabled: Boolean(body.aiImageEnabled),
    ai_image_provider: aiImageProvider,
    ai_image_model: aiImageModel,
    ai_image_api_key: aiImageApiKey || currentSettings?.ai_image_api_key || null,
  };
  const fullPayload = {
    ...basePayload,
    payment_account_name: paymentAccountName || null,
    payment_bank_name: paymentBankName || null,
    payment_account_number: paymentAccountNumber || null,
    payment_promptpay_id: paymentPromptPayId || null,
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
    /(payment_(account_name|bank_name|account_number|promptpay_id|instructions)|customer_upload_(url|label)|production_(upload_enabled|customer_auto_send_enabled|asset_retention_days))/i.test(
      error.message
    )
  ) {
    if (
      wantsToSavePaymentSettings &&
      /payment_(account_name|bank_name|account_number|promptpay_id|instructions)/i.test(
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
      entityId: APP_SETTINGS_ID,
      actionType: "settings.updated",
      actorId: adminActorId,
      actorLabel: adminEmail ?? "Admin",
      payload: {
        changed_fields: changedFields,
        used_schema_fallback: persistedPayload === basePayload,
      },
    });
  }

  return NextResponse.json({ success: true });
}
