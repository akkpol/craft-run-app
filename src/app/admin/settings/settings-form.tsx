"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clipboard,
  CloudUpload,
  FileImage,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Link2,
  MessageCircle,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_PAYMENT_DISPLAY_MODE,
  PAYMENT_DISPLAY_MODE_LABELS,
  PAYMENT_DISPLAY_MODES,
} from "@/lib/payment-display";
import {
  PAYMENT_ROUTING_CUSTOMER_SCOPE_LABELS,
  PAYMENT_ROUTING_CUSTOMER_SCOPES,
  PAYMENT_ROUTING_TERM_SCOPE_LABELS,
  PAYMENT_ROUTING_TERM_SCOPES,
} from "@/lib/payment-routing";
import { CatalogItemsTable } from "./CatalogItemsTable";
import { PaymentRoutingPreview } from "./PaymentRoutingPreview";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ProductCatalogImportResult = {
  importedCount: number;
  insertedCount: number;
  updatedCount: number;
  activeCount: number;
  generatedValueCount: number;
};

type CustomerMediaStorageStatus = {
  activeProvider: "r2" | "supabase";
  r2Configured: boolean;
  requiredR2EnvKeys: string[];
  missingR2EnvKeys: string[];
  fallbackProvider: "supabase";
};

type ProductionMediaStorageStatus = {
  activeProvider: "supabase";
  bucket: string;
  metadataTables: string[];
  uploadEnabled: boolean;
  customerSendEnabled: boolean;
  retentionDays: number;
};

type DocumentAppendixStorageStatus = {
  activeProvider: "supabase";
  bucket: string;
  imageConfigured: boolean;
  imageName: string;
};

type SupabaseDiagnosticsTable = {
  key: "customers" | "leads" | "quotes" | "jobs" | "productCatalogItems";
  label: string;
  count: number | null;
  status: "populated" | "empty" | "error";
  errorMessage: string | null;
};

type SupabaseDiagnostics = {
  projectHost: string;
  projectRef: string | null;
  appSettingsRowPresent: boolean;
  coreDataPresent: boolean;
  errorSummary: string | null;
  tables: SupabaseDiagnosticsTable[];
};

type SettingsAssetType =
  | "logo"
  | "catalog"
  | "paymentQr"
  | "paymentSecondaryQr"
  | "documentAppendixImage";

type SettingsState = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccountName: string;
  paymentBankName: string;
  paymentAccountNumber: string;
  paymentPromptPayId: string;
  paymentQrCodeUrl: string;
  paymentQrCodeLabel: string;
  paymentDisplayMode: string;
  paymentSecondaryAccountName: string;
  paymentSecondaryBankName: string;
  paymentSecondaryAccountNumber: string;
  paymentSecondaryPromptPayId: string;
  paymentSecondaryQrCodeUrl: string;
  paymentSecondaryQrCodeLabel: string;
  paymentSecondaryDisplayMode: string;
  paymentSecondaryInstructions: string;
  paymentSecondaryMaxQuoteTotal: number | null;
  paymentSecondaryCustomerScope: string;
  paymentSecondaryPaymentTermsScope: string;
  paymentInstructions: string;
  businessLogoUrl: string;
  businessCatalogUrl: string;
  businessCatalogName: string;
  documentAppendixImageUrl: string;
  documentAppendixImageName: string;
  customerUploadUrl: string;
  customerUploadLabel: string;
  customerMediaStorage: CustomerMediaStorageStatus;
  productionMediaStorage: ProductionMediaStorageStatus;
  documentAppendixStorage: DocumentAppendixStorageStatus;
  productionUploadEnabled: boolean;
  productionCustomerAutoSendEnabled: boolean;
  productionAssetRetentionDays: number;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  hasLineChannelAccessToken: boolean;
  hasLineChannelSecret: boolean;
  liffId: string;
  baseUrl: string;
  webhookUrl: string;
  liffEndpointUrl: string;
  aiImageEnabled: boolean;
  aiImageProvider: string;
  aiImageModel: string;
  aiImageApiKey: string;
  hasAiImageApiKey: boolean;
  updatedAt: string | null;
  diagnostics: SupabaseDiagnostics;
};

type SettingsFormMode = "general" | "ai";

type UploadFieldKind = "image" | "document" | "spreadsheet" | "mixed";

const emptyState: SettingsState = {
  businessName: "",
  businessPhone: "",
  businessEmail: "",
  paymentAccountName: "",
  paymentBankName: "",
  paymentAccountNumber: "",
  paymentPromptPayId: "",
  paymentQrCodeUrl: "",
  paymentQrCodeLabel: "",
  paymentDisplayMode: DEFAULT_PAYMENT_DISPLAY_MODE,
  paymentSecondaryAccountName: "",
  paymentSecondaryBankName: "",
  paymentSecondaryAccountNumber: "",
  paymentSecondaryPromptPayId: "",
  paymentSecondaryQrCodeUrl: "",
  paymentSecondaryQrCodeLabel: "",
  paymentSecondaryDisplayMode: DEFAULT_PAYMENT_DISPLAY_MODE,
  paymentSecondaryInstructions: "",
  paymentSecondaryMaxQuoteTotal: null,
  paymentSecondaryCustomerScope: "none",
  paymentSecondaryPaymentTermsScope: "none",
  paymentInstructions: "หลังโอนเงินแล้ว กรุณาส่งสลิปกลับใน LINE แชตนี้เพื่อให้ทีมงานยืนยันการชำระ",
  businessLogoUrl: "",
  businessCatalogUrl: "",
  businessCatalogName: "",
  documentAppendixImageUrl: "",
  documentAppendixImageName: "",
  customerUploadUrl: "",
  customerUploadLabel: "ส่งไฟล์งาน / รูปอ้างอิง",
  customerMediaStorage: {
    activeProvider: "supabase",
    r2Configured: false,
    requiredR2EnvKeys: [],
    missingR2EnvKeys: [],
    fallbackProvider: "supabase",
  },
  productionMediaStorage: {
    activeProvider: "supabase",
    bucket: "job-media",
    metadataTables: ["job_media_events", "job_media_assets"],
    uploadEnabled: true,
    customerSendEnabled: false,
    retentionDays: 30,
  },
  documentAppendixStorage: {
    activeProvider: "supabase",
    bucket: "app-assets",
    imageConfigured: false,
    imageName: "",
  },
  productionUploadEnabled: true,
  productionCustomerAutoSendEnabled: false,
  productionAssetRetentionDays: 30,
  lineChannelAccessToken: "",
  lineChannelSecret: "",
  hasLineChannelAccessToken: false,
  hasLineChannelSecret: false,
  liffId: "",
  baseUrl: "",
  webhookUrl: "",
  liffEndpointUrl: "",
  aiImageEnabled: false,
  aiImageProvider: "openai",
  aiImageModel: "gpt-image-1",
  aiImageApiKey: "",
  hasAiImageApiKey: false,
  updatedAt: null,
  diagnostics: {
    projectHost: "unknown",
    projectRef: null,
    appSettingsRowPresent: false,
    coreDataPresent: false,
    errorSummary: null,
    tables: [
      { key: "customers", label: "Customers", count: null, status: "error", errorMessage: null },
      { key: "leads", label: "Leads", count: null, status: "error", errorMessage: null },
      { key: "quotes", label: "Quotes", count: null, status: "error", errorMessage: null },
      { key: "jobs", label: "Jobs", count: null, status: "error", errorMessage: null },
      {
        key: "productCatalogItems",
        label: "Product Catalog",
        count: null,
        status: "error",
        errorMessage: null,
      },
    ],
  },
};

async function fetchSettingsState() {
  const res = await fetch("/api/settings", { cache: "no-store" });

  let data: { settings?: Partial<SettingsState>; error?: string } | null = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || "โหลดข้อมูลตั้งค่าไม่สำเร็จ");
  }

  return { ...emptyState, ...data?.settings } satisfies SettingsState;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function buildDerivedLineUrl(baseUrl: string, path: string) {
  return baseUrl ? `${baseUrl}${path}` : "";
}

