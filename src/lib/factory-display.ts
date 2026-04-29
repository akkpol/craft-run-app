import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotJob,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotQuote,
} from "@/lib/backoffice-snapshot";
import { firstRow } from "@/lib/utils";
import {
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  WORKFLOW_STATE_LABELS,
  type JobStatus,
} from "@/lib/types";
import { PRODUCTION_EVENT_TYPE_LABELS } from "@/lib/production-review";

const FACTORY_AMOUNT_FORMATTER = new Intl.NumberFormat("en-US");

type FactoryMaterialPreset = {
  code: string;
  label: string;
  finish: string;
  color: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  thicknessMm: number;
  unitWeightKg: number;
};

export type FactoryQueueLaneId =
  | "prepress"
  | "machine"
  | "qc"
  | "dispatch"
  | "blocked"
  | "archive";

export type FactoryQueueLane = {
  id: FactoryQueueLaneId;
  label: string;
  description: string;
  count: number;
  tone: "sky" | "amber" | "emerald" | "rose" | "slate";
};

export type FactoryReviewAsset = {
  id: string;
  signedUrl: string | null;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
};

export type FactoryReviewEvent = {
  id: string;
  eventType: SnapshotProductionEvent["event_type"];
  eventTypeLabel: string;
  reviewStatus: SnapshotProductionEvent["review_status"];
  reviewNote: string | null;
  submittedByLabel: string | null;
  createdAt: string;
  note: string | null;
  assetCount: number;
  assets: FactoryReviewAsset[];
};

export type FactoryJobView = {
  id: string;
  jobId: string;
  conversationId: string | null;
  status: JobStatus;
  statusLabel: string;
  workflowStateLabel: string;
  queueLaneId: FactoryQueueLaneId;
  customerName: string;
  productLabel: string;
  operatorLabel: string;
  designerLabel: string | null;
  statusTone: "sky" | "amber" | "emerald" | "rose" | "slate";
  quoteTotalLabel: string | null;
  paymentSummary: string | null;
  createdAt: string;
  updatedAt: string;
  publicToken: string | null;
  note: string | null;
  dimensions: {
    widthMm: number;
    heightMm: number;
    qty: number;
    areaSqm: number;
    singleAreaSqm: number;
    perimeterMm: number;
    footprintLabel: string;
  };
  material: {
    code: string;
    label: string;
    finish: string;
    color: string;
    thicknessMm: number;
    sheetWidthMm: number;
    sheetHeightMm: number;
    sheetsRequired: number;
    usedAreaSqm: number;
    wasteAreaSqm: number;
    utilizationRate: number;
    wastePercent: number;
    unitWeightKg: number;
    totalWeightKg: number;
  };
  nesting: {
    piecesPerSheet: number;
    sheetCount: number;
    oversize: boolean;
    rotationApplied: boolean;
    splitPanelsPerUnit: number;
    previewSheets: Array<{
      index: number;
      pieces: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        rotated: boolean;
      }>;
    }>;
  };
  qc: {
    pendingCount: number;
    approvedCount: number;
    sentCount: number;
    rejectedCount: number;
    lastEventLabel: string | null;
    lastSubmittedAt: string | null;
    events: FactoryReviewEvent[];
  };
};

export type FactoryBlocker = {
  id: string;
  type: "quote" | "payment" | "customer" | "review";
  label: string;
  detail: string;
  ageHours: number;
};

export type FactoryMaterialSummary = {
  code: string;
  label: string;
  finish: string;
  color: string;
  activeJobs: number;
  sheetsRequired: number;
  usedAreaSqm: number;
  wasteAreaSqm: number;
  avgUtilizationRate: number;
};

export type FactoryViewModel = {
  generatedAt: string;
  defaultJobId: string | null;
  jobs: FactoryJobView[];
  queueLanes: FactoryQueueLane[];
  blockers: FactoryBlocker[];
  materialSummary: FactoryMaterialSummary[];
  kpis: {
    activeJobs: number;
    onMachine: number;
    qcPending: number;
    blockers: number;
    materialSheets: number;
    averageUtilizationRate: number;
  };
};

