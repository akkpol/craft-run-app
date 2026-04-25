import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ArchitectureTone =
  | "frontend"
  | "core"
  | "ai"
  | "storage"
  | "events"
  | "analytics";

type ArchitectureGlyph =
  | "line"
  | "rich-menu"
  | "person-menu"
  | "quick-reply"
  | "flex-message"
  | "cloud-gear"
  | "phone-cube"
  | "customers"
  | "shield-network"
  | "flow"
  | "template-flow"
  | "brain-nodes"
  | "headset"
  | "customer-360"
  | "crm"
  | "invoice"
  | "clipboard"
  | "factory"
  | "cart"
  | "bank"
  | "wand"
  | "ruler"
  | "image"
  | "layers"
  | "folder-image"
  | "file-shield"
  | "webhook"
  | "sync"
  | "card"
  | "bell"
  | "line-chart"
  | "pie"
  | "bars"
  | "org"
  | "warehouse"
  | "dollar"
  | "gear";

type ArchitectureModule = {
  label: string;
  glyph: ArchitectureGlyph;
};

type ArchitectureGroup = {
  section: string;
  title: string;
  tone: ArchitectureTone;
  modules: ArchitectureModule[];
};

type ArchitectureFloor = {
  id: string;
  label: string;
  groups: ArchitectureGroup[];
};

const TONE_STYLE: Record<
  ArchitectureTone,
  {
    accent: string;
    soft: string;
    deep: string;
    shadow: string;
  }
> = {
  frontend: {
    accent: "#22c55e",
    soft: "#dcfce7",
    deep: "#166534",
    shadow: "rgba(34, 197, 94, 0.2)",
  },
  core: {
    accent: "#3b82f6",
    soft: "#dbeafe",
    deep: "#1e3a8a",
    shadow: "rgba(59, 130, 246, 0.2)",
  },
  ai: {
    accent: "#7c3aed",
    soft: "#ede9fe",
    deep: "#4c1d95",
    shadow: "rgba(124, 58, 237, 0.2)",
  },
  storage: {
    accent: "#f59e0b",
    soft: "#fef3c7",
    deep: "#92400e",
    shadow: "rgba(245, 158, 11, 0.22)",
  },
  events: {
    accent: "#ea580c",
    soft: "#ffedd5",
    deep: "#9a3412",
    shadow: "rgba(234, 88, 12, 0.2)",
  },
  analytics: {
    accent: "#14b8a6",
    soft: "#ccfbf1",
    deep: "#115e59",
    shadow: "rgba(20, 184, 166, 0.2)",
  },
};

const FRONTEND_GROUP: ArchitectureGroup = {
  section: "1",
  title: "Frontend / Channel",
  tone: "frontend",
  modules: [
    { label: "LINE Official Account", glyph: "line" },
    { label: "Rich Menu", glyph: "rich-menu" },
    { label: "Per-user Rich Menu", glyph: "person-menu" },
    { label: "Quick Reply", glyph: "quick-reply" },
    { label: "Flex Message", glyph: "flex-message" },
    { label: "Messaging API", glyph: "cloud-gear" },
    { label: "LINE MINI App (LIFF)", glyph: "phone-cube" },
    { label: "Customer", glyph: "customers" },
  ],
};

const GATEWAY_GROUP: ArchitectureGroup = {
  section: "2",
  title: "Gateway & Orchestrator",
  tone: "core",
  modules: [
    { label: "API Gateway", glyph: "shield-network" },
    { label: "Conversation Orchestrator", glyph: "flow" },
    { label: "Template Flow Engine", glyph: "template-flow" },
    { label: "Intent / Confidence Scoring", glyph: "brain-nodes" },
    { label: "Human Handoff Engine", glyph: "headset" },
    { label: "Customer 360 / Lead Extractor", glyph: "customer-360" },
  ],
};

