import {
  DEFAULT_PAYMENT_DISPLAY_MODE,
  type PaymentDisplayMode,
} from "./payment-display.ts";

export const PAYMENT_ROUTING_CUSTOMER_SCOPES = [
  "none",
  "person",
  "company",
  "all",
] as const;

export const PAYMENT_ROUTING_TERM_SCOPES = [
  "none",
  "prepaid",
  "deposit",
  "credit",
  "non_credit",
  "all",
] as const;

export type PaymentRoutingCustomerScope =
  (typeof PAYMENT_ROUTING_CUSTOMER_SCOPES)[number];

export type PaymentRoutingTermScope =
  (typeof PAYMENT_ROUTING_TERM_SCOPES)[number];

export const PAYMENT_ROUTING_CUSTOMER_SCOPE_LABELS: Record<
  PaymentRoutingCustomerScope,
  string
> = {
  none: "ไม่ใช้เงื่อนไขประเภทลูกค้า",
  person: "ใช้บัญชีรองเมื่อเป็นบุคคลธรรมดา",
  company: "ใช้บัญชีรองเมื่อเป็นบริษัท / นิติบุคคล",
  all: "ใช้บัญชีรองกับลูกค้าทุกประเภท",
};

export const PAYMENT_ROUTING_TERM_SCOPE_LABELS: Record<
  PaymentRoutingTermScope,
  string
> = {
  none: "ไม่ใช้เงื่อนไขประเภทการจ่าย",
  prepaid: "ใช้บัญชีรองเมื่อเป็น Prepaid",
  deposit: "ใช้บัญชีรองเมื่อเป็น Deposit",
  credit: "ใช้บัญชีรองเมื่อเป็น Credit",
  non_credit: "ใช้บัญชีรองกับ Prepaid และ Deposit",
  all: "ใช้บัญชีรองกับทุก payment term",
};

export type PaymentProfile = {
  accountName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  promptPayId?: string | null;
  qrCodeUrl?: string | null;
  qrCodeLabel?: string | null;
  displayMode?: PaymentDisplayMode | string | null;
  instructions?: string | null;
};

type PaymentRoutingSettings = {
  primaryProfile: PaymentProfile;
  secondaryProfile?: PaymentProfile | null;
  secondaryMaxQuoteTotal?: number | null;
  secondaryCustomerScope?: PaymentRoutingCustomerScope | string | null | undefined;
  secondaryPaymentTermsScope?: PaymentRoutingTermScope | string | null | undefined;
};

type PaymentRoutingConfigInput = {
  paymentAccountName?: string | null;
  paymentBankName?: string | null;
  paymentAccountNumber?: string | null;
  paymentPromptPayId?: string | null;
  paymentQrCodeUrl?: string | null;
  paymentQrCodeLabel?: string | null;
  paymentDisplayMode?: PaymentDisplayMode | string | null;
  paymentInstructions?: string | null;
  paymentSecondaryAccountName?: string | null;
  paymentSecondaryBankName?: string | null;
  paymentSecondaryAccountNumber?: string | null;
  paymentSecondaryPromptPayId?: string | null;
  paymentSecondaryQrCodeUrl?: string | null;
  paymentSecondaryQrCodeLabel?: string | null;
  paymentSecondaryDisplayMode?: PaymentDisplayMode | string | null;
  paymentSecondaryInstructions?: string | null;
  paymentSecondaryMaxQuoteTotal?: number | null;
  paymentSecondaryCustomerScope?: PaymentRoutingCustomerScope | string | null;
  paymentSecondaryPaymentTermsScope?: PaymentRoutingTermScope | string | null;
};

type PaymentRoutingContext = {
  total?: number | null;
  billingEntityType?: string | null;
  paymentTerms?: string | null;
};

export type ResolvedPaymentProfile = {
  sourceProfile: "primary" | "secondary";
  reason:
    | "default"
    | "primary_missing"
    | "secondary_total_threshold"
    | "secondary_customer_scope"
    | "secondary_payment_terms";
  profile: Required<PaymentProfile>;
};

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim();
}

function normalizeProfile(profile?: PaymentProfile | null): Required<PaymentProfile> {
  return {
    accountName: normalizeText(profile?.accountName),
    bankName: normalizeText(profile?.bankName),
    accountNumber: normalizeText(profile?.accountNumber),
    promptPayId: normalizeText(profile?.promptPayId),
    qrCodeUrl: normalizeText(profile?.qrCodeUrl),
    qrCodeLabel: normalizeText(profile?.qrCodeLabel),
    displayMode:
      (normalizeText(profile?.displayMode as string) as PaymentDisplayMode) ||
      DEFAULT_PAYMENT_DISPLAY_MODE,
    instructions: normalizeText(profile?.instructions),
  };
}