const MATERIAL_PRESETS: Record<string, FactoryMaterialPreset> = {
  vinyl_banner: {
    code: "FR-440",
    label: "Frontlit Vinyl",
    finish: "Eco-solvent print + hem",
    color: "#0ea5e9",
    sheetWidthMm: 1300,
    sheetHeightMm: 5000,
    thicknessMm: 0.45,
    unitWeightKg: 3.8,
  },
  acrylic_sign: {
    code: "ACR-3",
    label: "Acrylic Sheet",
    finish: "UV print + laser cut",
    color: "#38bdf8",
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 3,
    unitWeightKg: 8.7,
  },
  sticker: {
    code: "STK-PP",
    label: "PP Sticker Vinyl",
    finish: "Print + contour cut",
    color: "#22c55e",
    sheetWidthMm: 1000,
    sheetHeightMm: 1500,
    thicknessMm: 0.2,
    unitWeightKg: 1.6,
  },
  foam_board: {
    code: "FMB-5",
    label: "Foam Board",
    finish: "Direct print + flush trim",
    color: "#f59e0b",
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 5,
    unitWeightKg: 4.6,
  },
  aluminium: {
    code: "ACP-3",
    label: "Aluminium Composite",
    finish: "UV print + router cut",
    color: "#94a3b8",
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 3,
    unitWeightKg: 9.2,
  },
  other: {
    code: "CUS-01",
    label: "Custom Substrate",
    finish: "Manual review required",
    color: "#c084fc",
    sheetWidthMm: 1000,
    sheetHeightMm: 2000,
    thicknessMm: 2,
    unitWeightKg: 5.2,
  },
};

const QUEUE_LANE_META: Record<
  FactoryQueueLaneId,
  Omit<FactoryQueueLane, "count">
> = {
  prepress: {
    id: "prepress",
    label: "Prepress Queue",
    description: "Jobs still preparing files and approvals",
    tone: "sky",
  },
  machine: {
    id: "machine",
    label: "On Machine",
    description: "Jobs actively printing, routing, or finishing",
    tone: "sky",
  },
  qc: {
    id: "qc",
    label: "QC Gate",
    description: "Proofs and ready-for-production assets awaiting sign-off",
    tone: "amber",
  },
  dispatch: {
    id: "dispatch",
    label: "Dispatch / Pickup",
    description: "Finished work waiting for handoff",
    tone: "emerald",
  },
  blocked: {
    id: "blocked",
    label: "Blocked / Needs Human",
    description: "Jobs stuck on customer input or manual review",
    tone: "rose",
  },
  archive: {
    id: "archive",
    label: "Archive",
    description: "Completed or cancelled work kept for traceability",
    tone: "slate",
  },
};

function getProductLabel(productType: string | null | undefined): string {
  if (!productType) {
    return "Custom signage";
  }

  return (
    PRODUCT_TYPES.find((product) => product.value === productType)?.label ||
    productType
  );
}

function getMaterialPreset(productType: string | null | undefined): FactoryMaterialPreset {
  if (!productType) {
    return MATERIAL_PRESETS.other;
  }

  return MATERIAL_PRESETS[productType] || MATERIAL_PRESETS.other;
}

function getCustomerName(
  conversation: SnapshotConversation | null,
  lead: SnapshotLead | null,
  quote: SnapshotQuote | null
): string {
  const leadCustomer = firstRow(lead?.customers);
  const quoteCustomer = firstRow(firstRow(quote?.leads)?.customers);

  return (
    leadCustomer?.display_name ||
    quoteCustomer?.display_name ||
    (conversation?.line_user_id
      ? `LINE ${conversation.line_user_id.slice(0, 10)}`
      : "Factory job")
  );
}