const ERP_GROUP: ArchitectureGroup = {
  section: "3",
  title: "ERP Core",
  tone: "core",
  modules: [
    { label: "CRM & Lead", glyph: "crm" },
    { label: "Quotation / Billing / Invoice", glyph: "invoice" },
    { label: "Job / Work Order", glyph: "clipboard" },
    { label: "Production / Scheduling", glyph: "factory" },
    { label: "Procurement / Stock / Material", glyph: "cart" },
    { label: "Finance / Expense / Payment Reconciliation", glyph: "bank" },
  ],
};

const AI_GROUP: ArchitectureGroup = {
  section: "4",
  title: "AI Design Pipeline",
  tone: "ai",
  modules: [
    { label: "Prompt Builder", glyph: "wand" },
    { label: "Size & Unit Normalizer", glyph: "ruler" },
    { label: "Image Gen Adapter", glyph: "image" },
    { label: "Mockup Review / Versioning", glyph: "layers" },
  ],
};

const STORAGE_GROUP: ArchitectureGroup = {
  section: "5",
  title: "File Storage",
  tone: "storage",
  modules: [
    { label: "Artwork / Source file", glyph: "folder-image" },
    { label: "Mockup / Preview", glyph: "image" },
    { label: "Proof / Delivery photo", glyph: "file-shield" },
  ],
};

const EVENT_GROUP: ArchitectureGroup = {
  section: "6",
  title: "Event Bus / Queue",
  tone: "events",
  modules: [
    { label: "Webhook Events", glyph: "webhook" },
    { label: "Job Status Events", glyph: "sync" },
    { label: "Payment Events", glyph: "card" },
    { label: "Dashboard Updates", glyph: "bell" },
  ],
};

const DASHBOARD_GROUP: ArchitectureGroup = {
  section: "7",
  title: "BI / Realtime Dashboard",
  tone: "analytics",
  modules: [
    { label: "Overview", glyph: "line-chart" },
    { label: "Sales / Revenue", glyph: "pie" },
    { label: "Jobs / Orders", glyph: "bars" },
    { label: "Production Status", glyph: "org" },
    { label: "Stock / Inventory", glyph: "warehouse" },
    { label: "Payments", glyph: "dollar" },
    { label: "Customers", glyph: "customers" },
    { label: "Settings", glyph: "gear" },
  ],
};

const ARCHITECTURE_FLOORS: ArchitectureFloor[] = [
  {
    id: "channel",
    label: "Customer channel floor",
    groups: [FRONTEND_GROUP],
  },
  {
    id: "gateway",
    label: "Gateway and orchestration floor",
    groups: [GATEWAY_GROUP],
  },
  {
    id: "erp",
    label: "ERP production floor",
    groups: [ERP_GROUP],
  },
  {
    id: "pipeline",
    label: "AI, storage, and event services floor",
    groups: [AI_GROUP, STORAGE_GROUP, EVENT_GROUP],
  },
  {
    id: "dashboard",
    label: "Realtime dashboard floor",
    groups: [DASHBOARD_GROUP],
  },
];

function getToneStyle(tone: ArchitectureTone) {
  const toneConfig = TONE_STYLE[tone];

  return {
    "--architecture-accent": toneConfig.accent,
    "--architecture-soft": toneConfig.soft,
    "--architecture-deep": toneConfig.deep,
    "--architecture-shadow": toneConfig.shadow,
  } as CSSProperties;
}

