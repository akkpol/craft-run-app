import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDefaultProductionSettings,
  normalizeProductionRetentionDays,
} from "@/lib/production-settings";

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
  payment_instructions: string | null;
  business_logo_url: string | null;
  business_catalog_url: string | null;
  business_catalog_name: string | null;
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

export type RuntimeAppConfig = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccountName: string;
  paymentBankName: string;
  paymentAccountNumber: string;
  paymentPromptPayId: string;
  paymentInstructions: string;
  businessLogoUrl: string;
  businessCatalogUrl: string;
  businessCatalogName: string;
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
  aiImageProvider: string;
  aiImageModel: string;
};

export type AiImageRuntimeConfig = {
  enabled: boolean;
  provider: "openai";
  model: string;
  apiKey: string;
};

function normalizeUrl(value: string | null | undefined): string {
  return (value || "").trim().replace(/\/$/, "");
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim();
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
  const aiImageProvider = normalizeText(settings?.ai_image_provider) || "openai";
  const aiImageModel = normalizeText(settings?.ai_image_model) || "gpt-image-1";
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
    paymentInstructions: normalizeText(settings?.payment_instructions),
    businessLogoUrl: normalizeUrl(settings?.business_logo_url),
    businessCatalogUrl: normalizeUrl(settings?.business_catalog_url),
    businessCatalogName: normalizeText(settings?.business_catalog_name),
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
  const provider = (normalizeText(settings?.ai_image_provider) || "openai") as "openai";
  const model = normalizeText(settings?.ai_image_model) || "gpt-image-1";
  const apiKey = normalizeText(settings?.ai_image_api_key) || normalizeText(process.env.OPENAI_API_KEY);

  return {
    enabled: Boolean(settings?.ai_image_enabled && apiKey),
    provider,
    model,
    apiKey,
  };
}