function getJobNote(job: SnapshotJob, lead: SnapshotLead | null): string | null {
  if (job.status === "ON_HOLD_CUSTOMER_INPUT") {
    return lead?.hold_reason || lead?.note_from_chat || lead?.note_from_form || null;
  }

  if (job.status === "HUMAN_REVIEW_REQUIRED") {
    return (
      lead?.human_review_reason || lead?.note_from_chat || lead?.note_from_form || null
    );
  }

  return lead?.note_from_form || lead?.note_from_chat || lead?.reference_info || null;
}

function getQueueLaneId(
  job: SnapshotJob,
  pendingReviewCount: number,
  approvedReviewCount: number
): FactoryQueueLaneId {
  if (job.status === "COMPLETED" || job.status === "CANCELLED") {
    return "archive";
  }

  if (job.status === "ON_HOLD_CUSTOMER_INPUT" || job.status === "HUMAN_REVIEW_REQUIRED") {
    return "blocked";
  }

  if (job.status === "READY_FOR_FULFILLMENT") {
    return "dispatch";
  }

  if (job.status === "IN_PRODUCTION" && (pendingReviewCount > 0 || approvedReviewCount > 0)) {
    return "qc";
  }

  if (job.status === "IN_PRODUCTION") {
    return "machine";
  }

  return "prepress";
}

function getStatusTone(laneId: FactoryQueueLaneId): FactoryJobView["statusTone"] {
  if (laneId === "dispatch") {
    return "emerald";
  }

  if (laneId === "blocked" || laneId === "qc") {
    return "amber";
  }

  if (laneId === "archive") {
    return "slate";
  }

  return "sky";
}

function getAgeHours(isoDate: string): number {
  const ageMs = Date.now() - new Date(isoDate).getTime();
  return Number((ageMs / 3_600_000).toFixed(1));
}

function buildNestingPreview(input: {
  widthMm: number;
  heightMm: number;
  qty: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
}) {
  const orientations = [
    {
      width: input.widthMm,
      height: input.heightMm,
      rotated: false,
    },
    {
      width: input.heightMm,
      height: input.widthMm,
      rotated: true,
    },
  ];

  const evaluated = orientations
    .map((orientation) => {
      const cols = Math.floor(input.sheetWidthMm / orientation.width);
      const rows = Math.floor(input.sheetHeightMm / orientation.height);
      return {
        ...orientation,
        cols,
        rows,
        capacity: cols * rows,
      };
    })
    .sort((left, right) => right.capacity - left.capacity);

  const best = evaluated[0];

  if (best.capacity <= 0) {
    const splitPanelsPerUnit =
      Math.max(1, Math.ceil(input.widthMm / input.sheetWidthMm)) *
      Math.max(1, Math.ceil(input.heightMm / input.sheetHeightMm));
    const sheetCount = splitPanelsPerUnit * input.qty;

    return {
      piecesPerSheet: 1,
      sheetCount,
      oversize: true,
      rotationApplied: false,
      splitPanelsPerUnit,
      previewSheets: Array.from({ length: Math.min(3, sheetCount) }, (_, index) => ({
        index,
        pieces: [
          {
            id: `split-${index}`,
            x: 0,
            y: 0,
            width: input.sheetWidthMm,
            height: input.sheetHeightMm,
            rotated: false,
          },
        ],
      })),
    };
  }

  const sheetCount = Math.ceil(input.qty / best.capacity);
  const previewSheets = Array.from(
    { length: Math.min(3, sheetCount) },
    (_, sheetIndex) => {
      const pieces = Array.from({ length: Math.min(best.capacity, input.qty) }, (_, slotIndex) => {
        const globalIndex = sheetIndex * best.capacity + slotIndex;

        if (globalIndex >= input.qty) {
          return null;
        }

        const colIndex = slotIndex % best.cols;
        const rowIndex = Math.floor(slotIndex / best.cols);

        return {
          id: `piece-${sheetIndex}-${slotIndex}`,
          x: colIndex * best.width,
          y: rowIndex * best.height,
          width: best.width,
          height: best.height,
          rotated: best.rotated,
        };
      }).filter(Boolean);

      return {
        index: sheetIndex,
        pieces,
      };
    }
  );

  return {
    piecesPerSheet: best.capacity,
    sheetCount,
    oversize: false,
    rotationApplied: best.rotated,
    splitPanelsPerUnit: 1,
    previewSheets,
  };
}