function StudioArchitectureGlyph({ glyph }: { glyph: ArchitectureGlyph }) {
  const iconProps = {
    viewBox: "0 0 64 64",
    className: "h-full w-full",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  };

  switch (glyph) {
    case "line":
      return (
        <svg {...iconProps}>
          <rect x="9" y="9" width="46" height="46" rx="12" fill="var(--architecture-accent)" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M22 39h-2a8 8 0 0 1-8-8v-2a10 10 0 0 1 10-10h20a10 10 0 0 1 10 10v2a8 8 0 0 1-8 8h-9l-9 7v-7h-4Z" fill="white" />
          <path d="M22 31V22m7 9V22m0 0 7 9V22m7 0v9" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rich-menu":
      return (
        <svg {...iconProps}>
          <rect x="10" y="13" width="44" height="38" rx="5" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          {[0, 1, 2].map((col) =>
            [0, 1].map((row) => (
              <rect
                key={`${col}-${row}`}
                x={18 + col * 12}
                y={21 + row * 14}
                width="8"
                height="8"
                rx="2"
                fill={row === 0 ? "var(--architecture-soft)" : "var(--architecture-accent)"}
                stroke="var(--architecture-deep)"
                strokeWidth="1.5"
                opacity={row === 0 ? 1 : 0.7}
              />
            ))
          )}
        </svg>
      );
    case "person-menu":
      return (
        <svg {...iconProps}>
          <circle cx="32" cy="28" r="22" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="32" cy="23" r="7" fill="var(--architecture-accent)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <path d="M18 44c2.8-8 8-12 14-12s11.2 4 14 12" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "quick-reply":
      return (
        <svg {...iconProps}>
          <path d="M13 29c0-10.5 8.5-19 19-19h2c10.5 0 19 8.5 19 19s-8.5 19-19 19h-9l-11 6 2.8-11.5A18.9 18.9 0 0 1 13 29Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          {[25, 33, 41].map((cx) => (
            <circle key={cx} cx={cx} cy="30" r="3.2" fill="var(--architecture-deep)" />
          ))}
        </svg>
      );
    case "flex-message":
      return (
        <svg {...iconProps}>
          <rect x="12" y="10" width="40" height="44" rx="5" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M12 18h40" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M17 15h10" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="18" y="24" width="28" height="17" rx="3" fill="var(--architecture-soft)" stroke="var(--architecture-accent)" strokeWidth="2" />
          <path d="m20 40 8-9 6 6 4-5 8 8" stroke="var(--architecture-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 47h21" stroke="var(--architecture-deep)" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
        </svg>
      );
    case "cloud-gear":
      return (
        <svg {...iconProps}>
          <path d="M21 46c-6 0-11-5-11-11 0-5.2 3.7-9.6 8.7-10.7C20.4 17 26.2 12 34 12c9.2 0 16.7 6.9 17.8 15.8 4.8 1.6 8.2 6 8.2 11.2 0 6.6-5.4 12-12 12H21Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="35" cy="38" r="8" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <path d="M35 25v5m0 16v5m13-13h-5m-16 0h-5m22-9-3.6 3.6M29.6 43.4 26 47m18 0-3.6-3.6M29.6 32.6 26 29" stroke="var(--architecture-accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "phone-cube":
      return (
        <svg {...iconProps}>
          <rect x="18" y="7" width="28" height="50" rx="5" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M25 12h14M29 52h6" stroke="var(--architecture-deep)" strokeWidth="2.3" strokeLinecap="round" />
          <path d="m32 23 10 5v11l-10 5-10-5V28l10-5Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="m22 28 10 5 10-5M32 33v11" stroke="var(--architecture-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "customers":
      return (
        <svg {...iconProps}>
          <circle cx="25" cy="23" r="8" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="43" cy="24" r="7" fill="white" stroke="var(--architecture-accent)" strokeWidth="3" />
          <path d="M10 50c2.5-10 8-15 16-15s13.5 5 16 15H10Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M36 48c1.8-7 5.8-10.5 12-10.5 3.2 0 6.3 1.5 9 4.5v6H36Z" fill="var(--architecture-soft)" stroke="var(--architecture-accent)" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      );
    case "shield-network":
      return (
        <svg {...iconProps}>
          <path d="M32 8 50 16v13c0 11-7.4 20.6-18 25-10.6-4.4-18-14-18-25V16l18-8Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M32 14v34" stroke="var(--architecture-deep)" strokeWidth="2" opacity=".35" />
          <path d="M14 28H6m52 0h-8M14 38H8m48 0h-6" stroke="var(--architecture-deep)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="6" cy="28" r="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.2" />
          <circle cx="58" cy="28" r="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.2" />
          <circle cx="8" cy="38" r="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.2" />
        </svg>
      );
    case "flow":
    case "template-flow":
    case "org":
      return (
        <svg {...iconProps}>
          <rect x="26" y="9" width="12" height="12" rx="2" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.7" />
          <path d="M32 21v12M18 33h28M18 33v8m14-8v8m14-8v8" stroke="var(--architecture-deep)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          {[14, 28, 42].map((x, index) => (
            <rect
              key={x}
              x={x}
              y="41"
              width="10"
              height="10"
              rx="2"
              fill={index === 1 ? "var(--architecture-accent)" : "var(--architecture-soft)"}
              stroke="var(--architecture-deep)"
              strokeWidth="2.2"
            />
          ))}
        </svg>
      );
    case "brain-nodes":
      return (
        <svg {...iconProps}>
          <path d="M27 12c-7 0-12 5.3-12 12 0 1.2.2 2.4.5 3.5A12.6 12.6 0 0 0 12 36c0 6.6 5.4 12 12 12h7V12h-4Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M31 16c4 0 7 3 7 7v2m-7 11h10m-10-9h17m0 0 7-7m-7 7 7 7m-14 2 8 8M41 22l8-8" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {[49, 55, 55, 49].map((cx, index) => (
            <circle key={`${cx}-${index}`} cx={cx} cy={[14, 20, 34, 44][index]} r="3" fill="white" stroke="var(--architecture-deep)" strokeWidth="2" />
          ))}
        </svg>
      );
    case "headset":
      return (
        <svg {...iconProps}>
          <circle cx="32" cy="30" r="18" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M14 31c0-12 8-21 18-21s18 9 18 21" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
          <rect x="9" y="28" width="8" height="13" rx="3" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <rect x="47" y="28" width="8" height="13" rx="3" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <path d="M40 45c5 0 8-2.2 9-6M38 45h-6" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "customer-360":
      return (
        <svg {...iconProps}>
          <circle cx="29" cy="29" r="21" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="29" cy="23" r="7" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <path d="M16 43c2.5-8 7-12 13-12s10.5 4 13 12" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="45" cy="43" r="10" fill="var(--architecture-accent)" stroke="var(--architecture-deep)" strokeWidth="2.4" />
          <path d="M38 43h14M41 39c2-2 6-2 8 0M41 47c2 2 6 2 8 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "crm":
      return (
        <svg {...iconProps}>
          <circle cx="24" cy="22" r="8" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.8" />
          <circle cx="42" cy="21" r="8" fill="var(--architecture-accent)" stroke="var(--architecture-deep)" strokeWidth="2.8" opacity=".8" />
          <path d="M10 50c2-10 7-15 15-15 5.2 0 9.2 2.2 12 6.5M29 50c2-9 6.8-13.5 14.5-13.5 4.7 0 8.2 1.6 10.5 4.8V50H29Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "invoice":
      return (
        <svg {...iconProps}>
          <path d="M18 8h23l9 9v39H18V8Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M41 8v11h9M25 24h14M25 33h10M25 42h9" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="45" cy="44" r="10" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <path d="M45 38v12M41 42c0-2 2-3 4-3s4 1 4 3-2 3-4 3-4 1-4 3" stroke="var(--architecture-accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...iconProps}>
          <rect x="17" y="13" width="34" height="43" rx="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M26 17v-3c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3v3" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="m25 30 4 4 8-9M25 43l4 4 8-9M41 31h4M41 44h4" stroke="var(--architecture-accent)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "factory":
      return (
        <svg {...iconProps}>
          <path d="M10 50h46M14 50V28l14 8V25l14 8V21h8v29" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 42h6m8 0h6m8 0h4M47 15h-6" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "cart":
      return (
        <svg {...iconProps}>
          <path d="M12 14h8l5 26h24l6-18H24" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 24h18l-3 10H30l-2-10Z" fill="var(--architecture-soft)" stroke="var(--architecture-accent)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="29" cy="49" r="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <circle cx="47" cy="49" r="4" fill="white" stroke="var(--architecture-deep)" strokeWidth="2.5" />
        </svg>
      );
    case "bank":
      return (
        <svg {...iconProps}>
          <path d="m12 24 20-12 20 12H12Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M15 50h34M18 44h28M21 25v19m11-19v19m11-19v19" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "wand":
      return (
        <svg {...iconProps}>
          <path d="m12 50 29-29 5 5-29 29-5-5Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M46 9v8M42 13h8M24 13l3 5 5 3-5 3-3 5-3-5-5-3 5-3 3-5ZM52 35l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" stroke="var(--architecture-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...iconProps}>
          <path d="m15 39 25-25 10 10-25 25-10-10Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="m25 29 4 4m1-9 6 6m0-12 4 4m-21 21 5 5" stroke="var(--architecture-accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "image":
      return (
        <svg {...iconProps}>
          <rect x="13" y="13" width="38" height="38" rx="5" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="25" cy="25" r="4" fill="var(--architecture-accent)" opacity=".75" />
          <path d="m17 45 12-14 8 8 5-6 6 12H17Z" fill="var(--architecture-soft)" stroke="var(--architecture-accent)" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      );
    case "layers":
      return (
        <svg {...iconProps}>
          <path d="m32 10 23 12-23 12L9 22 32 10Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="m12 32 20 10 20-10M12 42l20 10 20-10" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="22" r="4" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2" />
        </svg>
      );
    case "folder-image":
      return (
        <svg {...iconProps}>
          <path d="M9 20h18l5 6h23v27H9V20Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <rect x="16" y="30" width="31" height="16" rx="3" fill="white" stroke="var(--architecture-accent)" strokeWidth="2" />
          <path d="m19 44 8-8 5 5 4-4 8 7" stroke="var(--architecture-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "file-shield":
      return (
        <svg {...iconProps}>
          <path d="M17 8h26l8 8v40H17V8Z" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M43 8v10h8" stroke="var(--architecture-deep)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M34 27 45 32v7c0 6.2-4.4 10.8-11 13-6.6-2.2-11-6.8-11-13v-7l11-5Z" fill="var(--architecture-soft)" stroke="var(--architecture-accent)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="m29 39 4 4 8-9" stroke="var(--architecture-deep)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "webhook":
      return (
        <svg {...iconProps}>
          <circle cx="32" cy="14" r="7" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="16" cy="44" r="7" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <circle cx="48" cy="44" r="7" fill="white" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M29 20 19 38m16-18 10 18M23 44h18" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="14" r="3" fill="var(--architecture-accent)" />
        </svg>
      );
    case "sync":
      return (
        <svg {...iconProps}>
          <path d="M49 23a19 19 0 0 0-31-6l-4 4m1-10v10h10M15 41a19 19 0 0 0 31 6l4-4m-1 10V43H39" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "card":
      return (
        <svg {...iconProps}>
          <rect x="10" y="18" width="44" height="31" rx="5" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M10 28h44M18 40h12m8 0h7" stroke="var(--architecture-accent)" strokeWidth="2.7" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg {...iconProps}>
          <path d="M18 44h28l-3-5V27c0-6.5-4-11.5-11-11.5S21 20.5 21 27v12l-3 5Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M29 50h6M32 10v5" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "line-chart":
      return (
        <svg {...iconProps}>
          <path d="M14 12v40h40" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
          <path d="m19 42 10-12 8 7 12-17" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[19, 29, 37, 49].map((cx, index) => (
            <circle key={cx} cx={cx} cy={[42, 30, 37, 20][index]} r="3" fill="var(--architecture-deep)" />
          ))}
        </svg>
      );
    case "pie":
      return (
        <svg {...iconProps}>
          <path d="M32 10a22 22 0 1 0 22 22H32V10Z" fill="var(--architecture-accent)" opacity=".72" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M38 8v18h18A22 22 0 0 0 38 8Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
    case "bars":
      return (
        <svg {...iconProps}>
          <path d="M12 52h40" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinecap="round" />
          <rect x="16" y="34" width="8" height="18" rx="2" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <rect x="30" y="24" width="8" height="28" rx="2" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="2.5" />
          <rect x="44" y="12" width="8" height="40" rx="2" fill="var(--architecture-accent)" stroke="var(--architecture-deep)" strokeWidth="2.5" opacity=".75" />
        </svg>
      );
    case "warehouse":
      return (
        <svg {...iconProps}>
          <path d="M12 28 32 14l20 14v24H12V28Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M22 52V34h20v18M27 40h10M27 46h10" stroke="var(--architecture-accent)" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "dollar":
      return (
        <svg {...iconProps}>
          <circle cx="32" cy="32" r="23" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" />
          <path d="M32 17v30M24 25c0-4 4-6 8-6s8 2 8 6-4 6-8 6-8 2-8 6 4 6 8 6 8-2 8-6" stroke="var(--architecture-accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "gear":
      return (
        <svg {...iconProps}>
          <path d="m32 8 5 5 7-2 5 8-5 5c.4 1.4.4 2.6 0 4l5 5-5 8-7-2-5 5-5-5-7 2-5-8 5-5a14 14 0 0 1 0-4l-5-5 5-8 7 2 5-5Z" fill="var(--architecture-soft)" stroke="var(--architecture-deep)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="26" r="8" fill="white" stroke="var(--architecture-accent)" strokeWidth="3" />
        </svg>
      );
  }
}

function ArchitectureModuleCard({
  module,
  tone,
}: {
  module: ArchitectureModule;
  tone: ArchitectureTone;
}) {
  return (
    <li className="studio-architecture-module" style={getToneStyle(tone)}>
      <span className="studio-architecture-module-icon">
        <StudioArchitectureGlyph glyph={module.glyph} />
      </span>
      <span className="studio-architecture-module-label">{module.label}</span>
    </li>
  );
}

function ArchitectureGroupPanel({ group }: { group: ArchitectureGroup }) {
  return (
    <div className="studio-architecture-group" style={getToneStyle(group.tone)}>
      <div className="studio-architecture-group-header">
        <span className="studio-architecture-section-index">{group.section}</span>
        <h4>{group.title}</h4>
      </div>
      <ul className="studio-architecture-module-grid">
        {group.modules.map((module) => (
          <ArchitectureModuleCard
            key={`${group.section}-${module.label}`}
            module={module}
            tone={group.tone}
          />
        ))}
      </ul>
    </div>
  );
}

export default function StudioArchitectureMap() {
  return (
    <div className="studio-architecture-map">
      <div className="studio-architecture-stack" aria-label="Studio architecture map">
        {ARCHITECTURE_FLOORS.map((floor, index) => (
          <article
            key={floor.id}
            className="studio-architecture-level"
            style={{ "--architecture-level": index } as CSSProperties}
          >
            <div className="studio-architecture-level-node">
              <span>{index + 1}</span>
            </div>
            <div className="studio-architecture-floor">
              <div className="studio-architecture-floor-header">
                <p>{floor.label}</p>
              </div>
              <div
                className={cn(
                  "studio-architecture-groups",
                  floor.groups.length > 1 && "studio-architecture-groups-split"
                )}
              >
                {floor.groups.map((group) => (
                  <ArchitectureGroupPanel key={group.title} group={group} />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
