"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  ImagePlus,
  Package2,
  Paperclip,
  PhoneCall,
  Ruler,
  ScrollText,
  Truck,
  X,
} from "lucide-react";
import {
  BILLING_BRANCH_TYPES,
  BILLING_BRANCH_TYPE_LABELS,
  BILLING_ENTITY_TYPES,
  BILLING_ENTITY_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPES,
  DOCUMENT_REQUEST_TYPE_LABELS,
  FULFILLMENT_MODE_LABELS,
  PRODUCT_TYPES,
  UNITS,
  type BillingBranchType,
  type BillingEntityType,
  type DocumentRequestType,
  type FulfillmentMode,
  type UnitType,
} from "@/lib/types";
import ProductTypePicker from "./product-type-picker";

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getIDToken: () => string | null;
      getAccessToken?: () => string | null;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      getFriendship?: () => Promise<{ friendFlag: boolean }>;
      getContext?: () => {
        type?: string;
        userId?: string | null;
        liffId?: string;
        viewType?: string;
        endpointUrl?: string;
        scope?: string[];
        availability?: Record<string, unknown>;
        miniAppId?: string;
        miniDomainAllowed?: boolean;
        permanentLinkPattern?: string;
      };
      getAppLanguage?: () => string;
      getLanguage?: () => string;
      getVersion?: () => string;
      getLineVersion?: () => string | null;
      getOS?: () => string;
      requestFriendship: () => Promise<{ friendFlag: boolean }>;
      closeWindow: () => void;
      isInClient: () => boolean;
      permission?: {
        getGrantedAll?: () => Promise<string[]>;
      };
    };
  }
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100";

const selectClassName =
  "rounded-xl border border-slate-200 bg-white/92 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100";

const textareaClassName =
  "w-full resize-none rounded-xl border border-slate-200 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100";

const MAX_REFERENCE_FILES = 5;
const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024;
const AUTO_RESIZE_IMAGE_MAX_DIMENSION = 1800;
const AUTO_RESIZE_TARGET_FILE_SIZE = 2 * 1024 * 1024;

type LiffConsoleLevel = "info" | "warn" | "error";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function compactLineUserIdForDebug(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function createLiffDebugFingerprint() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().split("-")[0];
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStatusFromLiffConsoleDetails(details?: Record<string, unknown>) {
  const status = details?.status;
  return typeof status === "number" ? status : null;
}

function resolveLiffConsoleLevel(
  stage: string,
  details?: Record<string, unknown>,
  explicitLevel?: LiffConsoleLevel
): LiffConsoleLevel {
  if (explicitLevel) {
    return explicitLevel;
  }

  switch (stage) {
    case "prefill_http_error":
    case "submit_http_error": {
      const status = getStatusFromLiffConsoleDetails(details);
      return status !== null && status >= 500 ? "error" : "warn";
    }
    case "sdk_load_timeout":
    case "init_failed":
    case "prefill_failed":
    case "submit_network_failed":
      return "error";
    case "submit_missing_identity":
      return "warn";
    default:
      return "info";
  }
}

function shouldLogLiffConsole(level: LiffConsoleLevel) {
  if (typeof window === "undefined") {
    return false;
  }

  if (level === "warn" || level === "error") {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return new URLSearchParams(window.location.search).get("debugLiff") === "1";
}

function logLiffConsole(
  stage: string,
  details?: Record<string, unknown>,
  level?: LiffConsoleLevel
) {
  const resolvedLevel = resolveLiffConsoleLevel(stage, details, level);

  if (!shouldLogLiffConsole(resolvedLevel)) {
    return;
  }

  const prefix = `[LIFF][${resolvedLevel.toUpperCase()}][${stage}]`;
  if (resolvedLevel === "error") {
    console.error(prefix, details || {});
    return;
  }

  if (resolvedLevel === "warn") {
    console.warn(prefix, details || {});
    return;
  }

  console.info(prefix, details || {});
}

function getSearchParamKeys(search: string) {
  try {
    return Array.from(new URLSearchParams(search).keys()).slice(0, 20);
  } catch {
    return [] as string[];
  }
}

function sendLiffIncident(payload: {
  fingerprint: string;
  stage: string;
  message?: string;
  pathname: string;
  searchParamKeys: string[];
  intakeMode: "resume" | "fresh";
  userAgent: string;
  sdkPresent: boolean;
  liffIdConfigured: boolean;
  lineUserId?: string;
  liffContextSnapshot?: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    lineUserId: payload.lineUserId || null,
    liffContextSnapshot: payload.liffContextSnapshot || null,
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/liff/incidents", blob);
    return;
  }

  void fetch("/api/liff/incidents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

type ReferenceFilePreview = {
  id: string;
  file: File;
  previewUrl: string | null;
};

const sectionToneStyles = {
  emerald: {
    badge: "bg-sky-700 text-white shadow-[0_12px_24px_rgba(3,105,161,0.22)]",
    icon: "bg-sky-100 text-sky-700",
    pill: "border-sky-200 bg-sky-50 text-sky-700",
  },
  sky: {
    badge: "bg-slate-700 text-white shadow-[0_12px_24px_rgba(51,65,85,0.2)]",
    icon: "bg-slate-100 text-slate-700",
    pill: "border-slate-200 bg-slate-50 text-slate-700",
  },
  amber: {
    badge: "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]",
    icon: "bg-blue-100 text-blue-700",
    pill: "border-blue-200 bg-blue-50 text-blue-700",
  },
} as const;

const summaryChipToneStyles = {
  slate: "bg-stone-100 text-stone-700",
  emerald: "bg-sky-700 text-white",
  sky: "bg-slate-100 text-slate-700",
  amber: "bg-blue-100 text-blue-800",
} as const;

const summaryBlockToneStyles = {
  slate: "bg-stone-100/85 text-stone-800",
  emerald: "bg-sky-50/92 text-sky-950",
  sky: "bg-slate-50/92 text-slate-900",
  amber: "bg-blue-50/92 text-blue-950",
} as const;

const FULFILLMENT_OPTIONS: Array<{
  value: FulfillmentMode;
  title: string;
  description: string;
}> = [
  {
    value: "pickup",
    title: FULFILLMENT_MODE_LABELS.pickup,
    description: "เหมาะกับงานที่นัดรับเองหน้าร้านหรือโรงงาน",
  },
  {
    value: "delivery",
    title: FULFILLMENT_MODE_LABELS.delivery,
    description: "ทีมจัดคิวส่งตามที่อยู่หน้างาน",
  },
  {
    value: "install",
    title: FULFILLMENT_MODE_LABELS.install,
    description: "ต้องมีทีมเข้าหน้างานเพื่อติดตั้ง",
  },
];

function getBangkokTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatUnitValue(valueMm: number | null | undefined, unit: UnitType = "cm") {
  if (typeof valueMm !== "number" || !Number.isFinite(valueMm) || valueMm <= 0) {
    return "";
  }

  const unitDef = UNITS.find((item) => item.value === unit);
  if (!unitDef) {
    return String(Math.round(valueMm * 100) / 100);
  }

  const converted = valueMm / unitDef.factor;
  const rounded = Math.round(converted * 100) / 100;

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function compactSummaryText(value: string | null | undefined, maxLength = 26) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
}

function formatCoordinateValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(6);
}

function resolveProductTypeLabel(value: string) {
  return PRODUCT_TYPES.find((item) => item.value === value)?.label || value;
}

async function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };

    image.src = objectUrl;
  });
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  return fileName.replace(/\.[^.]+$/, "") + nextExtension;
}