function buildReviewEvents(
  events: SnapshotProductionEvent[]
): FactoryJobView["qc"]["events"] {
  return events.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    eventTypeLabel: PRODUCTION_EVENT_TYPE_LABELS[event.event_type],
    reviewStatus: event.review_status,
    reviewNote: event.review_note || null,
    submittedByLabel: event.submitted_by_label || null,
    createdAt: event.created_at,
    note: event.note || null,
    assetCount: (event.job_media_assets || []).length,
    assets: (event.job_media_assets || []).map((asset) => ({
      id: asset.id,
      signedUrl: asset.signed_url || null,
      mimeType: asset.mime_type || null,
      widthPx: asset.width_px || null,
      heightPx: asset.height_px || null,
    })),
  }));
}

function buildFactoryJobView(
  job: SnapshotJob,
  conversation: SnapshotConversation | null,
  reviewEvents: SnapshotProductionEvent[]
): FactoryJobView {
  const quote = firstRow(job.quotes);
  const lead = firstRow(quote?.leads);
  const customerName = getCustomerName(conversation, lead, quote);
  const materialPreset = getMaterialPreset(lead?.product_type);
  const qty = Math.max(1, lead?.qty || 1);
  const widthMm = Math.max(1, lead?.width_mm || 1000);
  const heightMm = Math.max(1, lead?.height_mm || 1000);
  const singleAreaSqm = (widthMm * heightMm) / 1_000_000;
  const usedAreaSqm = singleAreaSqm * qty;
  const nesting = buildNestingPreview({
    widthMm,
    heightMm,
    qty,
    sheetWidthMm: materialPreset.sheetWidthMm,
    sheetHeightMm: materialPreset.sheetHeightMm,
  });
  const sheetAreaSqm =
    (materialPreset.sheetWidthMm * materialPreset.sheetHeightMm) / 1_000_000;
  const totalSheetAreaSqm = nesting.sheetCount * sheetAreaSqm;
  const utilizationRate =
    totalSheetAreaSqm > 0 ? Math.min(1, usedAreaSqm / totalSheetAreaSqm) : 0;
  const wasteAreaSqm = Math.max(0, totalSheetAreaSqm - usedAreaSqm);
  const pendingCount = reviewEvents.filter((event) => event.review_status === "pending").length;
  const approvedCount = reviewEvents.filter((event) => event.review_status === "approved").length;
  const rejectedCount = reviewEvents.filter((event) => event.review_status === "rejected").length;
  const sentCount = reviewEvents.filter((event) => event.review_status === "sent").length;
  const queueLaneId = getQueueLaneId(job, pendingCount, approvedCount);
  const mappedEvents = buildReviewEvents(reviewEvents);
  const lastEvent = mappedEvents[0] || null;

  return {
    id: job.id,
    jobId: job.id,
    conversationId: lead?.conversation_id || null,
    status: job.status,
    statusLabel: JOB_STATUS_LABELS[job.status],
    workflowStateLabel: WORKFLOW_STATE_LABELS[job.status],
    queueLaneId,
    customerName,
    productLabel: getProductLabel(lead?.product_type),
    operatorLabel:
      job.assigned_to || lead?.assigned_designer || QUEUE_LANE_META[queueLaneId].label,
    designerLabel: lead?.assigned_designer || null,
    statusTone: getStatusTone(queueLaneId),
    quoteTotalLabel:
      quote?.total != null
        ? `฿${FACTORY_AMOUNT_FORMATTER.format(Number(quote.total))}`
        : null,
    paymentSummary: quote
      ? `${PAYMENT_TERM_LABELS[quote.payment_terms]} · ${PAYMENT_STATUS_LABELS[quote.payment_status]}`
      : null,
    createdAt: job.created_at,
    updatedAt: lastEvent?.createdAt || job.created_at,
    publicToken: quote?.public_token || null,
    note: getJobNote(job, lead),
    dimensions: {
      widthMm,
      heightMm,
      qty,
      areaSqm: Number(usedAreaSqm.toFixed(2)),
      singleAreaSqm: Number(singleAreaSqm.toFixed(2)),
      perimeterMm: (widthMm + heightMm) * 2,
      footprintLabel: `${(widthMm / 1000).toFixed(2)}m × ${(heightMm / 1000).toFixed(2)}m × ${qty}`,
    },
    material: {
      code: materialPreset.code,
      label: materialPreset.label,
      finish: materialPreset.finish,
      color: materialPreset.color,
      thicknessMm: materialPreset.thicknessMm,
      sheetWidthMm: materialPreset.sheetWidthMm,
      sheetHeightMm: materialPreset.sheetHeightMm,
      sheetsRequired: nesting.sheetCount,
      usedAreaSqm: Number(usedAreaSqm.toFixed(2)),
      wasteAreaSqm: Number(wasteAreaSqm.toFixed(2)),
      utilizationRate: Number(utilizationRate.toFixed(2)),
      wastePercent: Number(((1 - utilizationRate) * 100).toFixed(1)),
      unitWeightKg: materialPreset.unitWeightKg,
      totalWeightKg: Number((materialPreset.unitWeightKg * nesting.sheetCount).toFixed(1)),
    },
    nesting: {
      ...nesting,
      previewSheets: nesting.previewSheets.map((sheet) => ({
        ...sheet,
        pieces: sheet.pieces.filter((p): p is NonNullable<typeof p> => p !== null),
      })),
    },
    qc: {
      pendingCount,
      approvedCount,
      sentCount,
      rejectedCount,
      lastEventLabel: lastEvent?.eventTypeLabel || null,
      lastSubmittedAt: lastEvent?.createdAt || null,
      events: mappedEvents,
    },
  };
}

