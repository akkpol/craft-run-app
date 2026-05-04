import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDefaultProductionSettings,
  normalizeProductionRetentionDays,
} from "@/lib/production-settings";
import {
  DEFAULT_PAYMENT_DISPLAY_MODE,
  type PaymentDisplayMode,
} from "@/lib/payment-display";
import {
  type PaymentRoutingTermScope,
  type PaymentRoutingCustomerScope,
} from "@/lib/payment-routing";

export const APP_SETTINGS_ID = "default";

export type AppSettingsRow = {
  id: string;
  business_name: string | null;
  business_phone: string | null;
  business_email: string | null;
  payment_account_name: string | null;
  payment_bank_name: string | null;
  payment_account_number: string | null;
  payment_promptpay_id: string | null;
  payment_qr_code_url: string | null;
  payment_qr_code_label: string | null;
  payment_display_mode: PaymentDisplayMode | null;
  payment_secondary_account_name: string | null;
  payment_secondary_bank_name: string | null;
  payment_secondary_account_number: string | null;
  payment_secondary_promptpay_id: string | null;
  payment_secondary_qr_code_url: string | null;
  payment_secondary_qr_code_label: string | null;
  payment_secondary_display_mode: PaymentDisplayMode | null;
  payment_secondary_instructions: string | null;
  payment_secondary_max_quote_total: number | null;
  payment_secondary_customer_scope: PaymentRoutingCustomerScope | null;
  payment_secondary_payment_terms_scope: PaymentRoutingTermScope | null;
  payment_instructions: string | null;
  business_logo_url: string | null;
  business_catalog_url: string | null;
  business_catalog_name: string | null;
  document_appendix_image_url: string | null;
  document_appendix_image_name: string | null;
  customer_upload_url: string | null;
  customer_upload_label: string | null;
  production_upload_enabled: boolean | null;
  production_customer_auto_send_enabled: boolean | null;
  production_asset_retention_days: number | null;
  line_channel_access_token: string | null;
  line_channel_secret: string | null;
  liff_id: string | null;
  base_url: string | null;
  ai_image_enabled: boolean;
  ai_image_provider: string | null;
  ai_image_model: string | null;
  ai_image_api_key: string | null;
  created_at: string;
  updated_at: string;
};

export type AiImageProvider = "openai" | "google";

export type RuntimeAppConfig = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccountName: string;
  paymentBankName: string;
  paymentAccountNumber: string;
  paymentPromptPayId: string;
  paymentQrCodeUrl: string;
  paymentQrCodeLabel: string;
  paymentDisplayMode: PaymentDisplayMode;
  paymentSecondaryAccountName: string;
  paymentSecondaryBankName: string;
  paymentSecondaryAccountNumber: string;
  paymentSecondaryPromptPayId: string;
  paymentSecondaryQrCodeUrl: string;
  paymentSecondaryQrCodeLabel: string;
  paymentSecondaryDisplayMode: PaymentDisplayMode;
  paymentSecondaryInstructions: string;
  paymentSecondaryMaxQuoteTotal: number | null;
  paymentSecondaryCustomerScope: PaymentRoutingCustomerScope;
  paymentSecondaryPaymentTermsScope: PaymentRoutingTermScope;
  paymentInstructions: string;
  businessLogoUrl: string;
  businessCatalogUrl: string;
  businessCatalogName: string;
  documentAppendixImageUrl: string;
  documentAppendixImageName: string;
  customerUploadUrl: string;
  customerUploadLabel: string;
  productionUploadEnabled: boolean;
  productionCustomerAutoSendEnabled: boolean;
  productionAssetRetentionDays: number;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  liffId: string;
  baseUrl: string;
  webhookUrl: string;
  liffEndpointUrl: string;
  aiImageEnabled: boolean;
  aiImageProvider: AiImageProvider;
  aiImageModel: string;
};

export type AiImageRuntimeConfig = {
  enabled: boolean;
  provider: AiImageProvider;
  model: string;
  apiKey: string;
};

export function isAiImageProvider(value: string): value is AiImageProvider {
  return value === "openai" || value === "google";
}

export function getDefaultAiImageModel(provider: AiImageProvider): string {
  return provider === "google" ? "imagen-3.0-generate-002" : "gpt-image-1";
}

function normalizeUrl(value: string | null | undefined): string {
  return (value || "").trim().replace(/\/$/, "");
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim();
}

function normalizeAiImageProvider(value: string | null | undefined): AiImageProvider {
  const provider = normalizeText(value).toLowerCase();
  return isAiImageProvider(provider) ? provider : "openai";
}

export function getWebhookUrlFromBase(baseUrl: string): string {
  return baseUrl ? `${baseUrl}/api/webhook` : "";
}

export function getLiffEndpointUrlFromBase(baseUrl: string): string {
  return baseUrl ? `${baseUrl}/liff` : "";
}

export async function getAppSettings(): Promise<AppSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", APP_SETTINGS_ID)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AppSettingsRow;
}