function isHttpsUrl(value: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function getDiagnosticsBadgeVariant(status: SupabaseDiagnosticsTable["status"]) {
  switch (status) {
    case "populated":
      return "success" as const;
    case "empty":
      return "warning" as const;
    default:
      return "destructive" as const;
  }
}

function getDiagnosticsStatusLabel(status: SupabaseDiagnosticsTable["status"]) {
  switch (status) {
    case "populated":
      return "มีข้อมูล";
    case "empty":
      return "ยังว่าง";
    default:
      return "query ไม่ผ่าน";
  }
}

type UploadFieldProps = {
  accept: string;
  buttonLabel: string;
  formatLabel: string;
  emptyLabel: string;
  currentLabel?: string;
  helperText?: string;
  kind?: UploadFieldKind;
  openHref?: string;
  openLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onSelect: (file: File | null) => void;
};

const uploadFieldKindMeta: Record<
  UploadFieldKind,
  {
    label: string;
    icon: LucideIcon;
    badgeClassName: string;
    iconClassName: string;
    cardClassName: string;
    railClassName: string;
    hint: string;
  }
> = {
  image: {
    label: "ไฟล์ภาพ",
    icon: FileImage,
    badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    iconClassName:
      "bg-gradient-to-br from-fuchsia-500/15 via-white to-sky-500/15 text-fuchsia-700 ring-fuchsia-200/80",
    cardClassName: "bg-gradient-to-br from-fuchsia-50/90 via-white to-sky-50/80",
    railClassName: "from-fuchsia-400 via-sky-400 to-cyan-300",
    hint: "เหมาะกับ asset ที่ต้อง preview ทันที เช่น QR, โลโก้ หรือภาพแนบท้ายเอกสาร",
  },
  document: {
    label: "เอกสาร",
    icon: FileText,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName:
      "bg-gradient-to-br from-amber-500/15 via-white to-rose-500/10 text-amber-700 ring-amber-200/80",
    cardClassName: "bg-gradient-to-br from-amber-50/85 via-white to-rose-50/70",
    railClassName: "from-amber-400 via-orange-400 to-rose-300",
    hint: "ใช้กับ company profile หรือไฟล์อ้างอิงที่แอดมินต้องเปิดเช็กก่อนส่งต่อ",
  },
  spreadsheet: {
    label: "CSV Runtime",
    icon: FileSpreadsheet,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName:
      "bg-gradient-to-br from-emerald-500/15 via-white to-cyan-500/10 text-emerald-700 ring-emerald-200/80",
    cardClassName: "bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/80",
    railClassName: "from-emerald-400 via-cyan-400 to-sky-300",
    hint: "อัปโหลด CSV ชุดล่าสุดเพื่อรีเฟรช catalog runtime แบบ bulk import",
  },
  mixed: {
    label: "ไฟล์ทั่วไป",
    icon: CloudUpload,
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
    iconClassName:
      "bg-gradient-to-br from-slate-400/15 via-white to-blue-500/10 text-slate-700 ring-slate-200/80",
    cardClassName: "bg-gradient-to-br from-slate-50/90 via-white to-blue-50/70",
    railClassName: "from-slate-400 via-slate-300 to-blue-300",
    hint: "รองรับการลากไฟล์มาวางบนการ์ดนี้โดยตรง แล้วใช้ปุ่มเลือกจากเครื่องเป็น fallback",
  },
};

function UploadField({
  accept,
  buttonLabel,
  formatLabel,
  emptyLabel,
  currentLabel,
  helperText,
  kind = "mixed",
  openHref,
  openLabel,
  pending = false,
  pendingLabel,
  onSelect,
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const kindMeta = uploadFieldKindMeta[kind];
  const KindIcon = kindMeta.icon;
  const hasCurrentFile = Boolean(currentLabel || openHref);

  const statusLabel = pending
    ? pendingLabel || "กำลังอัปโหลด..."
    : isDragging
      ? "ปล่อยไฟล์เพื่ออัปโหลด"
      : hasCurrentFile
        ? "มีไฟล์พร้อมใช้งาน"
        : "พร้อมรับไฟล์";
  const StatusIcon = pending
    ? Upload
    : isDragging
      ? CloudUpload
      : hasCurrentFile
        ? CheckCircle2
        : CloudUpload;
  const statusBadgeVariant = pending || isDragging ? "info" : hasCurrentFile ? "success" : "outline";
  const summaryLabel = pending && selectedFileName
    ? `กำลังอัปโหลด ${selectedFileName}`
    : hasCurrentFile
      ? currentLabel || "มีไฟล์ปัจจุบันแล้ว"
      : selectedFileName
        ? `ไฟล์ล่าสุดที่เลือก: ${selectedFileName}`
        : emptyLabel;
  const statusDescription = pending
    ? "ระบบกำลังประมวลผลไฟล์นี้และจะอัปเดตสถานะให้ทันทีเมื่อเสร็จ"
    : isDragging
      ? "ปล่อยไฟล์บนการ์ดนี้เพื่อเริ่มอัปโหลดทันที"
      : hasCurrentFile
        ? "สามารถแทนที่ไฟล์เดิมได้ โดย flow หลังบ้านจะใช้ไฟล์ล่าสุดอัตโนมัติ"
        : "ลากไฟล์จากเครื่องมาวางบนการ์ดนี้ หรือกดปุ่มเพื่อเลือกไฟล์แบบเดิม";
  const detailLabel = !hasCurrentFile && selectedFileName
    ? `ไฟล์ล่าสุด: ${selectedFileName}`
    : `รองรับ ${formatLabel}`;
  const footerNote = pending
    ? "ระหว่างอัปโหลด ระบบจะล็อกการเลือกไฟล์ใหม่ชั่วคราวเพื่อกันสถานะสับสน"
    : openHref
      ? "เปิดไฟล์ปัจจุบันเพื่อตรวจสอบก่อนแทนที่ได้ทุกเวลา"
      : "ยังไม่มีไฟล์ในระบบสำหรับรายการนี้";

  function forwardSelection(file: File | null) {
    if (!file) {
      onSelect(null);
      return;
    }

    if (pending) {
      return;
    }

    setSelectedFileName(file.name);
    onSelect(file);
  }

  return (
    <Card
      size="sm"
      className={cn(
        "gap-0 overflow-hidden border py-0 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] transition-all duration-200",
        kindMeta.cardClassName,
        isDragging && "border-sky-300 shadow-[0_24px_60px_-32px_rgba(14,165,233,0.55)] ring-2 ring-sky-100/80",
        pending && "border-blue-200 shadow-[0_24px_60px_-32px_rgba(59,130,246,0.45)]",
        !pending && !isDragging && hasCurrentFile && "border-emerald-200"
      )}
    >
      <div className={cn("h-1.5 w-full bg-linear-to-r", kindMeta.railClassName)} />
      <CardContent className="px-5 py-5">
        <div
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!pending) {
              setIsDragging(true);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!pending) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();

            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
              return;
            }

            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
            forwardSelection(event.dataTransfer.files?.[0] || null);
            event.dataTransfer.clearData();
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            aria-label={buttonLabel}
            title={buttonLabel}
            className="sr-only"
            onChange={(event) => {
              forwardSelection(event.target.files?.[0] || null);
              event.currentTarget.value = "";
            }}
          />
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-[20px] ring-1 ring-inset shadow-sm transition-transform duration-200",
                kindMeta.iconClassName,
                isDragging && "scale-105 ring-sky-200",
                pending && "animate-pulse"
              )}
            >
              <KindIcon className="size-7" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant}>
                  <StatusIcon data-icon="inline-start" className={cn(pending && "animate-pulse")} />
                  {statusLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("border-white/80 bg-white/85", kindMeta.badgeClassName)}
                >
                  <KindIcon data-icon="inline-start" />
                  {kindMeta.label}
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-600">
                  {formatLabel}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="truncate text-sm font-semibold text-slate-950 sm:text-[15px]">
                  {summaryLabel}
                </p>
                <p className="text-xs leading-5 text-slate-600">{statusDescription}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1 font-medium text-slate-600">
                  {detailLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              className={cn(
                "h-10 rounded-full px-4 shadow-sm",
                isDragging ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-slate-950 text-white hover:bg-slate-800"
              )}
              onClick={() => inputRef.current?.click()}
            >
              <CloudUpload data-icon="inline-start" />
              {buttonLabel}
            </Button>
            {openHref ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-white/80 bg-white/85 px-4 text-slate-700 shadow-sm hover:bg-white"
                asChild
              >
                <a href={openHref} target="_blank" rel="noreferrer">
                  <Link2 data-icon="inline-start" />
                  {openLabel || "เปิดไฟล์"}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
      <Separator className="bg-slate-200/80" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs">
        <div className="space-y-1 text-slate-500">
          <p className="font-medium text-slate-700">{helperText || kindMeta.hint}</p>
          <p>{footerNote}</p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium",
            isDragging
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : pending
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : hasCurrentFile
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white/80 text-slate-600"
          )}
        >
          <CloudUpload className="size-3.5" />
          {isDragging
            ? "ปล่อยไฟล์ได้เลย"
            : pending
              ? "กำลังประมวลผล"
              : hasCurrentFile
                ? "มีไฟล์พร้อมใช้"
                : "พร้อม drag & drop"}
        </div>
      </div>
    </Card>
  );
}