function buildBlockers(snapshot: BackofficeSnapshot): FactoryBlocker[] {
  const quoteBlockers = snapshot.quotes
    .filter((quote) => quote.status === "sent")
    .map((quote) => ({
      id: `quote:${quote.id}`,
      type: "quote" as const,
      label: quote.leads?.customers?.display_name || "Quote waiting approval",
      detail: `Awaiting quote approval · ฿${FACTORY_AMOUNT_FORMATTER.format(Number(quote.total))}`,
      ageHours: getAgeHours(quote.created_at),
    }));

  const conversationBlockers = snapshot.conversations
    .filter((conversation) =>
      ["WAITING_PAYMENT", "ON_HOLD_CUSTOMER_INPUT", "HUMAN_REVIEW_REQUIRED"].includes(
        conversation.state
      )
    )
    .map((conversation) => {
      const type =
        conversation.state === "WAITING_PAYMENT"
          ? "payment"
          : conversation.state === "HUMAN_REVIEW_REQUIRED"
            ? "review"
            : "customer";

      return {
        id: `conversation:${conversation.id}`,
        type,
        label: `LINE ${conversation.line_user_id.slice(0, 10)}`,
        detail: WORKFLOW_STATE_LABELS[conversation.state],
        ageHours: getAgeHours(conversation.last_message_at || conversation.created_at),
      } satisfies FactoryBlocker;
    });

  return [...quoteBlockers, ...conversationBlockers].sort(
    (left, right) => right.ageHours - left.ageHours
  );
}

function buildQueueLanes(jobs: FactoryJobView[]): FactoryQueueLane[] {
  return Object.values(QUEUE_LANE_META).map((lane) => ({
    ...lane,
    count: jobs.filter((job) => job.queueLaneId === lane.id).length,
  }));
}