export async function getRuntimeAppConfig(): Promise<RuntimeAppConfig> {
  const settings = await getAppSettings();
  const defaultProductionSettings = getDefaultProductionSettings();
  const baseUrl = normalizeUrl(settings?.base_url) || normalizeUrl(process.env.NEXT_PUBLIC_BASE_URL);
  const aiImageProvider = normalizeAiImageProvider(settings?.ai_image_provider);
  const aiImageModel = normalizeText(settings?.ai_image_model) || getDefaultAiImageModel(aiImageProvider);
  const customerUploadUrl =
    normalizeUrl(settings?.customer_upload_url) || normalizeUrl(process.env.NEXT_PUBLIC_CUSTOMER_UPLOAD_URL);

  return {
    businessName: normalizeText(settings?.business_name) || "FOGUS Print & Sign",
    businessPhone: normalizeText(settings?.business_phone),
    businessEmail: normalizeText(settings?.business_email),
    paymentAccountName: normalizeText(settings?.payment_account_name),
    paymentBankName: normalizeText(settings?.payment_bank_name),
    paymentAccountNumber: normalizeText(settings?.payment_account_number),
    paymentPromptPayId: normalizeText(settings?.payment_promptpay_id),
    paymentQrCodeUrl: normalizeUrl(settings?.payment_qr_code_url),
    paymentQrCodeLabel: normalizeText(settings?.payment_qr_code_label),
    paymentDisplayMode: settings?.payment_display_mode || DEFAULT_PAYMENT_DISPLAY_MODE,
    paymentSecondaryAccountName: normalizeText(settings?.payment_secondary_account_name),
    paymentSecondaryBankName: normalizeText(settings?.payment_secondary_bank_name),
    paymentSecondaryAccountNumber: normalizeText(settings?.payment_secondary_account_number),
    paymentSecondaryPromptPayId: normalizeText(settings?.payment_secondary_promptpay_id),
    paymentSecondaryQrCodeUrl: normalizeUrl(settings?.payment_secondary_qr_code_url),
    paymentSecondaryQrCodeLabel: normalizeText(settings?.payment_secondary_qr_code_label),
    paymentSecondaryDisplayMode:
      settings?.payment_secondary_display_mode || DEFAULT_PAYMENT_DISPLAY_MODE,
    paymentSecondaryInstructions: normalizeText(settings?.payment_secondary_instructions),
    paymentSecondaryMaxQuoteTotal:
      typeof settings?.payment_secondary_max_quote_total === "number"
        ? settings.payment_secondary_max_quote_total
        : null,
    paymentSecondaryCustomerScope:
      settings?.payment_secondary_customer_scope || "none",
    paymentSecondaryPaymentTermsScope:
      settings?.payment_secondary_payment_terms_scope || "none",
    paymentInstructions: normalizeText(settings?.payment_instructions),
    businessLogoUrl: normalizeUrl(settings?.business_logo_url),
    businessCatalogUrl: normalizeUrl(settings?.business_catalog_url),
    businessCatalogName: normalizeText(settings?.business_catalog_name),
    documentAppendixImageUrl: normalizeUrl(settings?.document_appendix_image_url),
    documentAppendixImageName: normalizeText(settings?.document_appendix_image_name),
    customerUploadUrl,
    customerUploadLabel: normalizeText(settings?.customer_upload_label) || "ส่งไฟล์งาน / รูปอ้างอิง",
    productionUploadEnabled:
      settings?.production_upload_enabled ??
      defaultProductionSettings.productionUploadEnabled,
    productionCustomerAutoSendEnabled:
      settings?.production_customer_auto_send_enabled ??
      defaultProductionSettings.productionCustomerAutoSendEnabled,
    productionAssetRetentionDays: normalizeProductionRetentionDays(
      settings?.production_asset_retention_days
    ),
    lineChannelAccessToken:
      normalizeText(settings?.line_channel_access_token) ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "",
    lineChannelSecret:
      normalizeText(settings?.line_channel_secret) ||
      process.env.LINE_CHANNEL_SECRET ||
      "",
    liffId: normalizeText(settings?.liff_id) || process.env.NEXT_PUBLIC_LIFF_ID || process.env.LIFF_ID || "",
    baseUrl,
    webhookUrl: getWebhookUrlFromBase(baseUrl),
    liffEndpointUrl: getLiffEndpointUrlFromBase(baseUrl),
    aiImageEnabled: settings?.ai_image_enabled ?? false,
    aiImageProvider,
    aiImageModel,
  };
}

export async function getAiImageRuntimeConfig(): Promise<AiImageRuntimeConfig> {
  const settings = await getAppSettings();
  const provider = normalizeAiImageProvider(settings?.ai_image_provider);
  const model = normalizeText(settings?.ai_image_model) || getDefaultAiImageModel(provider);

  let apiKey = normalizeText(settings?.ai_image_api_key);
  if (!apiKey) {
    if (provider === "google") {
      apiKey = normalizeText(process.env.GOOGLE_API_KEY) || normalizeText(process.env.GEMINI_API_KEY);
    } else {
      apiKey = normalizeText(process.env.OPENAI_API_KEY);
    }
  }

  return {
    enabled: Boolean(settings?.ai_image_enabled && apiKey),
    provider,
    model,
    apiKey,
  };
}