export default function SettingsForm({
  mode = "general",
}: {
  mode?: SettingsFormMode;
}) {
  const [form, setForm] = useState<SettingsState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingDiagnostics, setRefreshingDiagnostics] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"" | SettingsAssetType>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [diagnosticsCheckedAt, setDiagnosticsCheckedAt] = useState<string | null>(null);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [catalogImportMessage, setCatalogImportMessage] = useState("");
  const [catalogImportError, setCatalogImportError] = useState("");
  const [catalogImportSummary, setCatalogImportSummary] =
    useState<ProductCatalogImportResult | null>(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const nextState = await fetchSettingsState();

        if (cancelled) {
          return;
        }

        setForm(nextState);
        setDiagnosticsCheckedAt(new Date().toISOString());
        setWarning("");
        setError("");
      } catch {
        if (cancelled) {
          return;
        }

        showError("โหลดข้อมูลตั้งค่าไม่สำเร็จ");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearFeedback() {
    setMessage("");
    setError("");
    setWarning("");
  }

  function showError(nextError: string) {
    setError(nextError);
    setMessage("");
    setWarning("");
  }

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    setError("");
    setWarning("");
  }

  function showWarning(nextWarning: string) {
    setWarning(nextWarning);
    setMessage("");
    setError("");
  }

  async function handleRefreshDiagnostics() {
    setRefreshingDiagnostics(true);
    setWarning("");
    setError("");

    try {
      const nextState = await fetchSettingsState();

      setForm((prev) => ({
        ...prev,
        diagnostics: nextState.diagnostics,
      }));
      setDiagnosticsCheckedAt(new Date().toISOString());
    } catch {
      showError("รีเฟรช diagnostics ไม่สำเร็จ");
    } finally {
      setRefreshingDiagnostics(false);
    }
  }

  async function handleAssetUpload(assetType: SettingsAssetType, file: File | null) {
    if (!file) return;

    setUploadingAsset(assetType);
    clearFeedback();

    try {
      const formData = new FormData();
      formData.append("assetType", assetType);
      formData.append("file", file);

      const res = await fetch("/api/settings/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
        return;
      }

      if (assetType === "logo") {
        setForm((prev) => ({ ...prev, businessLogoUrl: data.url }));
      }

      if (assetType === "catalog") {
        setForm((prev) => ({ ...prev, businessCatalogUrl: data.url, businessCatalogName: data.fileName }));
      }

      if (assetType === "paymentQr") {
        setForm((prev) => ({ ...prev, paymentQrCodeUrl: data.url }));
      }

      if (assetType === "paymentSecondaryQr") {
        setForm((prev) => ({ ...prev, paymentSecondaryQrCodeUrl: data.url }));
      }

      if (assetType === "documentAppendixImage") {
        setForm((prev) => ({
          ...prev,
          documentAppendixImageUrl: data.url,
          documentAppendixImageName: data.fileName,
          documentAppendixStorage: {
            ...prev.documentAppendixStorage,
            imageConfigured: true,
            imageName: data.fileName,
          },
        }));
      }

      showMessage("อัปโหลดไฟล์เรียบร้อยแล้ว");
    } catch {
      showError("อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploadingAsset("");
    }
  }

  function handleAiImageProviderChange(provider: string) {
    updateField("aiImageProvider", provider);

    const providerDefaultModel = provider === "google" ? "imagen-3.0-generate-002" : "gpt-image-1";
    const knownDefaultModels = new Set(["gpt-image-1", "imagen-3.0-generate-002"]);
    if (!form.aiImageModel || knownDefaultModels.has(form.aiImageModel)) {
      updateField("aiImageModel", providerDefaultModel);
    }
  }

  async function copySettingValue(value: string, label: string) {
    if (!value) {
      showError(`ยังไม่มีค่า ${label} ให้คัดลอก`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showMessage(`คัดลอก ${label} แล้ว`);
    } catch {
      showError(`คัดลอก ${label} ไม่สำเร็จ`);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    clearFeedback();

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }

      const saveResult = data as { success: true; warning?: string; droppedGroups?: string[] };
      const schemaFallbackMessage =
        saveResult.warning === "SCHEMA_FALLBACK_OCCURRED"
          ? `บันทึกบางส่วนไม่ครบ: DB ขาด columns สำหรับ ${saveResult.droppedGroups?.join(", ") ?? "payment"} — ตรวจสอบ migration`
          : "";

      setForm((prev) => {
        const normalizedBaseUrl = normalizeBaseUrl(prev.baseUrl || "");

        return {
          ...prev,
          webhookUrl: buildDerivedLineUrl(normalizedBaseUrl, "/api/webhook"),
          liffEndpointUrl: buildDerivedLineUrl(normalizedBaseUrl, "/liff"),
          updatedAt: new Date().toISOString(),
          hasAiImageApiKey: prev.hasAiImageApiKey || Boolean(prev.aiImageApiKey),
          hasLineChannelAccessToken:
            prev.hasLineChannelAccessToken || Boolean(prev.lineChannelAccessToken.trim()),
          hasLineChannelSecret:
            prev.hasLineChannelSecret || Boolean(prev.lineChannelSecret.trim()),
          aiImageApiKey: "",
          lineChannelAccessToken: "",
          lineChannelSecret: "",
        };
      });

      try {
        const refreshed = await fetchSettingsState();
        setForm({
          ...refreshed,
          aiImageApiKey: "",
          lineChannelAccessToken: "",
          lineChannelSecret: "",
        });

        if (schemaFallbackMessage) {
          showWarning(schemaFallbackMessage);
        } else {
          showMessage("บันทึกการตั้งค่าเรียบร้อยแล้ว");
        }
      } catch {
        if (schemaFallbackMessage) {
          showWarning(`${schemaFallbackMessage} และรีเฟรชค่าล่าสุดไม่สำเร็จ`);
        } else {
          showWarning("บันทึกการตั้งค่าแล้ว แต่รีเฟรชค่าล่าสุดไม่สำเร็จ");
        }
      }
    } catch {
      showError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleProductCatalogImport(file: File | null) {
    if (!file) {
      return;
    }

    setImportingCatalog(true);
    setCatalogImportMessage("");
    setCatalogImportError("");
    setCatalogImportSummary(null);
    setWarning("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/product-catalog/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        const detailMessage = Array.isArray(data.details) && data.details.length > 0
          ? `: ${data.details.slice(0, 3).join(" | ")}`
          : "";
        setCatalogImportError(
          `${data.error || "นำเข้า product catalog ไม่สำเร็จ"}${detailMessage}`
        );
        return;
      }

      setCatalogImportSummary({
        importedCount: Number(data.importedCount) || 0,
        insertedCount: Number(data.insertedCount) || 0,
        updatedCount: Number(data.updatedCount) || 0,
        activeCount: Number(data.activeCount) || 0,
        generatedValueCount: Number(data.generatedValueCount) || 0,
      });
      setCatalogReloadKey((prev) => prev + 1);
      setCatalogImportMessage(
        `นำเข้า catalog สำเร็จ ${Number(data.importedCount) || 0} รายการ`
      );
    } catch {
      setCatalogImportError("นำเข้า product catalog ไม่สำเร็จ");
    } finally {
      setImportingCatalog(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">กำลังโหลดการตั้งค่า...</div>;
  }

  const normalizedBaseUrl = normalizeBaseUrl(form.baseUrl || "");
  const webhookUrl = buildDerivedLineUrl(normalizedBaseUrl, "/api/webhook");
  const liffEndpointUrl = buildDerivedLineUrl(normalizedBaseUrl, "/liff");
  const hasCurrentLineChannelSecret =
    form.hasLineChannelSecret || Boolean(form.lineChannelSecret.trim());
  const hasCurrentLineChannelAccessToken =
    form.hasLineChannelAccessToken || Boolean(form.lineChannelAccessToken.trim());
  const hasCurrentLiffId = Boolean(form.liffId.trim());
  const lineWebhookUrlReady = isHttpsUrl(webhookUrl);
  const lineLiffUrlReady = isHttpsUrl(liffEndpointUrl);
  const lineReceiveReady = hasCurrentLineChannelSecret && lineWebhookUrlReady;
  const lineSendReady = hasCurrentLineChannelAccessToken;
  const liffReady = hasCurrentLiffId && lineLiffUrlReady;
  const lineConnectionReady = lineReceiveReady && lineSendReady && liffReady;
  const generalDefaultTab = lineConnectionReady ? "business" : "line";
  const productCatalogDiagnostics =
    form.diagnostics.tables.find((table) => table.key === "productCatalogItems") || null;
  const workflowDiagnostics = form.diagnostics.tables.filter(
    (table) => table.key !== "productCatalogItems"
  );
  const populatedWorkflowTables = workflowDiagnostics.filter(
    (table) => table.status === "populated"
  ).length;
  const totalWorkflowRows = workflowDiagnostics.reduce(
    (total, table) => total + (typeof table.count === "number" ? table.count : 0),
    0
  );

  const LineStatusIcon = lineConnectionReady ? CheckCircle2 : TriangleAlert;
  const lineStatusCards: Array<{
    title: string;
    description: string;
    ready: boolean;
    readyLabel: string;
    missingLabel: string;
    icon: LucideIcon;
  }> = [
    {
      title: "รับข้อความจาก LINE OA",
      description: "ใช้ Webhook URL และ Channel Secret เพื่อ verify event ที่เข้าระบบ",
      ready: lineReceiveReady,
      readyLabel: "พร้อมรับ webhook",
      missingLabel: !hasCurrentLineChannelSecret
        ? "ยังขาด Channel Secret"
        : lineWebhookUrlReady
          ? "รอเปิดใช้ webhook"
          : "Base URL ต้องเป็น HTTPS",
      icon: MessageCircle,
    },
    {
      title: "ส่งข้อความกลับลูกค้า",
      description: "ใช้ Channel Access Token สำหรับส่ง quote, payment, status และ proof กลับเข้า LINE",
      ready: lineSendReady,
      readyLabel: "พร้อมส่งข้อความ",
      missingLabel: "ยังขาด Access Token",
      icon: KeyRound,
    },
    {
      title: "เปิดฟอร์ม LINE MINI App",
      description: "ใช้ LIFF ID และ endpoint `/liff` เพื่อเปิด intake form ใน LINE browser",
      ready: liffReady,
      readyLabel: "พร้อมเปิด LIFF",
      missingLabel: !hasCurrentLiffId
        ? "ยังขาด LIFF ID"
        : lineLiffUrlReady
          ? "รอผูก LIFF endpoint"
          : "Base URL ต้องเป็น HTTPS",
      icon: Smartphone,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {mode !== "ai" ? (
        <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-950">ตั้งค่าระบบหลัก</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              แยกเป็นแท็บตามงานจริงของแอดมินเพื่อลดการเลื่อนยาว แต่ยังใช้การบันทึกชุดเดียวเหมือนเดิม
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={lineConnectionReady ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800" : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800"}>
              LINE: {lineConnectionReady ? "พร้อมใช้งาน" : "ยังไม่ครบ"}
            </span>
            <span className={form.customerMediaStorage.r2Configured ? "rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800" : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"}>
              Upload: {form.customerMediaStorage.activeProvider === "r2" ? "Cloudflare R2" : "Supabase fallback"}
            </span>
            <span className={form.productionUploadEnabled ? "rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-800" : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"}>
              Production: {form.productionUploadEnabled ? "เปิดอยู่" : "ปิดอยู่"}
            </span>
          </div>
        </div>
      </section>

      <Tabs defaultValue={generalDefaultTab} className="gap-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-full justify-start rounded-[28px] bg-slate-100/80 p-1.5">
            <TabsTrigger value="business" className="min-w-fit gap-2 px-4 py-2.5 data-active:bg-white data-active:shadow-sm">
              <Building2 className="size-4" />
              ธุรกิจ & ชำระเงิน
            </TabsTrigger>
            <TabsTrigger value="line" className="min-w-fit gap-2 px-4 py-2.5 data-active:bg-white data-active:shadow-sm">
              <Smartphone className="size-4" />
              LINE / LIFF
            </TabsTrigger>
            <TabsTrigger value="catalog" className="min-w-fit gap-2 px-4 py-2.5 data-active:bg-white data-active:shadow-sm">
              <PackageSearch className="size-4" />
              Catalog
            </TabsTrigger>
            <TabsTrigger value="production" className="min-w-fit gap-2 px-4 py-2.5 data-active:bg-white data-active:shadow-sm">
              <Upload className="size-4" />
              Production
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="min-w-fit gap-2 px-4 py-2.5 data-active:bg-white data-active:shadow-sm">
              <ShieldCheck className="size-4" />
              Diagnostics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="business" className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">ข้อมูลองค์กร</h2>
        <p className="mt-1 text-sm text-slate-500">ข้อมูลส่วนนี้ใช้สำหรับแสดงผลในเอกสารและหน้าลูกค้า</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ชื่อร้าน / บริษัท</span>
            <input value={form.businessName} onChange={(e) => updateField("businessName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="FOGUS Print & Sign" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เบอร์โทรร้าน</span>
            <input value={form.businessPhone} onChange={(e) => updateField("businessPhone", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="02-xxx-xxxx" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>อีเมลร้าน</span>
            <input value={form.businessEmail} onChange={(e) => updateField("businessEmail", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="contact@example.com" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ธนาคารรับโอน</span>
            <input value={form.paymentBankName} onChange={(e) => updateField("paymentBankName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น กสิกรไทย" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>ชื่อบัญชี</span>
            <input value={form.paymentAccountName} onChange={(e) => updateField("paymentAccountName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ชื่อบัญชีรับเงิน" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เลขบัญชี</span>
            <input value={form.paymentAccountNumber} onChange={(e) => updateField("paymentAccountNumber", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="xxx-x-xxxxx-x" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>พร้อมเพย์ / PromptPay</span>
            <input value={form.paymentPromptPayId} onChange={(e) => updateField("paymentPromptPayId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เบอร์โทรหรือเลข PromptPay" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>รูปแบบแสดงช่องทางชำระเงิน</span>
            <select
              value={form.paymentDisplayMode}
              onChange={(e) => updateField("paymentDisplayMode", e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
            >
              {PAYMENT_DISPLAY_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PAYMENT_DISPLAY_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ข้อความใต้ QR Code</span>
            <input value={form.paymentQrCodeLabel} onChange={(e) => updateField("paymentQrCodeLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น สแกนเพื่อโอนเข้าบัญชีบริษัท หรือ PromptPay ร้าน" />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>คำแนะนำการชำระเงินสำหรับลูกค้า</span>
            <textarea value={form.paymentInstructions} onChange={(e) => updateField("paymentInstructions", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น หลังโอนแล้วส่งสลิปกลับมาใน LINE แชตนี้" />
            <p className="text-xs text-slate-500">ข้อมูลชุดนี้จะไปแสดงในหน้าใบเสนอราคาและหน้าเอกสารดาวน์โหลดของลูกค้า</p>
          </label>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>QR Code สำหรับชำระเงิน</span>
            <UploadField
              accept="image/png,image/jpeg,image/webp"
              buttonLabel="อัปโหลด QR Code"
              formatLabel="PNG, JPG, WEBP"
              emptyLabel="ยังไม่มี QR Code สำหรับช่องทางชำระเงิน"
              currentLabel={form.paymentQrCodeUrl ? "มี QR Code สำหรับชำระเงินปัจจุบันแล้ว" : undefined}
              kind="image"
              openHref={form.paymentQrCodeUrl || undefined}
              openLabel="เปิด QR Code"
              pending={uploadingAsset === "paymentQr"}
              onSelect={(file) => {
                void handleAssetUpload("paymentQr", file);
              }}
            />
            {form.paymentQrCodeUrl ? (
              <Image
                src={form.paymentQrCodeUrl}
                alt="Payment QR Code"
                width={192}
                height={192}
                unoptimized
                className="mt-2 h-40 w-40 rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
            ) : null}
            <p className="text-xs text-slate-500">ถ้าเลือกโหมด QR only แต่ยังไม่มี QR ระบบจะ fallback ไปใช้เลขบัญชีหรือ PromptPay ที่ตั้งไว้เพื่อไม่ให้ flow สะดุด</p>
          </div>
          <div className="md:col-span-2 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-slate-900">บัญชีรอง / Auto-routing profile</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  ใช้สำหรับกรณีที่ระบบต้องเลือกช่องทางรับเงินอีกชุดโดยอัตโนมัติตามยอด quote หรือ payment term ที่ลูกค้าเลือกตั้งแต่ตอน intake
                </p>
              </div>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ธนาคารบัญชีรอง</span>
                <input value={form.paymentSecondaryBankName} onChange={(e) => updateField("paymentSecondaryBankName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น ธนาคารกรุงเทพ" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ชื่อบัญชีรอง</span>
                <input value={form.paymentSecondaryAccountName} onChange={(e) => updateField("paymentSecondaryAccountName", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ชื่อบัญชีอีกบริษัท / บัญชีรอง" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>เลขบัญชีรอง</span>
                <input value={form.paymentSecondaryAccountNumber} onChange={(e) => updateField("paymentSecondaryAccountNumber", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="xxx-x-xxxxx-x" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>PromptPay บัญชีรอง</span>
                <input value={form.paymentSecondaryPromptPayId} onChange={(e) => updateField("paymentSecondaryPromptPayId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เบอร์หรือเลข PromptPay สำรอง" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>รูปแบบแสดงบัญชีรอง</span>
                <select
                  value={form.paymentSecondaryDisplayMode}
                  onChange={(e) => updateField("paymentSecondaryDisplayMode", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_DISPLAY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {PAYMENT_DISPLAY_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองเมื่อยอด quote ไม่เกิน</span>
                <input
                  type="number"
                  min={0}
                  value={form.paymentSecondaryMaxQuoteTotal ?? ""}
                  onChange={(e) =>
                    updateField(
                      "paymentSecondaryMaxQuoteTotal",
                      e.target.value ? Number.parseFloat(e.target.value) : null
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                  placeholder="เช่น 300"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองตาม payment term ที่ลูกค้าเลือก</span>
                <select
                  value={form.paymentSecondaryPaymentTermsScope}
                  onChange={(e) => updateField("paymentSecondaryPaymentTermsScope", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_ROUTING_TERM_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {PAYMENT_ROUTING_TERM_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ใช้บัญชีรองตามประเภทลูกค้า</span>
                <select
                  value={form.paymentSecondaryCustomerScope}
                  onChange={(e) => updateField("paymentSecondaryCustomerScope", e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  {PAYMENT_ROUTING_CUSTOMER_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {PAYMENT_ROUTING_CUSTOMER_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>คำแนะนำการชำระเงินของบัญชีรอง</span>
                <textarea value={form.paymentSecondaryInstructions} onChange={(e) => updateField("paymentSecondaryInstructions", e.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น งานมูลค่าน้อยหรือ credit ให้ใช้บัญชีนี้และแนบหลักฐานตามขั้นตอนนี้" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>ข้อความใต้ QR Code ของบัญชีรอง</span>
                <input value={form.paymentSecondaryQrCodeLabel} onChange={(e) => updateField("paymentSecondaryQrCodeLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น สแกนเพื่อโอนเข้าบัญชีรอง" />
              </label>
              <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>QR Code ของบัญชีรอง</span>
                <UploadField
                  accept="image/png,image/jpeg,image/webp"
                  buttonLabel="อัปโหลด QR บัญชีรอง"
                  formatLabel="PNG, JPG, WEBP"
                  emptyLabel="ยังไม่มี QR Code ของบัญชีรอง"
                  currentLabel={form.paymentSecondaryQrCodeUrl ? "มี QR Code ของบัญชีรองปัจจุบันแล้ว" : undefined}
                  kind="image"
                  openHref={form.paymentSecondaryQrCodeUrl || undefined}
                  openLabel="เปิด QR บัญชีรอง"
                  pending={uploadingAsset === "paymentSecondaryQr"}
                  onSelect={(file) => {
                    void handleAssetUpload("paymentSecondaryQr", file);
                  }}
                />
                {form.paymentSecondaryQrCodeUrl ? (
                  <Image
                    src={form.paymentSecondaryQrCodeUrl}
                    alt="Secondary Payment QR Code"
                    width={192}
                    height={192}
                    unoptimized
                    className="mt-2 h-40 w-40 rounded-2xl border border-slate-200 bg-white object-contain p-2"
                  />
                ) : null}
                <p className="text-xs text-slate-500">
                  ระบบจะเลือกบัญชีรองอัตโนมัติเมื่อเข้าเงื่อนไขข้อใดข้อหนึ่งที่ตั้งไว้ และถ้าบัญชีรองยังไม่ครบ ระบบจะถอยกลับไปใช้บัญชีหลักโดยอัตโนมัติเพื่อไม่ให้ quote พัง
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <PaymentRoutingPreview
              config={{
                paymentAccountName: form.paymentAccountName,
                paymentBankName: form.paymentBankName,
                paymentAccountNumber: form.paymentAccountNumber,
                paymentPromptPayId: form.paymentPromptPayId,
                paymentQrCodeUrl: form.paymentQrCodeUrl,
                paymentSecondaryAccountName: form.paymentSecondaryAccountName,
                paymentSecondaryBankName: form.paymentSecondaryBankName,
                paymentSecondaryAccountNumber: form.paymentSecondaryAccountNumber,
                paymentSecondaryPromptPayId: form.paymentSecondaryPromptPayId,
                paymentSecondaryQrCodeUrl: form.paymentSecondaryQrCodeUrl,
                paymentSecondaryMaxQuoteTotal: form.paymentSecondaryMaxQuoteTotal ?? null,
                paymentSecondaryCustomerScope: form.paymentSecondaryCustomerScope,
                paymentSecondaryPaymentTermsScope: form.paymentSecondaryPaymentTermsScope,
              }}
            />
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>โลโก้ร้าน</span>
            <UploadField
              accept="image/png,image/jpeg,image/webp"
              buttonLabel="อัปโหลดโลโก้ร้าน"
              formatLabel="PNG, JPG, WEBP"
              emptyLabel="ยังไม่มีโลโก้ร้าน"
              currentLabel={form.businessLogoUrl ? "มีโลโก้ร้านปัจจุบันแล้ว" : undefined}
              kind="image"
              openHref={form.businessLogoUrl || undefined}
              openLabel="เปิดโลโก้"
              pending={uploadingAsset === "logo"}
              onSelect={(file) => {
                void handleAssetUpload("logo", file);
              }}
            />
            {form.businessLogoUrl ? (
              <Image
                src={form.businessLogoUrl}
                alt="Business logo"
                width={256}
                height={64}
                unoptimized
                className="mt-2 h-16 w-auto rounded-2xl border border-slate-200 bg-slate-50 p-2"
              />
            ) : null}
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ไฟล์ร้าน / Company Profile</span>
            <UploadField
              accept="application/pdf,image/png,image/jpeg"
              buttonLabel="อัปโหลดไฟล์ร้าน"
              formatLabel="PDF, PNG, JPG"
              emptyLabel="ยังไม่มีไฟล์ร้านหรือ Company Profile"
              currentLabel={form.businessCatalogName ? `ไฟล์ล่าสุด: ${form.businessCatalogName}` : form.businessCatalogUrl ? "มีไฟล์ร้านปัจจุบันแล้ว" : undefined}
              kind="document"
              openHref={form.businessCatalogUrl || undefined}
              openLabel="เปิดไฟล์ร้าน"
              pending={uploadingAsset === "catalog"}
              onSelect={(file) => {
                void handleAssetUpload("catalog", file);
              }}
            />
            {form.businessCatalogName ? <p className="text-xs text-slate-500">ไฟล์ล่าสุด: {form.businessCatalogName}</p> : null}
          </div>
          <div className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>รูปแนบท้ายเอกสารการค้า</span>
            <UploadField
              accept="image/png,image/jpeg,image/webp"
              buttonLabel="อัปโหลดรูปแนบท้าย"
              formatLabel="PNG, JPG, WEBP"
              emptyLabel="ยังไม่มีรูปแนบท้ายเอกสาร"
              currentLabel={form.documentAppendixImageName ? `ไฟล์ล่าสุด: ${form.documentAppendixImageName}` : form.documentAppendixImageUrl ? "มีรูปแนบท้ายเอกสารปัจจุบันแล้ว" : undefined}
              kind="image"
              openHref={form.documentAppendixImageUrl || undefined}
              openLabel="เปิดรูปแนบท้าย"
              pending={uploadingAsset === "documentAppendixImage"}
              onSelect={(file) => {
                void handleAssetUpload("documentAppendixImage", file);
              }}
            />
            {form.documentAppendixImageUrl ? (
              <Image
                src={form.documentAppendixImageUrl}
                alt="Document appendix image"
                width={360}
                height={240}
                unoptimized
                className="mt-2 h-44 w-full max-w-sm rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
            ) : null}
            {form.documentAppendixImageName ? <p className="text-xs text-slate-500">ไฟล์ล่าสุด: {form.documentAppendixImageName}</p> : null}
            <p className="text-xs text-slate-500">เอกสารการค้าที่ issue หลังจากตั้งค่านี้จะล็อกรูปนี้ไว้ใน snapshot และพิมพ์เป็นหน้าท้ายของใบวางบิล/ใบเสร็จ/ใบกำกับภาษี</p>
          </div>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ลิงก์รับไฟล์จากลูกค้า</span>
            <input value={form.customerUploadUrl} onChange={(e) => updateField("customerUploadUrl", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="https://drive.google.com/... หรือ Dropbox/OneDrive file request" />
            <p className="text-xs text-slate-500">แนะนำสำหรับทางลัดตอนนี้: ใช้ลิงก์ Google Drive, Google Form, Dropbox File Request หรือ OneDrive upload link</p>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>ข้อความปุ่มลิงก์รับไฟล์</span>
            <input value={form.customerUploadLabel} onChange={(e) => updateField("customerUploadLabel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="ส่งไฟล์งาน / รูปอ้างอิง" />
          </label>
          <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-4 md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">คลังไฟล์ของระบบ</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  แยกให้เห็นชัดระหว่างไฟล์ลูกค้า, ไฟล์พนักงานสำหรับยืนยันงาน, และรูปแนบท้ายเอกสาร
                </p>
              </div>
              <span className={form.customerMediaStorage.r2Configured ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"}>
                ไฟล์ลูกค้า: {form.customerMediaStorage.activeProvider === "r2" ? "Cloudflare R2" : "Supabase Storage"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">ลูกค้าอัปโหลดจาก LIFF</p>
                <p>metadata: lead_media_assets</p>
                <p>bucket/provider: {form.customerMediaStorage.activeProvider === "r2" ? "Cloudflare R2 customer-media" : "Supabase customer-media"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">พนักงานยืนยันงานกับลูกค้า</p>
                <p>metadata: {form.productionMediaStorage.metadataTables.join(" + ")}</p>
                <p>bucket/provider: Supabase {form.productionMediaStorage.bucket}</p>
                <p>review/send: {form.productionUploadEnabled ? "เปิดใช้" : "ปิดอยู่"} / {form.productionCustomerAutoSendEnabled ? "ส่งอัตโนมัติ" : "แอดมินกดส่ง"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-950">รูปแนบท้ายเอกสาร</p>
                <p>bucket/provider: Supabase {form.documentAppendixStorage.bucket}</p>
                <p>สถานะ: {form.documentAppendixStorage.imageConfigured ? "มีรูปแล้ว" : "ยังไม่มีรูป"}</p>
                <p>เอกสารใหม่จะล็อกรูปลง snapshot ตอน issue</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {form.customerMediaStorage.requiredR2EnvKeys.map((key) => {
                const missing = form.customerMediaStorage.missingR2EnvKeys.includes(key);

                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 text-xs">
                    <span className="font-mono text-slate-600">{key}</span>
                    <span className={missing ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                      {missing ? "ยังขาด" : "พร้อม"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              R2 key เป็น server-only และแก้ที่ Vercel Environment Variables เท่านั้น ถ้า key ครบ ระบบจะใช้ R2 อัตโนมัติ ถ้าไม่ครบจะ fallback ไป Supabase Storage โดยไม่ทำให้ลูกค้าส่งฟอร์มเสีย
            </p>
          </div>
        </div>
      </section>

        </TabsContent>

        <TabsContent value="line" className="space-y-6">

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">LINE OA และ LINE MINI App</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              หน้านี้บอกทีมว่า LINE ใช้งานพร้อมหรือยัง: รับข้อความจาก OA, ส่งข้อความกลับลูกค้า, และเปิดฟอร์ม LIFF
            </p>
          </div>
          <span className={lineConnectionReady ? "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800" : "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"}>
            <LineStatusIcon className="size-4" />
            {lineConnectionReady ? "พร้อมใช้งานครบ" : "ยังต้องตั้งค่าเพิ่ม"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {lineStatusCards.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <span className={item.ready ? "rounded-2xl bg-emerald-100 p-2 text-emerald-700" : "rounded-2xl bg-amber-100 p-2 text-amber-700"}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                  </div>
                </div>
                <p className={item.ready ? "mt-3 text-xs font-semibold text-emerald-700" : "mt-3 text-xs font-semibold text-amber-700"}>
                  {item.ready ? item.readyLabel : item.missingLabel}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Base URL ของระบบ</span>
            <input value={form.baseUrl} onChange={(e) => updateField("baseUrl", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="https://your-app.vercel.app" />
            <p className="text-xs leading-5 text-slate-500">ใช้สร้าง Webhook URL และ LIFF endpoint ที่ต้องนำไปวางใน LINE Developers Console</p>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>LIFF ID / MINI App ID</span>
            <input value={form.liffId} onChange={(e) => updateField("liffId", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder="เช่น 2000000000-xxxxxxx" />
            <p className="text-xs leading-5 text-slate-500">ค่าจาก LINE Login channel ที่ผูกกับ LINE MINI App / LIFF</p>
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-slate-900 p-2 text-white">
              <Link2 className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">ค่าที่ทีมต้องนำไปตั้งใน LINE Developers Console</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Webhook ต้องเป็น `/api/webhook` และ LIFF endpoint ต้องเป็น `/liff` เท่านั้น ไม่ใช้ `/liff/intake`
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm text-slate-700">
              <span>Webhook URL</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={webhookUrl} readOnly className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700" />
                <button type="button" onClick={() => void copySettingValue(webhookUrl, "Webhook URL")} title="คัดลอก Webhook URL" aria-label="คัดลอก Webhook URL" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Clipboard className="size-4" />
                  คัดลอก
                </button>
              </div>
            </label>
            <label className="grid gap-2 text-sm text-slate-700">
              <span>LINE MINI App / LIFF Endpoint URL</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={liffEndpointUrl} readOnly className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700" />
                <button type="button" onClick={() => void copySettingValue(liffEndpointUrl, "LIFF Endpoint URL")} title="คัดลอก LIFF Endpoint URL" aria-label="คัดลอก LIFF Endpoint URL" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Clipboard className="size-4" />
                  คัดลอก
                </button>
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p className="rounded-2xl border border-white bg-white px-4 py-3">1. Messaging API: วาง Webhook URL แล้วกด Verify</p>
            <p className="rounded-2xl border border-white bg-white px-4 py-3">2. Messaging API: เปิด `Use webhook` เป็น Enabled</p>
            <p className="rounded-2xl border border-white bg-white px-4 py-3">3. LINE MINI App / LIFF: ตั้ง Endpoint URL เป็น `/liff`</p>
            <p className="rounded-2xl border border-white bg-white px-4 py-3">4. ทดสอบจาก LINE OA จริง ไม่ใช้ desktop browser เป็นหลักฐานเดียว</p>
          </div>
        </div>

        <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold text-slate-900">
            <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <ShieldCheck className="size-4" />
            </span>
            Advanced: LINE Developer credentials
          </summary>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm text-slate-700">
              <span>LINE Channel Access Token</span>
              <textarea
                value={form.lineChannelAccessToken}
                onChange={(e) => updateField("lineChannelAccessToken", e.target.value)}
                rows={3}
                className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                placeholder={form.hasLineChannelAccessToken ? "มี token ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "ใส่ค่าจาก Messaging API"}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-slate-500">
                {form.hasLineChannelAccessToken
                  ? "ระบบมี token อยู่แล้ว ถ้าปล่อยว่างจะเก็บค่าปัจจุบันไว้ และจะไม่ preload กลับมาในเบราว์เซอร์"
                  : "ค่านี้จะไม่ถูก preload กลับมาในเบราว์เซอร์เพื่อความปลอดภัย"}
              </p>
            </label>
            <label className="grid gap-2 text-sm text-slate-700">
              <span>LINE Channel Secret</span>
              <input
                type="password"
                value={form.lineChannelSecret}
                onChange={(e) => updateField("lineChannelSecret", e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                placeholder={form.hasLineChannelSecret ? "มี secret ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "ใส่ค่าจาก Messaging API"}
                autoComplete="new-password"
                spellCheck={false}
              />
              <p className="text-xs text-slate-500">
                {form.hasLineChannelSecret
                  ? "ระบบมี secret อยู่แล้ว ถ้าปล่อยว่างจะเก็บค่าปัจจุบันไว้ และจะไม่ preload กลับมาในเบราว์เซอร์"
                  : "ค่านี้จะไม่ถูก preload กลับมาในเบราว์เซอร์เพื่อความปลอดภัย"}
              </p>
            </label>
          </div>
        </details>
      </section>

        </TabsContent>

        <TabsContent value="catalog" className="space-y-6">

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Product Catalog Runtime</h2>
        <p className="mt-1 text-sm text-slate-500">
          ใช้ CSV ชุดเดียวสำหรับ bulk import รายการสินค้าเข้าระบบ เพื่อให้ LIFF intake และ quote flow ใช้ catalog runtime
          ได้โดยไม่ต้องให้ผู้ใช้มานั่งกรอกสินค้าเป็นร้อยหรือเป็นพันรายการเอง
        </p>

        <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-900">CSV import สำหรับสินค้า</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                รองรับคอลัมน์ `value`, `label`, `category`, `category_label`, `description`, `keywords`,
                `per_sqm`, `min_charge`, `active`, `sort_order` และถ้าไม่ใส่ `value` ระบบจะ generate slug ให้เอง
              </p>
            </div>

            <a
              href="/templates/product-catalog-template.csv"
              download
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ดาวน์โหลด template CSV
            </a>
          </div>

          <div className="mt-4">
            <UploadField
              accept=".csv,text/csv"
              buttonLabel="อัปโหลด CSV"
              formatLabel="CSV"
              emptyLabel="เลือกไฟล์ CSV เพื่อ bulk import รายการสินค้า"
              currentLabel={catalogImportSummary ? `นำเข้าล่าสุด ${catalogImportSummary.importedCount} รายการ` : undefined}
              helperText="เลือกไฟล์ล่าสุด แล้วระบบจะเริ่ม import ทันที"
              kind="spreadsheet"
              pending={importingCatalog}
              pendingLabel="กำลังนำเข้า CSV..."
              onSelect={(file) => {
                void handleProductCatalogImport(file);
              }}
            />
          </div>

          {catalogImportMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {catalogImportMessage}
            </div>
          ) : null}

          {catalogImportError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {catalogImportError}
            </div>
          ) : null}

          {catalogImportSummary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Imported</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.importedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inserted</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.insertedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.updatedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.activeCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Generated Keys</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{catalogImportSummary.generatedValueCount}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-1 text-xs leading-5 text-slate-500">
            <p>1. ดาวน์โหลด template แล้วเติมรายการสินค้าเป็นชุด</p>
            <p>2. import ผ่านกล่องนี้จากหลังบ้าน</p>
            <p>3. LIFF intake จะอ่าน catalog runtime ชุดล่าสุดโดยอัตโนมัติ ถ้า database ยังว่างระบบจะ fallback ไป catalog มาตรฐาน</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">รายการสินค้าในระบบ (แก้ราคารายตัวได้)</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            ปรับ <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">ราคา/ตร.ม.</code> หรือ
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">ขั้นต่ำ</code>
            แล้วกดบันทึกที่ปลายแถว — ระบบจะใช้ราคาใหม่ทันทีโดยไม่ต้อง re-upload CSV
          </p>
          <CatalogItemsTable reloadKey={catalogReloadKey} />
        </div>
      </section>

        </TabsContent>

        <TabsContent value="production" className="space-y-6">

          <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Production Upload</h2>
            <p className="mt-1 text-sm text-slate-600">
              ตั้งค่า flow สำหรับลิงก์รายงานงานจากทีมผลิตและคิวตรวจรูปก่อนส่งให้ลูกค้า
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-700">
                <span>เปิดใช้งาน production upload</span>
                <select
                  value={form.productionUploadEnabled ? "enabled" : "disabled"}
                  onChange={(e) =>
                    updateField("productionUploadEnabled", e.target.value === "enabled")
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  <option value="enabled">เปิด</option>
                  <option value="disabled">ปิด</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>ส่งหลักฐานถึงลูกค้าอัตโนมัติหลัง approve</span>
                <select
                  value={form.productionCustomerAutoSendEnabled ? "enabled" : "disabled"}
                  onChange={(e) =>
                    updateField(
                      "productionCustomerAutoSendEnabled",
                      e.target.value === "enabled"
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                >
                  <option value="disabled">ปิด</option>
                  <option value="enabled">เปิด</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
                <span>อายุไฟล์หลักฐานก่อน cleanup อัตโนมัติ (วัน)</span>
                <input
                  type="number"
                  min={1}
                  value={form.productionAssetRetentionDays}
                  onChange={(e) =>
                    updateField(
                      "productionAssetRetentionDays",
                      Number.parseInt(e.target.value || "30", 10)
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400"
                />
                <p className="text-xs text-slate-500">
                  metadata จะยังอยู่เพื่อ audit แต่ไฟล์จริงใน private bucket จะถูก cleanup ตามค่านี้
                </p>
              </label>
            </div>
          </section>

        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <section className="rounded-3xl border border-cyan-200 bg-cyan-50/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  Supabase Diagnostics
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">
                  local ตอนนี้กำลังอ่านฐานไหน
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  ใช้เทียบกับ production ว่า project host ตรงกันไหม และตารางหลักมีข้อมูลจริงในฐานนี้แล้วหรือยัง
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {diagnosticsCheckedAt
                    ? `ตรวจล่าสุด ${formatBangkokDateTime(diagnosticsCheckedAt)}`
                    : "ยังไม่ได้ตรวจ diagnostics ใน session นี้"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <Badge variant={form.diagnostics.coreDataPresent ? "success" : "warning"}>
                  {form.diagnostics.coreDataPresent ? "พบ workflow data" : "workflow data ยังว่าง"}
                </Badge>
                <Badge
                  variant={form.diagnostics.appSettingsRowPresent ? "success" : "warning"}
                >
                  {form.diagnostics.appSettingsRowPresent
                    ? "มี app_settings row"
                    : "ยังไม่มี app_settings row"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRefreshDiagnostics()}
                  disabled={refreshingDiagnostics || loading}
                  className="border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-100"
                >
                  <RefreshCw
                    className={cn("size-3.5", refreshingDiagnostics ? "animate-spin" : undefined)}
                  />
                  {refreshingDiagnostics ? "กำลังรีเฟรช..." : "รีเฟรช diagnostics"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Connected project
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-950">
                  {form.diagnostics.projectHost || "unknown"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">
                    project ref {form.diagnostics.projectRef || "unknown"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                    {form.baseUrl ? `base URL ${form.baseUrl}` : "ยังไม่มี base URL runtime"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  ถ้า local กับ production แสดง Supabase host คนละตัว การเห็นข้อมูลไม่เท่ากันถือว่าปกติและไม่ใช่อาการ query พังโดยตรง
                </p>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Quick read
                </p>
                {form.diagnostics.errorSummary ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                    Diagnostics error: {form.diagnostics.errorSummary}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50/75 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      ตาราง workflow ที่มี data
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {populatedWorkflowTables}/{workflowDiagnostics.length}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50/75 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      รวม row ที่เจอ
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {totalWorkflowRows}
                    </p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
                  <li>
                    {form.diagnostics.coreDataPresent
                      ? "ตาราง workflow หลักมีข้อมูลแล้ว จึงไม่น่าใช่อาการ local อ่านฐานไม่สำเร็จ"
                      : "ยังไม่พบ row ใน customers / leads / quotes / jobs ของ project นี้"}
                  </li>
                  <li>
                    {productCatalogDiagnostics?.status === "populated"
                      ? "product catalog ถูกอ่านจาก database แล้ว"
                      : productCatalogDiagnostics?.status === "empty"
                        ? "product catalog table ยังว่าง ระบบจึง fallback ไปใช้ default catalog"
                        : "ยังอ่าน product catalog table ไม่สำเร็จ ตรวจ schema หรือ credentials ต่อ"}
                  </li>
                  <li>
                    {form.diagnostics.appSettingsRowPresent
                      ? "หน้านี้เคยบันทึก app_settings row ลงฐานนี้แล้ว"
                      : "ยังไม่มี app_settings row ในฐานนี้ ค่าหลายอย่างจึงยังมาจาก env/runtime fallback"}
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {form.diagnostics.tables.map((table) => (
                <div
                  key={table.key}
                  className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {table.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {typeof table.count === "number" ? table.count : "--"}
                      </p>
                    </div>
                    <Badge variant={getDiagnosticsBadgeVariant(table.status)}>
                      {getDiagnosticsStatusLabel(table.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {table.status === "populated"
                      ? "พบ row ใน project นี้แล้ว"
                      : table.status === "empty"
                        ? "ตารางนี้ยังไม่มี row ใน project ที่ local กำลังอ่าน"
                        : table.errorMessage
                          ? `query ตารางนี้ไม่สำเร็จ: ${table.errorMessage}`
                          : "query ตารางนี้ไม่สำเร็จ ตรวจ schema หรือ credentials ต่อ"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

        </>
      ) : null}

      {mode !== "general" ? (
        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">AI สร้างรูป</h2>
            <p className="mt-1 text-sm text-slate-600">รองรับ OpenAI (gpt-image-1) และ Google AI Studio (Imagen 3) แนะนำให้ใช้ Google AI Studio หากต้องการความประหยัดหรือโควตาฟรี</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={form.aiImageEnabled ? "rounded-full border border-emerald-200 bg-white px-3 py-1 text-emerald-800" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"}>
              {form.aiImageEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}
            </span>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-violet-800">
              Provider: {form.aiImageProvider === "google" ? "Google AI Studio" : "OpenAI"}
            </span>
            <span className={form.hasAiImageApiKey ? "rounded-full border border-emerald-200 bg-white px-3 py-1 text-emerald-800" : "rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-800"}>
              {form.hasAiImageApiKey ? "มี API key" : "ยังไม่มี API key"}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>เปิดใช้งาน AI Image</span>
            <select value={form.aiImageEnabled ? "enabled" : "disabled"} onChange={(e) => updateField("aiImageEnabled", e.target.value === "enabled")} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400">
              <option value="disabled">ปิด</option>
              <option value="enabled">เปิด</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Provider</span>
            <select value={form.aiImageProvider} onChange={(e) => handleAiImageProviderChange(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400">
              <option value="openai">OpenAI</option>
              <option value="google">Google AI Studio</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>Model</span>
            <input value={form.aiImageModel} onChange={(e) => updateField("aiImageModel", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder={form.aiImageProvider === "google" ? "imagen-3.0-generate-002" : "gpt-image-1"} />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>{form.aiImageProvider === "google" ? "Google AI API Key" : "OpenAI API Key"}</span>
            <input type="password" value={form.aiImageApiKey} onChange={(e) => updateField("aiImageApiKey", e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-400" placeholder={form.hasAiImageApiKey ? "มี key ถูกบันทึกไว้แล้ว, กรอกใหม่เมื่อต้องการเปลี่ยน" : "..."} />
            <p className="text-xs text-slate-500">
              {form.hasAiImageApiKey
                ? "ระบบมี API key สำหรับ provider ที่บันทึกอยู่แล้ว ถ้าเปลี่ยน provider ให้กรอก key ใหม่หรือใช้ env ของ provider ใหม่"
                : form.aiImageProvider === "google"
                  ? "สามารถใส่ผ่าน env GOOGLE_API_KEY หรือ GEMINI_API_KEY แทนการบันทึกในฐานข้อมูลได้"
                  : "สามารถใส่ผ่าน env OPENAI_API_KEY แทนการบันทึกในฐานข้อมูลได้"}
            </p>
          </label>
        </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {mode === "ai" ? (
          <>
            <p className="font-semibold">หมายเหตุ</p>
            <ul className="mt-2 space-y-1 text-amber-800">
              <li>ถ้ายังไม่ได้บันทึกค่าในฐานข้อมูล ฟอร์มนี้จะ preload provider, model และสถานะ key จาก env/runtime มาให้ดูก่อน</li>
              <li>สามารถใช้ env `OPENAI_API_KEY`, `GOOGLE_API_KEY` หรือ `GEMINI_API_KEY` แทนการบันทึก key ในฐานข้อมูลได้</li>
              <li>หน้านี้ไว้สำหรับ config provider และ credentials เท่านั้น ส่วนงาน generate/retry/preview ให้ทำต่อที่ `/admin/prompts`</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">หมายเหตุ</p>
            <ul className="mt-2 space-y-1 text-amber-800">
              <li>ถ้ายังไม่ได้บันทึกค่าในฐานข้อมูล ฟอร์มนี้จะ preload ค่าที่มีอยู่จาก env มาให้ดูก่อน</li>
              <li>ค่ากลุ่ม Supabase ยังเป็น deployment-level config และยังต้องมีใน environment เพื่อให้แอปบูตได้</li>
              <li>ค่ากลุ่ม LINE, LIFF, Base URL และ payment runtime ในหน้านี้จะถูกใช้แทน env อัตโนมัติถ้ากรอกไว้</li>
            </ul>
          </>
        )}
      </section>

      <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          {error ? (
            <p className="truncate text-sm text-red-600">{error}</p>
          ) : warning ? (
            <p className="truncate text-sm text-amber-700">{warning}</p>
          ) : message ? (
            <p className="truncate text-sm text-green-700">{message}</p>
          ) : form.updatedAt ? (
            <p className="text-xs text-slate-500">บันทึกล่าสุด {formatBangkokDateTime(form.updatedAt)}</p>
          ) : (
            <p className="text-xs text-slate-400">ยังไม่มีการบันทึกค่าจากหน้า settings</p>
          )}
        </div>
        <button type="submit" disabled={saving} className="shrink-0 rounded-full bg-[#1a1a2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16213e] disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </form>
  );
}