function buildMaterialSummary(jobs: FactoryJobView[]): FactoryMaterialSummary[] {
  const materialBuckets = new Map<string, FactoryMaterialSummary>();

  for (const job of jobs.filter((item) => item.queueLaneId !== "archive")) {
    const bucket = materialBuckets.get(job.material.code);

    if (!bucket) {
      materialBuckets.set(job.material.code, {
        code: job.material.code,
        label: job.material.label,
        finish: job.material.finish,
        color: job.material.color,
        activeJobs: 1,
        sheetsRequired: job.material.sheetsRequired,
        usedAreaSqm: job.material.usedAreaSqm,
        wasteAreaSqm: job.material.wasteAreaSqm,
        avgUtilizationRate: job.material.utilizationRate,
      });
      continue;
    }

    const nextActiveJobs = bucket.activeJobs + 1;
    bucket.activeJobs = nextActiveJobs;
    bucket.sheetsRequired += job.material.sheetsRequired;
    bucket.usedAreaSqm = Number((bucket.usedAreaSqm + job.material.usedAreaSqm).toFixed(2));
    bucket.wasteAreaSqm = Number((bucket.wasteAreaSqm + job.material.wasteAreaSqm).toFixed(2));
    bucket.avgUtilizationRate = Number(
      (
        ((bucket.avgUtilizationRate * (nextActiveJobs - 1)) + job.material.utilizationRate) /
        nextActiveJobs
      ).toFixed(2)
    );
  }

  return Array.from(materialBuckets.values()).sort(
    (left, right) => right.sheetsRequired - left.sheetsRequired
  );
}

function sortJobs(left: FactoryJobView, right: FactoryJobView) {
  const lanePriority: Record<FactoryQueueLaneId, number> = {
    qc: 0,
    machine: 1,
    blocked: 2,
    prepress: 3,
    dispatch: 4,
    archive: 5,
  };

  if (lanePriority[left.queueLaneId] !== lanePriority[right.queueLaneId]) {
    return lanePriority[left.queueLaneId] - lanePriority[right.queueLaneId];
  }

  if (left.qc.pendingCount !== right.qc.pendingCount) {
    return right.qc.pendingCount - left.qc.pendingCount;
  }

  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function buildFactoryView(snapshot: BackofficeSnapshot): FactoryViewModel {
  const conversationById = new Map(
    snapshot.conversations.map((conversation) => [conversation.id, conversation])
  );
  const reviewEventsByJobId = new Map<string, SnapshotProductionEvent[]>();

  for (const event of snapshot.productionReviewQueue) {
    const nextEvents = reviewEventsByJobId.get(event.job_id) || [];
    nextEvents.push(event);
    reviewEventsByJobId.set(event.job_id, nextEvents);
  }

  const jobs = snapshot.jobs
    .map((job) =>
      buildFactoryJobView(
        job,
        conversationById.get(firstRow(job.quotes)?.leads?.conversation_id || "") || null,
        (reviewEventsByJobId.get(job.id) || []).sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        )
      )
    )
    .sort(sortJobs);

  const queueLanes = buildQueueLanes(jobs);
  const blockers = buildBlockers(snapshot);
  const materialSummary = buildMaterialSummary(jobs);
  const activeJobs = jobs.filter((job) => job.queueLaneId !== "archive");
  const defaultJob = jobs.find(
    (job) => job.queueLaneId === "qc" || job.queueLaneId === "machine"
  ) || jobs[0] || null;
  const totalSheets = activeJobs.reduce(
    (sum, job) => sum + job.material.sheetsRequired,
    0
  );
  const averageUtilizationRate =
    activeJobs.length > 0
      ? activeJobs.reduce((sum, job) => sum + job.material.utilizationRate, 0) /
        activeJobs.length
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    defaultJobId: defaultJob?.jobId || null,
    jobs,
    queueLanes,
    blockers,
    materialSummary,
    kpis: {
      activeJobs: activeJobs.length,
      onMachine: jobs.filter((job) => job.queueLaneId === "machine").length,
      qcPending: snapshot.productionReviewQueue.filter(
        (event) => event.review_status === "pending"
      ).length,
      blockers: blockers.length + jobs.filter((job) => job.queueLaneId === "blocked").length,
      materialSheets: totalSheets,
      averageUtilizationRate: Number(averageUtilizationRate.toFixed(2)),
    },
  };
}