async function optimizeReferenceFile(file: File) {
  const shouldOptimizeImage =
    (file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp") &&
    file.size > AUTO_RESIZE_TARGET_FILE_SIZE;

  if (!shouldOptimizeImage || typeof document === "undefined") {
    return file;
  }

  try {
    const image = await loadImageElement(file);
    const maxDimension = Math.max(image.width, image.height);
    const scale = Math.min(1, AUTO_RESIZE_IMAGE_MAX_DIMENSION / maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const targetType = file.type === "image/png" ? "image/jpeg" : file.type;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, targetType, 0.82);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const optimizedName =
      targetType === file.type ? file.name : replaceFileExtension(file.name, ".jpg");

    return new File([blob], optimizedName, {
      type: targetType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function SectionCard({
  step,
  title,
  description,
  tone,
  badgeLabel,
  icon,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  tone: keyof typeof sectionToneStyles;
  badgeLabel: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const toneStyles = sectionToneStyles[tone];

  return (
    <section className="flow-theme-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${toneStyles.icon}`}
          >
            {icon}
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 [font-family:var(--font-flow-mono)]">
              <span>{step}/3</span>
              <span className="h-1 w-1 rounded-full bg-stone-300" />
              <span>{badgeLabel}</span>
            </div>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function SummaryChip({
  icon,
  label,
  tone = "slate",
}: {
  icon?: ReactNode;
  label: string;
  tone?: keyof typeof summaryChipToneStyles;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium [font-family:var(--font-flow-mono)] ${summaryChipToneStyles[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function SummaryBlock({
  icon,
  label,
  value,
  tone = "slate",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: keyof typeof summaryBlockToneStyles;
}) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${summaryBlockToneStyles[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-inherit/75">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-inherit">{value}</p>
    </div>
  );
}

function SelectorChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition"
          : "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
      {label} {required ? <span className="text-rose-500">*</span> : null}
    </label>
  );
}

export default function IntakeForm({
  businessName,
  liffId,
  uploadUrl,
  uploadLabel,
  initialCategory,
  initialProduct,
  intakeMode,
}: {
  businessName: string;
  liffId: string;
  uploadUrl?: string;
  uploadLabel?: string;
  initialCategory?: string;
  initialProduct?: string;
  intakeMode: "resume" | "fresh";
}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitOutcome, setSubmitOutcome] = useState<"quote" | "review" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitWarning, setSubmitWarning] = useState("");
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [liffIdToken, setLiffIdToken] = useState("");
  const [liffAccessToken, setLiffAccessToken] = useState("");
  const [liffContextSnapshot, setLiffContextSnapshot] = useState("");
  const [productType, setProductType] = useState("");
  const [selectedProductLabel, setSelectedProductLabel] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState("cm");
  const [qty, setQty] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [phone, setPhone] = useState("");
  const [billingEntityType, setBillingEntityType] =
    useState<BillingEntityType>("person");
  const [billingBranchType, setBillingBranchType] =
    useState<BillingBranchType>("head_office");
  const [billingBranchCode, setBillingBranchCode] = useState("");
  const [requestedDocumentType, setRequestedDocumentType] =
    useState<DocumentRequestType>("quote");
  const [billingName, setBillingName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode | "">("");
  const [fulfillmentAddressLine1, setFulfillmentAddressLine1] = useState("");
  const [fulfillmentAddressLine2, setFulfillmentAddressLine2] = useState("");
  const [fulfillmentSubdistrict, setFulfillmentSubdistrict] = useState("");
  const [fulfillmentDistrict, setFulfillmentDistrict] = useState("");
  const [fulfillmentProvince, setFulfillmentProvince] = useState("");
  const [fulfillmentPostalCode, setFulfillmentPostalCode] = useState("");
  const [fulfillmentLatitude, setFulfillmentLatitude] = useState("");
  const [fulfillmentLongitude, setFulfillmentLongitude] = useState("");
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [designBrief, setDesignBrief] = useState("");
  const [note, setNote] = useState("");
  const [referenceInfo, setReferenceInfo] = useState("");
  const [suggestedProductTypes, setSuggestedProductTypes] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFilePreview[]>([]);
  const [prefillSummary, setPrefillSummary] = useState<string[]>([]);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);
  const reportedLiffIncidentKeysRef = useRef<Set<string>>(new Set());
  const liffConsoleFingerprintRef = useRef(createLiffDebugFingerprint());
  const earliestDueDate = getBangkokTodayDateString();

  const reportLiffIncident = useCallback(
    (input: { stage: string; message?: string }) => {
      const dedupeKey = `${input.stage}:${input.message || ""}`;
      if (reportedLiffIncidentKeysRef.current.has(dedupeKey)) {
        return;
      }

      reportedLiffIncidentKeysRef.current.add(dedupeKey);

      sendLiffIncident({
        fingerprint: liffConsoleFingerprintRef.current,
        stage: input.stage,
        message: input.message,
        pathname:
          typeof window !== "undefined" ? window.location.pathname : "/liff/intake",
        searchParamKeys:
          typeof window !== "undefined" ? getSearchParamKeys(window.location.search) : [],
        intakeMode,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        sdkPresent: typeof window !== "undefined" && Boolean(window.liff),
        liffIdConfigured: Boolean(liffId),
        lineUserId,
        liffContextSnapshot,
      });
    },
    [intakeMode, liffContextSnapshot, liffId, lineUserId]
  );

  const logIntakeLiffConsole = useCallback(
    (
      stage: string,
      details?: Record<string, unknown>,
      level?: LiffConsoleLevel
    ) => {
      const runtimeEnv = process.env.NODE_ENV || "development";

      logLiffConsole(
        stage,
        {
          source: "liff-intake",
          runtimeEnv,
          prod: runtimeEnv === "production",
          fingerprint: liffConsoleFingerprintRef.current,
          intakeMode,
          pathname:
            typeof window !== "undefined" ? window.location.pathname : "/liff/intake",
          searchParamKeys:
            typeof window !== "undefined" ? getSearchParamKeys(window.location.search) : [],
          liffIdConfigured: Boolean(liffId),
          lineUserIdHint: compactLineUserIdForDebug(lineUserId),
          ...details,
        },
        level
      );
    },
    [intakeMode, liffId, lineUserId]
  );

  const selectedUnitLabel = UNITS.find((item) => item.value === unit)?.label || unit;
  const billingBranchSummary =
    billingEntityType === "company"
      ? billingBranchType === "branch"
        ? `สาขา ${billingBranchCode || ""}`.trim()
        : BILLING_BRANCH_TYPE_LABELS[billingBranchType]
      : null;
  const requiresFulfillmentAddress =
    fulfillmentMode === "delivery" || fulfillmentMode === "install";
  const fulfillmentAddressSummary = compactSummaryText(
    [
      fulfillmentAddressLine1,
      fulfillmentSubdistrict,
      fulfillmentDistrict,
      fulfillmentProvince,
      fulfillmentPostalCode,
    ]
      .filter(Boolean)
      .join(" "),
    34
  );
  const fulfillmentSummary = [
    fulfillmentMode ? FULFILLMENT_MODE_LABELS[fulfillmentMode] : null,
    requiresFulfillmentAddress ? fulfillmentAddressSummary : null,
    fulfillmentLatitude && fulfillmentLongitude ? "มีพิกัดแล้ว" : null,
  ].filter(Boolean) as string[];
  const documentSummary = [
    DOCUMENT_REQUEST_TYPE_LABELS[requestedDocumentType],
    compactSummaryText(billingName, 18),
    billingBranchSummary,
    taxId ? `Tax ${taxId}` : null,
  ].filter(Boolean) as string[];

  useEffect(() => {
    setSelectedProductLabel(productType ? resolveProductTypeLabel(productType) : "");
  }, [productType]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (billingEntityType !== "company") {
      if (billingBranchType !== "head_office") {
        setBillingBranchType("head_office");
      }
      if (billingBranchCode) {
        setBillingBranchCode("");
      }
      return;
    }

    if (billingBranchType === "head_office" && billingBranchCode) {
      setBillingBranchCode("");
    }
  }, [billingBranchCode, billingBranchType, billingEntityType]);

  const requestCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("อุปกรณ์นี้ยังไม่รองรับการดึงตำแหน่งอัตโนมัติ");
      return;
    }

    setCapturingLocation(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFulfillmentLatitude(position.coords.latitude.toFixed(6));
        setFulfillmentLongitude(position.coords.longitude.toFixed(6));
        setLocationMessage("บันทึก latitude / longitude ปัจจุบันแล้ว");
        setCapturingLocation(false);
      },
      () => {
        setLocationMessage("ไม่สามารถอ่านพิกัดได้ ลองเปิดสิทธิ์ตำแหน่งแล้วกดอีกครั้ง");
        setCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    async function initLiff() {
      try {
        logIntakeLiffConsole("init_start", {
          intakeMode,
          liffIdConfigured: Boolean(liffId),
          searchParamKeys:
            typeof window !== "undefined" ? getSearchParamKeys(window.location.search) : [],
        });

        if (!liffId) {
          logIntakeLiffConsole("init_skipped_no_liff_id", { intakeMode });
          setReady(true);
          return;
        }

        await window.liff.init({ liffId });

        logIntakeLiffConsole("init_ok", {
          intakeMode,
          isLoggedIn: window.liff.isLoggedIn(),
          isInClient: window.liff.isInClient(),
          liffSdkVersion: window.liff.getVersion?.() || null,
        });

        if (!window.liff.isLoggedIn()) {
          logIntakeLiffConsole("login_redirect", {
            intakeMode,
            redirectPath:
              typeof window !== "undefined" ? window.location.pathname : "/liff/intake",
          });
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await window.liff.getProfile();
        const idToken = window.liff.getIDToken();
        const accessToken = window.liff.getAccessToken?.() || "";
        const context = window.liff.getContext?.();
        const appLanguage =
          window.liff.getAppLanguage?.() || window.liff.getLanguage?.() || null;
        const liffSdkVersion = window.liff.getVersion?.() || null;
        const lineVersion = window.liff.getLineVersion?.() || null;
        const operatingSystem = window.liff.getOS?.() || null;
        let grantedScopes: string[] = [];
        let friendshipStatus: boolean | null = null;

        if (window.liff.permission?.getGrantedAll) {
          try {
            grantedScopes = await window.liff.permission.getGrantedAll();
          } catch {
            grantedScopes = [];
          }
        }

        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setLiffIdToken(idToken || "");
        setLiffAccessToken(accessToken || "");

        logIntakeLiffConsole("session_captured", {
          lineUserId: compactLineUserIdForDebug(profile.userId),
          displayName: profile.displayName,
          contextType: context?.type || null,
          viewType: context?.viewType || null,
          lineVersion,
          liffSdkVersion,
          grantedScopesCount: grantedScopes.length,
        });

        if (window.liff.isInClient()) {
          try {
            await window.liff.requestFriendship();
          } catch {
            // Only supported in the LIFF browser full-screen flow.
          }
        }

        if (window.liff.getFriendship) {
          try {
            const friendship = await window.liff.getFriendship();
            friendshipStatus = friendship.friendFlag;
          } catch {
            friendshipStatus = null;
          }
        }

        setLiffContextSnapshot(
          JSON.stringify({
            collectedAt: new Date().toISOString(),
            os: operatingSystem,
            appLanguage,
            lineVersion,
            liffSdkVersion,
            isInClient: window.liff.isInClient(),
            isLoggedIn: window.liff.isLoggedIn(),
            grantedScopes,
            context: context
              ? {
                  type: context.type || null,
                  userId: context.userId || null,
                  liffId: context.liffId || null,
                  viewType: context.viewType || null,
                  endpointUrl: context.endpointUrl || null,
                  scope: Array.isArray(context.scope) ? context.scope : [],
                  availability: context.availability || {},
                  miniAppId: context.miniAppId || null,
                  miniDomainAllowed:
                    typeof context.miniDomainAllowed === "boolean"
                      ? context.miniDomainAllowed
                      : null,
                  permanentLinkPattern: context.permanentLinkPattern || null,
                }
              : null,
            friendshipStatus,
          })
        );

        // Prefill returning customer data (skip for fresh/restart mode)
        const devLineUserId = new URLSearchParams(window.location.search)
          .get("lineUserId")
          ?.trim();

        if (intakeMode !== "fresh" && (idToken || devLineUserId)) {
          try {
            const prefillQuery = idToken
              ? `liffIdToken=${encodeURIComponent(idToken)}`
              : `lineUserId=${encodeURIComponent(devLineUserId || "")}`;
            logIntakeLiffConsole("prefill_start", {
              hasIdToken: Boolean(idToken),
              hasDevLineUserId: Boolean(devLineUserId),
            });
            const prefillRes = await fetch(
              `/api/customers/prefill?${prefillQuery}`,
              {
                headers: {
                  "x-liff-debug-fingerprint": liffConsoleFingerprintRef.current,
                },
              }
            );
            if (!prefillRes.ok) {
              logIntakeLiffConsole(
                "prefill_http_error",
                { status: prefillRes.status }
              );
              reportLiffIncident({
                stage: "prefill_http_error",
                message: `status ${prefillRes.status}`,
              });
            }
            if (prefillRes.ok) {
              const prefill = await prefillRes.json();
              const summary: string[] = [];
              const lastRequestedDocumentType = prefill.lastValues
                ?.requestedDocumentType as DocumentRequestType | null | undefined;
              const lastBillingEntityType = prefill.lastValues
                ?.billingEntityType as BillingEntityType | null | undefined;
              const lastBillingBranchType = prefill.lastValues
                ?.billingBranchType as BillingBranchType | null | undefined;
              const lastFulfillmentMode = prefill.lastValues
                ?.fulfillmentMode as FulfillmentMode | null | undefined;

              if (prefill.phone) {
                setPhone((current) => current || prefill.phone);
                summary.push(`เบอร์ ${prefill.phone}`);
              }

              if (prefill.recentProductTypes?.length > 0) {
                setSuggestedProductTypes(prefill.recentProductTypes);
              }

              if (prefill.lastValues?.widthMm) {
                setWidth((current) => current || formatUnitValue(prefill.lastValues.widthMm));
              }
              if (prefill.lastValues?.heightMm) {
                setHeight((current) => current || formatUnitValue(prefill.lastValues.heightMm));
              }
              if (prefill.lastValues?.widthMm && prefill.lastValues?.heightMm) {
                summary.push(
                  `ขนาด ${formatUnitValue(prefill.lastValues.widthMm)} × ${formatUnitValue(prefill.lastValues.heightMm)} ซม.`
                );
              }
              if (prefill.lastValues?.qty) {
                setQty((current) => (current === "1" ? String(prefill.lastValues.qty) : current));
                summary.push(`จำนวน ${prefill.lastValues.qty}`);
              }

              if (lastRequestedDocumentType) {
                setRequestedDocumentType((current) =>
                  current === "quote"
                    ? lastRequestedDocumentType
                    : current
                );
                summary.push(DOCUMENT_REQUEST_TYPE_LABELS[lastRequestedDocumentType]);
              }
              if (lastBillingEntityType) {
                setBillingEntityType((current) =>
                  current === "person"
                    ? lastBillingEntityType
                    : current
                );
                summary.push(BILLING_ENTITY_TYPE_LABELS[lastBillingEntityType]);
              }
              if (lastBillingBranchType) {
                setBillingBranchType((current) =>
                  current === "head_office"
                    ? lastBillingBranchType
                    : current
                );
                summary.push(
                  lastBillingBranchType === "branch"
                    ? `สาขา ${prefill.lastValues.billingBranchCode || ""}`.trim()
                    : BILLING_BRANCH_TYPE_LABELS[lastBillingBranchType]
                );
              }
              if (prefill.lastValues?.billingBranchCode) {
                setBillingBranchCode((current) => current || prefill.lastValues.billingBranchCode);
              }
              if (prefill.lastValues?.billingName) {
                setBillingName((current) => current || prefill.lastValues.billingName);
                const compactName = compactSummaryText(prefill.lastValues.billingName);
                if (compactName) {
                  summary.push(compactName);
                }
              }
              if (prefill.lastValues?.taxId) {
                setTaxId((current) => current || prefill.lastValues.taxId);
              }
              if (prefill.lastValues?.billingAddress) {
                setBillingAddress((current) => current || prefill.lastValues.billingAddress);
              }
              if (lastFulfillmentMode) {
                setFulfillmentMode((current) => current || lastFulfillmentMode);
                summary.push(FULFILLMENT_MODE_LABELS[lastFulfillmentMode]);
              }
              if (prefill.lastValues?.fulfillmentAddressLine1) {
                setFulfillmentAddressLine1(
                  (current) => current || prefill.lastValues.fulfillmentAddressLine1
                );
              }
              if (prefill.lastValues?.fulfillmentAddressLine2) {
                setFulfillmentAddressLine2(
                  (current) => current || prefill.lastValues.fulfillmentAddressLine2
                );
              }
              if (prefill.lastValues?.fulfillmentSubdistrict) {
                setFulfillmentSubdistrict(
                  (current) => current || prefill.lastValues.fulfillmentSubdistrict
                );
              }
              if (prefill.lastValues?.fulfillmentDistrict) {
                setFulfillmentDistrict(
                  (current) => current || prefill.lastValues.fulfillmentDistrict
                );
              }
              if (prefill.lastValues?.fulfillmentProvince) {
                setFulfillmentProvince(
                  (current) => current || prefill.lastValues.fulfillmentProvince
                );
              }
              if (prefill.lastValues?.fulfillmentPostalCode) {
                setFulfillmentPostalCode(
                  (current) => current || prefill.lastValues.fulfillmentPostalCode
                );
              }
              if (typeof prefill.lastValues?.fulfillmentLatitude === "number") {
                setFulfillmentLatitude((current) =>
                  current || formatCoordinateValue(prefill.lastValues.fulfillmentLatitude)
                );
              }
              if (typeof prefill.lastValues?.fulfillmentLongitude === "number") {
                setFulfillmentLongitude((current) =>
                  current || formatCoordinateValue(prefill.lastValues.fulfillmentLongitude)
                );
              }

              const compactFulfillmentAddress = compactSummaryText(
                [
                  prefill.lastValues?.fulfillmentAddressLine1,
                  prefill.lastValues?.fulfillmentDistrict,
                  prefill.lastValues?.fulfillmentProvince,
                ]
                  .filter(Boolean)
                  .join(" "),
                24
              );
              if (compactFulfillmentAddress) {
                summary.push(compactFulfillmentAddress);
              }

              setPrefillSummary(Array.from(new Set(summary)).slice(0, 5));

              logIntakeLiffConsole("prefill_ok", {
                suggestedProductTypes: prefill.recentProductTypes?.length || 0,
                summaryCount: Array.from(new Set(summary)).slice(0, 5).length,
              });
            }
          } catch (error) {
            logIntakeLiffConsole(
              "prefill_failed",
              { message: getErrorMessage(error) }
            );
            reportLiffIncident({
              stage: "prefill_failed",
              message: getErrorMessage(error),
            });
            // non-critical — form still works without prefill
          }
        }

        setReady(true);
      } catch (err) {
        logIntakeLiffConsole(
          "init_failed",
          {
            message: getErrorMessage(err),
            errorName: err instanceof Error ? err.name : null,
          }
        );
        reportLiffIncident({
          stage: "init_failed",
          message: getErrorMessage(err),
        });
        setReady(true);
      }
    }

    if (typeof window !== "undefined" && window.liff) {
      logIntakeLiffConsole("sdk_present", { intakeMode });
      initLiff();
    } else {
      logIntakeLiffConsole("sdk_wait_start", { intakeMode });
      const check = setInterval(() => {
        if (typeof window !== "undefined" && window.liff) {
          clearInterval(check);
          logIntakeLiffConsole("sdk_present_after_wait", { intakeMode });
          initLiff();
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        if (typeof window !== "undefined" && !window.liff && liffId) {
          logIntakeLiffConsole(
            "sdk_load_timeout",
            { timeoutMs: 5000, intakeMode }
          );
          reportLiffIncident({
            stage: "sdk_load_timeout",
            message: "LIFF SDK was not available within 5000ms",
          });
        }
        setReady(true);
      }, 5000);
    }
  }, [intakeMode, liffId, logIntakeLiffConsole, reportLiffIncident]);

  const handleReferenceFileSelect = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;

    const incoming = Array.from(files);
    if (referenceFiles.length + incoming.length > MAX_REFERENCE_FILES) {
      setError(`เพิ่มรูปหรือไฟล์ได้สูงสุด ${MAX_REFERENCE_FILES} ไฟล์`);
      return;
    }

    const optimizedIncoming = await Promise.all(
      incoming.map((file) => optimizeReferenceFile(file))
    );

    for (const file of optimizedIncoming) {
      if (!file.type) {
        setError("ไฟล์ต้องมีประเภทที่ชัดเจน กรุณาเลือกไฟล์ใหม่");
        return;
      }
      const isAllowed =
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        file.type === "image/webp" ||
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        file.type === "application/pdf";
      if (!isAllowed) {
        setError("รองรับเฉพาะรูปภาพ PNG, JPG, WEBP, HEIC, HEIF หรือ PDF");
        return;
      }
      if (file.size > MAX_REFERENCE_FILE_SIZE) {
        setError("ไฟล์ใหญ่เกิน 10MB กรุณาลดขนาดรูปแล้วลองใหม่");
        return;
      }
    }

    const nextFiles = optimizedIncoming.map((file) => {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      if (previewUrl) {
        previewUrlsRef.current.push(previewUrl);
      }
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.name}`,
        file,
        previewUrl,
      };
    });

    setError("");
    setReferenceFiles((prev) => [...prev, ...nextFiles]);
  }, [referenceFiles.length]);

  const removeReferenceFile = useCallback((id: string) => {
    setReferenceFiles((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (url) => url !== removed.previewUrl
        );
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      setSubmitWarning("");

      logIntakeLiffConsole("submit_start", {
        productType,
        referenceFileCount: referenceFiles.length,
        hasLiffIdToken: Boolean(liffIdToken),
        hasLiffContextSnapshot: Boolean(liffContextSnapshot),
      });

      if (!productType) {
        setError("กรุณาเลือกประเภทงาน");
        setLoading(false);
        return;
      }
      if (!width || Number(width) <= 0) {
        setError("กรุณาระบุความกว้าง");
        setLoading(false);
        return;
      }
      if (!height || Number(height) <= 0) {
        setError("กรุณาระบุความสูง");
        setLoading(false);
        return;
      }
      if (!phone) {
        setError("กรุณาระบุเบอร์โทร");
        setLoading(false);
        return;
      }
      if (!dueDate) {
        setError("กรุณาระบุวันที่ต้องการใช้งาน");
        setLoading(false);
        return;
      }
      if (dueDate < earliestDueDate) {
        setError("ไม่สามารถเลือกวันย้อนหลังได้ กรุณาเลือกวันนี้หรือวันถัดไป");
        setLoading(false);
        return;
      }
      if (!fulfillmentMode) {
        setError("กรุณาเลือกวิธีรับงาน");
        setLoading(false);
        return;
      }
      if (
        requiresFulfillmentAddress &&
        (!fulfillmentAddressLine1.trim() ||
          !fulfillmentDistrict.trim() ||
          !fulfillmentProvince.trim() ||
          !fulfillmentPostalCode.trim())
      ) {
        setError("กรุณากรอกที่อยู่จัดส่ง/ติดตั้งให้ครบก่อนส่งฟอร์ม");
        setLoading(false);
        return;
      }
      if ((fulfillmentLatitude.trim() && !fulfillmentLongitude.trim()) || (!fulfillmentLatitude.trim() && fulfillmentLongitude.trim())) {
        setError("ถ้าระบุพิกัด กรุณากรอก latitude และ longitude ให้ครบทั้งคู่");
        setLoading(false);
        return;
      }
      if (fulfillmentLatitude.trim() && Number.isNaN(Number(fulfillmentLatitude))) {
        setError("latitude ต้องเป็นตัวเลข");
        setLoading(false);
        return;
      }
      if (fulfillmentLongitude.trim() && Number.isNaN(Number(fulfillmentLongitude))) {
        setError("longitude ต้องเป็นตัวเลข");
        setLoading(false);
        return;
      }
      if (
        billingEntityType === "company" &&
        requestedDocumentType === "tax_invoice" &&
        billingBranchType === "branch" &&
        !billingBranchCode.trim()
      ) {
        setError("กรุณาระบุเลขสาขาสำหรับใบกำกับภาษีของนิติบุคคล");
        setLoading(false);
        return;
      }
      if (liffId && !liffIdToken) {
        logIntakeLiffConsole(
          "submit_missing_identity",
          { intakeMode, liffIdConfigured: Boolean(liffId) }
        );
        reportLiffIncident({
          stage: "submit_missing_identity",
          message: "LIFF ID token is missing before intake submit",
        });
        setError("ไม่สามารถยืนยันตัวตนจาก LINE ได้ กรุณาเปิดฟอร์มนี้จาก LINE แล้วลองใหม่");
        setLoading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("lineUserId", lineUserId || "");
        formData.append("displayName", displayName || "");
        formData.append("liffIdToken", liffIdToken || "");
        formData.append("productType", productType);
        formData.append("width", String(Number(width)));
        formData.append("height", String(Number(height)));
        formData.append("unit", unit);
        formData.append("qty", String(Number(qty) || 1));
        formData.append("dueDate", dueDate);
        formData.append("phone", phone);
        formData.append("fulfillmentMode", fulfillmentMode);
        formData.append("fulfillmentAddressLine1", requiresFulfillmentAddress ? fulfillmentAddressLine1 : "");
        formData.append("fulfillmentAddressLine2", requiresFulfillmentAddress ? fulfillmentAddressLine2 : "");
        formData.append("fulfillmentSubdistrict", requiresFulfillmentAddress ? fulfillmentSubdistrict : "");
        formData.append("fulfillmentDistrict", requiresFulfillmentAddress ? fulfillmentDistrict : "");
        formData.append("fulfillmentProvince", requiresFulfillmentAddress ? fulfillmentProvince : "");
        formData.append("fulfillmentPostalCode", requiresFulfillmentAddress ? fulfillmentPostalCode : "");
        formData.append("fulfillmentLatitude", requiresFulfillmentAddress ? fulfillmentLatitude : "");
        formData.append("fulfillmentLongitude", requiresFulfillmentAddress ? fulfillmentLongitude : "");
        formData.append("requestedDocumentType", requestedDocumentType);
        formData.append("billingEntityType", billingEntityType);
        formData.append(
          "billingBranchType",
          billingEntityType === "company" ? billingBranchType : ""
        );
        formData.append(
          "billingBranchCode",
          billingEntityType === "company" && billingBranchType === "branch"
            ? billingBranchCode
            : ""
        );
        formData.append("billingName", billingName);
        formData.append("taxId", taxId);
        formData.append("billingAddress", billingAddress);
        formData.append("designBrief", designBrief);
        formData.append("note", note);
        formData.append("referenceInfo", referenceInfo);
        formData.append("intakeMode", intakeMode);
        formData.append("liffAccessToken", liffAccessToken || "");
        formData.append("liffContextSnapshot", liffContextSnapshot || "");
        referenceFiles.forEach((item) => {
          formData.append("referenceFiles", item.file, item.file.name);
        });

        const res = await fetch("/api/intake", {
          method: "POST",
          headers: {
            "x-liff-debug-fingerprint": liffConsoleFingerprintRef.current,
          },
          body: formData,
        });

        const result = await res.json();
        if (!res.ok) {
          logIntakeLiffConsole(
            "submit_http_error",
            {
              status: res.status,
              message:
                typeof result.error === "string" ? result.error.slice(0, 180) : "unknown",
            }
          );
          setError(result.error || "เกิดข้อผิดพลาด");
          setLoading(false);
          return;
        }

        logIntakeLiffConsole("submit_ok", {
          outcome: result.needsReview ? "review" : "quote",
          hasReferenceUploadWarning: typeof result.referenceUploadWarning === "string",
        });

        setSubmitOutcome(result.needsReview ? "review" : "quote");
        setSubmitMessage(
          result.needsReview
            ? "ทีมงานได้รับข้อมูลแล้ว และจะติดต่อกลับทาง LINE เพื่อช่วยสรุปรายละเอียดเพิ่มเติมค่ะ"
            : "เราจะส่งใบเสนอราคาให้ทาง LINE ค่ะ"
        );
        setSubmitWarning(typeof result.referenceUploadWarning === "string" ? result.referenceUploadWarning : "");
        if (typeof window !== "undefined" && window.liff?.isInClient()) {
          const closeDelayMs = typeof result.referenceUploadWarning === "string" ? 5500 : 3000;
          setTimeout(() => window.liff.closeWindow(), closeDelayMs);
        }
      } catch (error) {
        logIntakeLiffConsole(
          "submit_network_failed",
          { message: getErrorMessage(error) }
        );
        setError("ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    },
    [
      productType,
      width,
      height,
      unit,
      qty,
      dueDate,
      earliestDueDate,
      phone,
      fulfillmentMode,
      requiresFulfillmentAddress,
      fulfillmentAddressLine1,
      fulfillmentAddressLine2,
      fulfillmentSubdistrict,
      fulfillmentDistrict,
      fulfillmentProvince,
      fulfillmentPostalCode,
      fulfillmentLatitude,
      fulfillmentLongitude,
      requestedDocumentType,
      billingEntityType,
      billingBranchType,
      billingBranchCode,
      billingName,
      taxId,
      billingAddress,
      designBrief,
      note,
      referenceInfo,
      referenceFiles,
      lineUserId,
      displayName,
      liffId,
      liffIdToken,
      liffAccessToken,
      liffContextSnapshot,
      intakeMode,
      logIntakeLiffConsole,
      reportLiffIncident,
    ]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="liff-panel w-full max-w-sm p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-amber-600" />
          <p className="mt-4 text-sm font-medium text-slate-700">กำลังเปิดฟอร์มใน LINE...</p>
        </div>
      </div>
    );
  }

  if (submitOutcome) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="liff-panel w-full max-w-sm p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-stone-100 text-slate-900 shadow-sm">
              {submitOutcome === "review" ? (
                <PhoneCall className="size-8" aria-hidden="true" />
              ) : (
                <BadgeCheck className="size-8" aria-hidden="true" />
              )}
            </div>
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">
            {submitOutcome === "review" ? "ทีมงานรับเคสแล้ว" : "ส่งข้อมูลเรียบร้อยแล้ว!"}
          </h2>
          <p className="text-sm text-slate-600">{submitMessage}</p>
          {submitWarning ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-6 text-amber-900">
              {submitWarning}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-slate-400">หน้าต่างจะปิดอัตโนมัติ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4">
      <div className="mx-auto max-w-lg">
        <div className="flow-theme-card overflow-hidden">
          <div className="liff-flow-hero px-4 py-5 text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/88 backdrop-blur-sm">
                LINE MINI App
              </span>
              <span className="inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/78 backdrop-blur-sm">
                {intakeMode === "fresh" ? "งานใหม่" : "ต่อรายการ"}
              </span>
            </div>

            <div className="mt-4">
              <div className="min-w-0">
                <h1 className="text-[23px] font-semibold leading-tight text-white">{`สั่งงานกับ ${businessName}`}</h1>
                <p className="mt-1 text-sm text-slate-200">ใส่ข้อมูลหลักก่อน แล้วค่อยแนบไฟล์เพิ่มถ้าจำเป็น</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {displayName ? <SummaryChip label={`คุณ ${displayName}`} tone="emerald" /> : null}
                  {prefillSummary.length > 0 ? (
                    <SummaryChip
                      icon={<ScrollText className="size-3.5" aria-hidden="true" />}
                      label="ดึงข้อมูลล่าสุดแล้ว"
                      tone="sky"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <SummaryBlock
                icon={<Package2 className="size-3.5" aria-hidden="true" />}
                label="ขั้นแรก"
                value="เลือกงาน"
                tone="emerald"
              />
              <SummaryBlock
                icon={<Ruler className="size-3.5" aria-hidden="true" />}
                label="ถัดไป"
                value="ใส่ขนาด"
                tone="sky"
              />
              <SummaryBlock
                icon={<Paperclip className="size-3.5" aria-hidden="true" />}
                label="ถ้ามี"
                value="แนบไฟล์"
                tone="amber"
              />
            </div>

            {prefillSummary.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {prefillSummary.map((item) => (
                  <span
                    key={item}
                    className="rounded-lg bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/84 backdrop-blur-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-4 py-5 pb-28">
            <SectionCard
              step="1"
              title="เลือกงาน"
              description="เริ่มจากหมวดและชนิดสินค้า ระบบจะดึงงานล่าสุดให้ถ้ามี"
              tone="emerald"
              badgeLabel="จำเป็น"
              icon={<Package2 className="size-5" aria-hidden="true" />}
            >
              <div>
                {suggestedProductTypes.length > 0 && !productType && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      ล่าสุด
                    </span>
                    {suggestedProductTypes.slice(0, 3).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProductType(t)}
                        className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-200"
                      >
                        {resolveProductTypeLabel(t)}
                      </button>
                    ))}
                  </div>
                )}
                <ProductTypePicker
                  value={productType}
                  onChange={(nextValue) => setProductType(nextValue)}
                  onSelectedProductChange={(product) =>
                    setSelectedProductLabel(product?.label || "")
                  }
                  initialCategory={initialCategory}
                  initialProduct={initialProduct}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="2"
              title="ข้อมูลงาน"
              description="ข้อมูลชุดนี้ใช้ประเมินราคาและนัดวันใช้งาน"
              tone="sky"
              badgeLabel="หลัก"
              icon={<Ruler className="size-5" aria-hidden="true" />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="width" label="ขนาด" required />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2">
                    <input
                      id="width"
                      type="number"
                      inputMode="decimal"
                      placeholder="กว้าง"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className={inputClassName}
                      step="any"
                      min="0"
                    />
                    <span className="pb-3 text-slate-400">×</span>
                    <input
                      id="height"
                      type="number"
                      inputMode="decimal"
                      placeholder="สูง"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className={inputClassName}
                      step="any"
                      min="0"
                    />
                    <select
                      aria-label="หน่วยวัด"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className={`${selectClassName} w-auto min-w-22`}
                    >
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="qty" label="จำนวน" />
                  <input
                    id="qty"
                    type="number"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className={inputClassName}
                    min="1"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="dueDate" label="ต้องการใช้งานวันที่" required />
                  <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={earliestDueDate}
                    className={inputClassName}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="phone" label="เบอร์โทร" required />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="08x-xxx-xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="md:col-span-2 rounded-[20px] border border-slate-200 bg-slate-50/82 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                          {fulfillmentMode === "delivery" ? (
                            <Truck className="size-4.5" aria-hidden="true" />
                          ) : (
                            <MapPin className="size-4.5" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">การรับงานและหน้างาน</p>
                          <p className="text-xs leading-5 text-slate-500">
                            เลือกว่าลูกค้าจะมารับเอง ให้จัดส่ง หรือให้ทีมไปติดตั้ง
                          </p>
                        </div>
                      </div>
                    </div>
                    {fulfillmentSummary.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {fulfillmentSummary.map((item) => (
                          <SummaryChip key={item} label={item} tone="sky" />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {FULFILLMENT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFulfillmentMode(option.value)}
                        aria-pressed={fulfillmentMode === option.value}
                        className={
                          fulfillmentMode === option.value
                            ? "rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-left text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)] transition"
                            : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        }
                      >
                        <p className="text-sm font-semibold">{option.title}</p>
                        <p
                          className={
                            fulfillmentMode === option.value
                              ? "mt-1 text-xs leading-5 text-white/76"
                              : "mt-1 text-xs leading-5 text-slate-500"
                          }
                        >
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  {requiresFulfillmentAddress ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <FieldLabel
                          htmlFor="fulfillmentAddressLine1"
                          label={
                            fulfillmentMode === "install"
                              ? "ที่อยู่หน้างานติดตั้ง"
                              : "ที่อยู่จัดส่ง"
                          }
                          required
                        />
                        <textarea
                          id="fulfillmentAddressLine1"
                          placeholder="บ้านเลขที่ อาคาร หมู่บ้าน ถนน หรือจุดสังเกตหลัก"
                          value={fulfillmentAddressLine1}
                          onChange={(event) => setFulfillmentAddressLine1(event.target.value)}
                          rows={2}
                          className={textareaClassName}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel htmlFor="fulfillmentAddressLine2" label="รายละเอียดเพิ่ม" />
                        <input
                          id="fulfillmentAddressLine2"
                          type="text"
                          placeholder="เช่น ชั้น อาคาร ข้างร้าน หรือวิธีเข้าหน้างาน"
                          value={fulfillmentAddressLine2}
                          onChange={(event) => setFulfillmentAddressLine2(event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="fulfillmentSubdistrict" label="แขวง / ตำบล" />
                        <input
                          id="fulfillmentSubdistrict"
                          type="text"
                          value={fulfillmentSubdistrict}
                          onChange={(event) => setFulfillmentSubdistrict(event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="fulfillmentDistrict" label="เขต / อำเภอ" required />
                        <input
                          id="fulfillmentDistrict"
                          type="text"
                          value={fulfillmentDistrict}
                          onChange={(event) => setFulfillmentDistrict(event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="fulfillmentProvince" label="จังหวัด" required />
                        <input
                          id="fulfillmentProvince"
                          type="text"
                          value={fulfillmentProvince}
                          onChange={(event) => setFulfillmentProvince(event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="fulfillmentPostalCode" label="รหัสไปรษณีย์" required />
                        <input
                          id="fulfillmentPostalCode"
                          type="text"
                          inputMode="numeric"
                          value={fulfillmentPostalCode}
                          onChange={(event) => setFulfillmentPostalCode(event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white/90 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">พิกัดหน้างาน</p>
                            <p className="text-xs leading-5 text-slate-500">
                              กดดึงตำแหน่งจากเครื่องเพื่อเก็บ latitude / longitude ไว้ให้ทีมงาน
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={requestCurrentLocation}
                            disabled={capturingLocation}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <MapPin className="size-3.5" aria-hidden="true" />
                            {capturingLocation ? "กำลังดึงพิกัด..." : "ใช้ตำแหน่งปัจจุบัน"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <FieldLabel htmlFor="fulfillmentLatitude" label="Latitude" />
                            <input
                              id="fulfillmentLatitude"
                              type="text"
                              inputMode="decimal"
                              placeholder="เช่น 13.756331"
                              value={fulfillmentLatitude}
                              onChange={(event) => setFulfillmentLatitude(event.target.value)}
                              className={inputClassName}
                            />
                          </div>

                          <div>
                            <FieldLabel htmlFor="fulfillmentLongitude" label="Longitude" />
                            <input
                              id="fulfillmentLongitude"
                              type="text"
                              inputMode="decimal"
                              placeholder="เช่น 100.501762"
                              value={fulfillmentLongitude}
                              onChange={(event) => setFulfillmentLongitude(event.target.value)}
                              className={inputClassName}
                            />
                          </div>
                        </div>

                        {locationMessage ? (
                          <p className="mt-3 text-xs font-medium text-slate-600">{locationMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/85 px-4 py-3 text-xs leading-6 text-emerald-900">
                      เลือกแบบมารับเองแล้ว ระบบจะยังไม่บังคับที่อยู่หน้างาน แต่ยังกรอกเพิ่มในโน้ตได้ถ้าต้องการ
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="billingEntityType" label="ออกใบเสนอราคาในนาม" />
                  <div id="billingEntityType" className="grid grid-cols-2 gap-2">
                    {BILLING_ENTITY_TYPES.map((type) => (
                      <SelectorChip
                        key={type}
                        active={billingEntityType === type}
                        onClick={() => setBillingEntityType(type)}
                      >
                        {BILLING_ENTITY_TYPE_LABELS[type]}
                      </SelectorChip>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              step="3"
              title="ไฟล์และเอกสาร"
              description="เปิดเมื่อมีไฟล์อ้างอิง หรือต้องการข้อมูลเอกสาร"
              tone="amber"
              badgeLabel="เสริม"
              icon={<Paperclip className="size-5" aria-hidden="true" />}
            >
              <div className="rounded-[20px] border border-amber-200 bg-amber-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                      <ImagePlus className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">ไฟล์เสริม</p>
                      <p className="text-xs text-amber-800/80">รูป · เอกสาร · ลิงก์</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails((current) => !current)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    {showOptionalDetails ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                    {showOptionalDetails ? "ซ่อน" : "เปิด"}
                  </button>
                </div>
              </div>

              {showOptionalDetails ? (
                <>
                  <div className="flow-theme-note p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                        <ImagePlus className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900">เพิ่มรูปหรือไฟล์อ้างอิง</p>
                        <p className="text-xs text-amber-800/80">Auto resize · สูงสุด 5 ไฟล์ · 10MB / ไฟล์</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white/80 px-4 py-4 text-center text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-white">
                        <Camera className="mb-2 size-6" aria-hidden="true" />
                        เพิ่มรูป / ถ่ายรูป
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                          multiple
                          capture="environment"
                          onChange={(e) => {
                            handleReferenceFileSelect(e.target.files);
                            e.target.value = "";
                          }}
                          className="sr-only"
                        />
                      </label>

                      {uploadUrl ? (
                        <a
                          href={uploadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-stone-200 bg-white/80 px-4 py-4 text-center text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-white"
                        >
                          <FileText className="mb-2 size-6" aria-hidden="true" />
                          {uploadLabel || "เปิดลิงก์รับไฟล์"}
                          <span className="mt-1 text-xs font-normal text-slate-500">ใช้ตอนมีไฟล์ใหญ่หรือโฟลเดอร์เดิม</span>
                        </a>
                      ) : null}
                    </div>

                    {referenceFiles.length > 0 ? (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Preview {referenceFiles.length}/{MAX_REFERENCE_FILES}
                          </p>
                          <p className="text-xs text-slate-500">แตะ x เพื่อลบก่อนส่ง</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {referenceFiles.map((item) => (
                            <div key={item.id} className="relative overflow-hidden rounded-xl border border-white bg-white shadow-sm">
                              {item.previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.previewUrl} alt={item.file.name || "รูปอ้างอิง"} className="aspect-square w-full object-cover" />
                              ) : (
                                <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-slate-50 px-2 text-center text-[11px] font-medium text-slate-600">
                                  <FileText className="size-5" aria-hidden="true" />
                                  PDF
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeReferenceFile(item.id)}
                                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-sm transition hover:bg-slate-950"
                                aria-label={`ลบ ${item.file.name || "ไฟล์อ้างอิง"}`}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {uploadUrl ? (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-xs font-medium text-stone-800">
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1">ไฟล์ใหญ่</span>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1">ใช้ลิงก์สำรองได้</span>
                    </div>
                  ) : null}

                  <div>
                    <FieldLabel htmlFor="designBrief" label="แนวคิดงานที่อยากได้" />
                    <textarea
                      id="designBrief"
                      placeholder="เช่น โทนสี สไตล์ อารมณ์งาน หรือข้อความสำคัญที่อยากให้มีในงาน"
                      value={designBrief}
                      onChange={(e) => setDesignBrief(e.target.value)}
                      rows={4}
                      className={textareaClassName}
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="note" label="โน้ตงาน" />
                    <textarea
                      id="note"
                      placeholder="รายละเอียดสั้น ๆ"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className={textareaClassName}
                    />
                  </div>

                  <div className="flow-theme-soft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                            <ScrollText className="size-4.5" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-semibold text-slate-900">เอกสาร</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {documentSummary.length > 0 ? (
                            <p className="text-xs leading-5 text-stone-600">{documentSummary.join(" · ")}</p>
                          ) : (
                            <p className="text-xs leading-5 text-stone-600">ใบเสนอราคา</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDocumentDetails((current) => !current)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        {showDocumentDetails ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                        {showDocumentDetails ? "ซ่อน" : "แก้ไข"}
                      </button>
                    </div>
                    {showDocumentDetails ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <FieldLabel htmlFor="requestedDocumentType" label="เอกสารหลัก" />
                          <div id="requestedDocumentType" className="flex flex-wrap gap-2">
                            {DOCUMENT_REQUEST_TYPES.map((type) => (
                              <SelectorChip
                                key={type}
                                active={requestedDocumentType === type}
                                onClick={() => setRequestedDocumentType(type as DocumentRequestType)}
                              >
                                {DOCUMENT_REQUEST_TYPE_LABELS[type]}
                              </SelectorChip>
                            ))}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <FieldLabel
                            htmlFor="billingName"
                            label={
                              billingEntityType === "company"
                                ? "ชื่อบริษัท / ชื่อนิติบุคคล"
                                : "ชื่อที่ต้องการให้ออกเอกสาร"
                            }
                          />
                          <input
                            id="billingName"
                            type="text"
                            placeholder={
                              billingEntityType === "company"
                                ? "เช่น TD All Co., Ltd."
                                : "เช่น สมชาย ใจดี"
                            }
                            value={billingName}
                            onChange={(event) => setBillingName(event.target.value)}
                            className={inputClassName}
                          />
                        </div>

                        {billingEntityType === "company" ? (
                          <>
                            <div className="md:col-span-2">
                              <FieldLabel htmlFor="billingBranchType" label="ประเภทสาขา" />
                              <div id="billingBranchType" className="grid grid-cols-2 gap-2">
                                {BILLING_BRANCH_TYPES.map((type) => (
                                  <SelectorChip
                                    key={type}
                                    active={billingBranchType === type}
                                    onClick={() => setBillingBranchType(type)}
                                  >
                                    {BILLING_BRANCH_TYPE_LABELS[type]}
                                  </SelectorChip>
                                ))}
                              </div>
                            </div>

                            {billingBranchType === "branch" ? (
                              <div className="md:col-span-2">
                                <FieldLabel htmlFor="billingBranchCode" label="เลขสาขา" />
                                <input
                                  id="billingBranchCode"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="เช่น 00001"
                                  value={billingBranchCode}
                                  onChange={(event) => setBillingBranchCode(event.target.value)}
                                  className={inputClassName}
                                />
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        <div className="md:col-span-2">
                          <FieldLabel htmlFor="taxId" label="เลขผู้เสียภาษี / Tax ID" />
                          <input
                            id="taxId"
                            type="text"
                            inputMode="numeric"
                            placeholder="ถ้ามี ให้กรอกสำหรับใบกำกับภาษีหรือเอกสารบริษัท"
                            value={taxId}
                            onChange={(event) => setTaxId(event.target.value)}
                            className={inputClassName}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <FieldLabel htmlFor="billingAddress" label="ที่อยู่ออกเอกสาร" />
                          <textarea
                            id="billingAddress"
                            placeholder="เช่น ที่อยู่บริษัทหรือที่อยู่สำหรับออกใบเสนอราคา / ใบกำกับภาษี"
                            value={billingAddress}
                            onChange={(event) => setBillingAddress(event.target.value)}
                            rows={3}
                            className={textareaClassName}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <FieldLabel htmlFor="referenceInfo" label="ลิงก์ไฟล์" />
                    <input
                      id="referenceInfo"
                      type="text"
                      placeholder="วางลิงก์ไฟล์"
                      value={referenceInfo}
                      onChange={(e) => setReferenceInfo(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </>
              ) : null}
            </SectionCard>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flow-theme-card sticky bottom-[calc(env(safe-area-inset-bottom)+10px)] z-10 p-3 backdrop-blur">
              <div className="mb-3 grid grid-cols-3 gap-2">
                <SummaryBlock
                  icon={<Package2 className="size-3.5" aria-hidden="true" />}
                  label="งาน"
                  value={selectedProductLabel || "ยังไม่เลือก"}
                  tone={selectedProductLabel ? "emerald" : "slate"}
                />
                <SummaryBlock
                  icon={<Ruler className="size-3.5" aria-hidden="true" />}
                  label="ขนาด"
                  value={width && height ? `${width} × ${height} ${selectedUnitLabel}` : "ยังไม่ใส่"}
                  tone={width && height ? "sky" : "slate"}
                />
                <SummaryBlock
                  icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
                  label="วันใช้งาน"
                  value={dueDate || "ยังไม่เลือก"}
                  tone={dueDate ? "amber" : "slate"}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "กำลังส่ง..." : "ส่งรายละเอียดงาน"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
