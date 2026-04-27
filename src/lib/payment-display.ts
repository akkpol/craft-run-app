export const PAYMENT_DISPLAY_MODES = [
  "all",
  "account_only",
  "qr_only",
  "account_and_qr",
] as const;

export type PaymentDisplayMode = (typeof PAYMENT_DISPLAY_MODES)[number];

export const DEFAULT_PAYMENT_DISPLAY_MODE: PaymentDisplayMode = "all";

export const PAYMENT_DISPLAY_MODE_LABELS: Record<PaymentDisplayMode, string> = {
  all: "แสดงทุกช่องทางที่ตั้งไว้",
  account_only: "แสดงเฉพาะเลขบัญชี / PromptPay",
  qr_only: "แสดงเฉพาะ QR Code",
  account_and_qr: "แสดงเลขบัญชีและ QR Code",
};

type PaymentDetail = {
  label: string;
  value: string;
};

type PaymentDisplayInput = {
  paymentDisplayMode?: string | null;
  paymentBankName?: string | null;
  paymentAccountName?: string | null;
  paymentAccountNumber?: string | null;
  paymentPromptPayId?: string | null;
  paymentQrCodeUrl?: string | null;
  paymentQrCodeLabel?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim();
}

export function isPaymentDisplayMode(value: string): value is PaymentDisplayMode {
  return PAYMENT_DISPLAY_MODES.includes(value as PaymentDisplayMode);
}

export function getPaymentDisplayState(config: PaymentDisplayInput) {
  const paymentDetails = [
    { label: "ธนาคาร", value: normalizeText(config.paymentBankName) },
    { label: "ชื่อบัญชี", value: normalizeText(config.paymentAccountName) },
    { label: "เลขบัญชี", value: normalizeText(config.paymentAccountNumber) },
    { label: "พร้อมเพย์ / PromptPay", value: normalizeText(config.paymentPromptPayId) },
  ].filter((detail): detail is PaymentDetail => Boolean(detail.value));

  const qrCodeUrl = normalizeText(config.paymentQrCodeUrl);
  const qrCodeLabel = normalizeText(config.paymentQrCodeLabel) || "สแกน QR เพื่อชำระเงิน";
  const mode = isPaymentDisplayMode(config.paymentDisplayMode || "")
    ? config.paymentDisplayMode
    : DEFAULT_PAYMENT_DISPLAY_MODE;

  let showDetails = false;
  let showQr = false;

  switch (mode) {
    case "account_only":
      showDetails = paymentDetails.length > 0;
      break;
    case "qr_only":
      showQr = Boolean(qrCodeUrl);
      break;
    case "account_and_qr":
      showDetails = paymentDetails.length > 0;
      showQr = Boolean(qrCodeUrl);
      break;
    case "all":
    default:
      showDetails = paymentDetails.length > 0;
      showQr = Boolean(qrCodeUrl);
      break;
  }

  if (!showDetails && !showQr) {
    showDetails = paymentDetails.length > 0;
    showQr = !showDetails && Boolean(qrCodeUrl);
  }

  return {
    mode,
    paymentDetails,
    showDetails,
    showQr,
    qrCodeUrl,
    qrCodeLabel,
  };
}