export function isPaymentRoutingCustomerScope(
  value: string
): value is PaymentRoutingCustomerScope {
  return PAYMENT_ROUTING_CUSTOMER_SCOPES.includes(
    value as PaymentRoutingCustomerScope
  );
}

export function isPaymentRoutingTermScope(
  value: string
): value is PaymentRoutingTermScope {
  return PAYMENT_ROUTING_TERM_SCOPES.includes(value as PaymentRoutingTermScope);
}

function normalizeCustomerScope(
  value: string | null | undefined
): PaymentRoutingCustomerScope {
  const candidate = value || "";
  return isPaymentRoutingCustomerScope(candidate) ? candidate : "none";
}

function normalizeTermScope(
  value: string | null | undefined
): PaymentRoutingTermScope {
  const candidate = value || "";
  return isPaymentRoutingTermScope(candidate) ? candidate : "none";
}

function profileHasAnyChannel(profile: Required<PaymentProfile>) {
  return Boolean(
    profile.bankName ||
      profile.accountName ||
      profile.accountNumber ||
      profile.promptPayId ||
      profile.qrCodeUrl ||
      profile.instructions
  );
}

export function resolvePaymentProfile(
  settings: PaymentRoutingSettings,
  context: PaymentRoutingContext
): ResolvedPaymentProfile {
  const primaryProfile = normalizeProfile(settings.primaryProfile);
  const secondaryProfile = normalizeProfile(settings.secondaryProfile);
  const primaryReady = profileHasAnyChannel(primaryProfile);
  const secondaryReady = profileHasAnyChannel(secondaryProfile);

  const total = Number(context.total || 0);
  const threshold =
    typeof settings.secondaryMaxQuoteTotal === "number" &&
    Number.isFinite(settings.secondaryMaxQuoteTotal)
      ? settings.secondaryMaxQuoteTotal
      : null;
  const customerScope = normalizeCustomerScope(settings.secondaryCustomerScope);
  const paymentTermsScope = normalizeTermScope(
    settings.secondaryPaymentTermsScope
  );
  const billingEntityType = normalizeText(context.billingEntityType);
  const paymentTerms = normalizeText(context.paymentTerms);

  const matchesThreshold = threshold !== null && total <= threshold;
  const matchesCustomerScope =
    customerScope === "all"
      ? true
      : customerScope === "none"
        ? false
        : billingEntityType === customerScope;
  const matchesPaymentTerms =
    paymentTermsScope === "all"
      ? true
      : paymentTermsScope === "none"
        ? false
        : paymentTermsScope === "non_credit"
          ? paymentTerms === "prepaid" || paymentTerms === "deposit"
          : paymentTerms === paymentTermsScope;

  if (secondaryReady && matchesThreshold) {
    return {
      sourceProfile: "secondary",
      reason: "secondary_total_threshold",
      profile: secondaryProfile,
    };
  }

  if (secondaryReady && matchesCustomerScope) {
    return {
      sourceProfile: "secondary",
      reason: "secondary_customer_scope",
      profile: secondaryProfile,
    };
  }

  if (secondaryReady && matchesPaymentTerms) {
    return {
      sourceProfile: "secondary",
      reason: "secondary_payment_terms",
      profile: secondaryProfile,
    };
  }

  if (!primaryReady && secondaryReady) {
    return {
      sourceProfile: "secondary",
      reason: "primary_missing",
      profile: secondaryProfile,
    };
  }

  return {
    sourceProfile: "primary",
    reason: "default",
    profile: primaryProfile,
  };
}

export function resolvePaymentProfileFromConfig(
  config: PaymentRoutingConfigInput,
  context: PaymentRoutingContext
): ResolvedPaymentProfile {
  return resolvePaymentProfile(
    {
      primaryProfile: {
        accountName: config.paymentAccountName,
        bankName: config.paymentBankName,
        accountNumber: config.paymentAccountNumber,
        promptPayId: config.paymentPromptPayId,
        qrCodeUrl: config.paymentQrCodeUrl,
        qrCodeLabel: config.paymentQrCodeLabel,
        displayMode: config.paymentDisplayMode,
        instructions: config.paymentInstructions,
      },
      secondaryProfile: {
        accountName: config.paymentSecondaryAccountName,
        bankName: config.paymentSecondaryBankName,
        accountNumber: config.paymentSecondaryAccountNumber,
        promptPayId: config.paymentSecondaryPromptPayId,
        qrCodeUrl: config.paymentSecondaryQrCodeUrl,
        qrCodeLabel: config.paymentSecondaryQrCodeLabel,
        displayMode: config.paymentSecondaryDisplayMode,
        instructions: config.paymentSecondaryInstructions,
      },
      secondaryMaxQuoteTotal: config.paymentSecondaryMaxQuoteTotal,
      secondaryCustomerScope: config.paymentSecondaryCustomerScope,
      secondaryPaymentTermsScope: config.paymentSecondaryPaymentTermsScope,
    },
    context
  );
}