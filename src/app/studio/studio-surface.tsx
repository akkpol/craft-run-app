"use client";

import Link from "next/link";
import Image from "next/image";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AdminConversationActions from "@/app/admin/conversation-actions";
import AdminJobActions from "@/app/admin/job-actions";
import LeadAiPreviewActions from "@/app/admin/lead-ai-preview-actions";
import AdminLeadDesignActions from "@/app/admin/lead-design-actions";
import AdminQuoteActions from "@/app/admin/quote-actions";
import {
  STUDIO_FILTERS,
  getStudioTokenMeta,
  type StudioFilterId,
  type StudioStationId,
  type StudioToken,
  type StudioViewModel,
} from "@/lib/studio-view";
import { cn } from "@/lib/utils";
import type { JobStatus, WorkflowState } from "@/lib/types";

type StudioSurfaceProps = {
  view: StudioViewModel;
  baseUrl: string;
  businessName: string;
};

type StudioLaneTone = "critical" | "branch" | "archive";
type StudioMotionSignature = "steady" | "focus" | "hum" | "archive";

const ROLE_ART: Record<StudioStationId, string> = {
  inbox: "🧑‍💼",
  quote: "🧾",
  cashier: "💁",
  design: "🧑‍🎨",
  production: "🧑‍🏭",
  packing: "🧑‍🚚",
  hold: "💬",
  review: "🧠",
  archive: "🗃️",
};

const STATION_LAYOUT_CLASS: Record<StudioStationId, string> = {
  inbox: "xl:[grid-area:1/1/2/3]",
  quote: "xl:[grid-area:1/3/2/5]",
  cashier: "xl:[grid-area:1/5/2/7]",
  design: "xl:[grid-area:2/2/3/4]",
  production: "xl:[grid-area:2/4/3/6]",
  packing: "xl:[grid-area:2/6/3/8]",
  hold: "xl:[grid-area:3/2/4/4]",
  review: "xl:[grid-area:3/4/4/6]",
  archive: "xl:[grid-area:3/6/4/8]",
};

const STATION_SCENE_META: Record<
  StudioStationId,
  {
    laneTone: StudioLaneTone;
    laneLabel: string;
    motionSignature: StudioMotionSignature;
    motionLabel: string;
    moodLabel: string;
  }
> = {
  inbox: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "steady",
    motionLabel: "Arrival lane",
    moodLabel: "New work lands here first",
  },
  quote: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "steady",
    motionLabel: "Decision desk",
    moodLabel: "Commercial approval queue",
  },
  cashier: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "focus",
    motionLabel: "Gate check",
    moodLabel: "Payment lock is visible",
  },
  design: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "hum",
    motionLabel: "Creative loop",
    moodLabel: "Preview and revision zone",
  },
  production: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "hum",
    motionLabel: "Machine rhythm",
    moodLabel: "Production throughput",
  },
  packing: {
    laneTone: "critical",
    laneLabel: "Critical path",
    motionSignature: "steady",
    motionLabel: "Dispatch shelf",
    moodLabel: "Ready to fulfill",
  },
  hold: {
    laneTone: "branch",
    laneLabel: "Side branch",
    motionSignature: "focus",
    motionLabel: "Waiting pocket",
    moodLabel: "Customer input is missing",
  },
  review: {
    laneTone: "branch",
    laneLabel: "Side branch",
    motionSignature: "focus",
    motionLabel: "Escalation booth",
    moodLabel: "Human review and unblock",
  },
  archive: {
    laneTone: "archive",
    laneLabel: "Archive lane",
    motionSignature: "archive",
    motionLabel: "Done shelf",
    moodLabel: "Completed and cancelled work",
  },
};

function getToneClasses(token: StudioToken) {
  if (token.priorityTone === "blocked") {
    return "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_18px_34px_rgba(217,119,6,0.18)]";
  }

  if (token.priorityTone === "active") {
    return "border-sky-300 bg-sky-50 text-sky-950 shadow-[0_18px_34px_rgba(14,165,233,0.18)]";
  }

  if (token.priorityTone === "done") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_18px_34px_rgba(16,185,129,0.18)]";
  }

  return "border-slate-200 bg-white text-slate-900 shadow-[0_14px_28px_rgba(15,23,42,0.1)]";
}

function getStationTone(stationId: StudioStationId) {
  if (stationId === "cashier" || stationId === "hold") {
    return "from-amber-100 via-orange-50 to-white";
  }

  if (stationId === "review") {
    return "from-rose-100 via-pink-50 to-white";
  }

  if (stationId === "archive") {
    return "from-emerald-100 via-teal-50 to-white";
  }

  if (stationId === "production") {
    return "from-sky-100 via-cyan-50 to-white";
  }

  return "from-white via-slate-50 to-white";
}

function getLaneToneClasses(laneTone: StudioLaneTone) {
  if (laneTone === "branch") {
    return "border-amber-200 bg-amber-50/85 text-amber-800";
  }

  if (laneTone === "archive") {
    return "border-emerald-200 bg-emerald-50/85 text-emerald-800";
  }

  return "border-sky-200 bg-sky-50/85 text-sky-800";
}

function getTokenSignal(token: StudioToken) {
  if (token.escalation) {
    return {
      label: "Escalated",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (token.priorityTone === "blocked") {
    return {
      label: "Blocked",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (token.priorityTone === "active") {
    return {
      label: "Active",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (token.priorityTone === "done") {
    return {
      label: "Done",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Queued",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function getTokenIcon(tokenKind: StudioToken["tokenKind"]) {
  if (tokenKind === "job") {
    return "📦";
  }

  if (tokenKind === "quote") {
    return "🧾";
  }

  return "💬";
}

function getOwnerBadgeText(token: StudioToken) {
  return token.ownerLabel || token.ownerRole;
}

function getOwnerInitial(token: StudioToken) {
  const ownerSource = getOwnerBadgeText(token).trim();

  if (!ownerSource) {
    return "•";
  }

  const pieces = ownerSource.split(/\s+/).filter(Boolean);

  if (pieces.length >= 2) {
    return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
  }

  return ownerSource.slice(0, 2).toUpperCase();
}

function getDrawerViewKey(token: StudioToken | null, stationId: StudioStationId | null) {
  if (token) {
    return `token:${token.id}`;
  }

  if (stationId) {
    return `station:${stationId}`;
  }

  return "empty";
}

function StudioDrawer({
  token,
  stationId,
  view,
  baseUrl,
  onClose,
}: {
  token: StudioToken | null;
  stationId: StudioStationId | null;
  view: StudioViewModel;
  baseUrl: string;
  onClose: () => void;
}) {
  const station = stationId ? view.stationMap[stationId] : null;
  const tokenMeta = token ? getStudioTokenMeta(token) : null;
  const drawerKey = getDrawerViewKey(token, stationId);
  const stationSceneMeta = station ? STATION_SCENE_META[station.id] : null;

  return (
    <aside className="studio-drawer studio-reveal-panel flex min-h-[420px] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/96 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.94))] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Inspector
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
              {token ? token.title : station?.label || "Select a token"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {token ? (
                <>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      getTokenSignal(token).className
                    )}
                  >
                    {getTokenSignal(token).label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      getLaneToneClasses(STATION_SCENE_META[token.stationId].laneTone)
                    )}
                  >
                    {STATION_SCENE_META[token.stationId].laneLabel}
                  </span>
                </>
              ) : stationSceneMeta ? (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    getLaneToneClasses(stationSceneMeta.laneTone)
                  )}
                >
                  {stationSceneMeta.motionLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {token
                ? `${tokenMeta?.stateLabel} · ${token.productLabel}`
                : station?.description ||
                  "Click a station or work token to inspect details and trigger real workflow actions."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          key={drawerKey}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        >
          {token ? (
            <div className="space-y-5">
              <section className="grid gap-3 rounded-[24px] bg-slate-50 p-4 sm:grid-cols-2">
                <div className="rounded-[20px] bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Owner
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {getOwnerBadgeText(token)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{token.ownerRole}</p>
                </div>
                <div className="rounded-[20px] bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Token Type
                  </p>
                  <p className="mt-2 text-sm font-medium capitalize text-slate-900">
                    {token.tokenKind}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {token.stationId} station
                  </p>
                </div>
                <div className="rounded-[20px] bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payment
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {tokenMeta?.paymentSummary || "No commercial gate"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {token.amountLabel || "No quote total"}
                  </p>
                </div>
                <div className="rounded-[20px] bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Design / Job
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {tokenMeta?.designStatusLabel ||
                      tokenMeta?.jobStatusLabel ||
                      "No production object yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {new Date(token.lastUpdatedAt).toLocaleString("th-TH")}
                  </p>
                </div>
              </section>

              {token.note ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Notes
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{token.note}</p>
                </section>
              ) : null}

              {Array.isArray(token.lead?.ai_generated_images) &&
              token.lead.ai_generated_images.length > 0 ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    AI Preview Gallery
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {token.lead.ai_generated_images.map((imageUrl) => (
                      <a
                        key={imageUrl}
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <Image
                          src={imageUrl}
                          alt="AI preview"
                          width={80}
                          height={80}
                          unoptimized
                          className="h-20 w-20 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Links
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Jump to fallback admin or customer-facing pages.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {token.quote?.public_token ? (
                    <>
                      <a
                        href={`${baseUrl}/quote/${token.quote.public_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      >
                        Open quote
                      </a>
                      <a
                        href={`${baseUrl}/status/${token.quote.public_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      >
                        Open status
                      </a>
                    </>
                  ) : null}
                  <Link
                    href="/admin"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    Open admin fallback
                  </Link>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Real Workflow Actions
                </p>
                <div className="mt-4 space-y-4">
                  {token.quote ? (
                    <div className="rounded-[20px] bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Quote / Payment</p>
                      <AdminQuoteActions
                        quoteId={token.quote.id}
                        publicToken={token.quote.public_token}
                        quoteStatus={token.quote.status}
                        paymentTerms={token.quote.payment_terms}
                        paymentStatus={token.quote.payment_status}
                        hasJob={Boolean(token.quote.jobs?.length)}
                      />
                    </div>
                  ) : null}

                  {token.lead ? (
                    <div className="rounded-[20px] bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Design / AI Preview
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <LeadAiPreviewActions
                          leadId={token.lead.id}
                          prompt={token.lead.ai_image_prompt || ""}
                          status={token.lead.ai_image_status || "not_requested"}
                        />
                        <AdminLeadDesignActions
                          leadId={token.lead.id}
                          designStatus={token.lead.design_status || "not_started"}
                        />
                      </div>
                    </div>
                  ) : null}

                  {token.job ? (
                    <div className="rounded-[20px] bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Job Progress</p>
                      <div className="mt-2">
                        <AdminJobActions
                          jobId={token.job.id}
                          currentStatus={token.job.status as JobStatus}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[20px] bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Conversation State</p>
                    <div className="mt-2">
                      <AdminConversationActions
                        conversationId={token.conversation.id}
                        currentState={token.conversation.state as WorkflowState}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : station ? (
            <div className="space-y-4">
              <section className="rounded-[24px] bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    {ROLE_ART[station.id]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{station.roleLabel}</p>
                    <p className="text-xs text-slate-500">
                      {station.count} tokens · {station.blockedCount} blocked
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {station.description}
                </p>
                {stationSceneMeta ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        getLaneToneClasses(stationSceneMeta.laneTone)
                      )}
                    >
                      {stationSceneMeta.laneLabel}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {stationSceneMeta.motionLabel}
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Tokens In This Station
                </p>
                <div className="mt-4 space-y-2">
                  {station.tokens.length > 0 ? (
                    station.tokens.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.subtitle} · {item.productLabel}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                              getTokenSignal(item).className
                            )}
                          >
                            {getTokenSignal(item).label}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No tokens here right now.</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center px-8 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">Cute Studio is ready</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Click any station to see a queue summary, or click a token to trigger
                  the real workflow actions behind it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function StudioSurface({
  view,
  baseUrl,
  businessName,
}: StudioSurfaceProps) {
  const initialToken =
    view.tokens.find((token) => token.priorityTone === "blocked") ||
    view.tokens[0] ||
    null;
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(
    initialToken?.id || null
  );
  const [selectedStationId, setSelectedStationId] = useState<StudioStationId | null>(
    null
  );
  const [filterId, setFilterId] = useState<StudioFilterId>("all");
  const [justArrivedTokenIds, setJustArrivedTokenIds] = useState<string[]>([]);
  const deferredFilterId = useDeferredValue(filterId);
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousRectsRef = useRef(new Map<string, DOMRect>());
  const knownTokenIdsRef = useRef(new Set(view.tokens.map((token) => token.id)));
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filter =
    STUDIO_FILTERS.find((item) => item.id === deferredFilterId) || STUDIO_FILTERS[0];

  const filteredStations = useMemo(
    () =>
      view.stations.map((station) => {
        const tokens = station.tokens.filter(filter.matches);
        return {
          ...station,
          count: tokens.length,
          blockedCount: tokens.filter((token) => token.priorityTone === "blocked")
            .length,
          tokens,
        };
      }),
    [filter, view.stations]
  );

  const filteredStationMap = useMemo(
    () =>
      Object.fromEntries(filteredStations.map((station) => [station.id, station])) as
        Record<StudioStationId, StudioViewModel["stations"][number]>,
    [filteredStations]
  );

  const boardTokens = useMemo(
    () => filteredStations.flatMap((station) => station.tokens),
    [filteredStations]
  );

  const boardTokenSignature = useMemo(
    () => boardTokens.map((token) => `${token.stationId}:${token.id}`).join("|"),
    [boardTokens]
  );

  const tokenMap = useMemo(
    () => new Map(view.tokens.map((token) => [token.id, token])),
    [view.tokens]
  );

  const selectedToken =
    (selectedTokenId ? tokenMap.get(selectedTokenId) || null : null) ||
    (selectedStationId
      ? null
      : initialToken
        ? tokenMap.get(initialToken.id) || initialToken
        : null);

  const selectedStation = selectedToken
    ? view.stationMap[selectedToken.stationId]
    : selectedStationId
      ? filteredStationMap[selectedStationId]
      : null;

  const criticalPathCount = filteredStations
    .filter((station) => STATION_SCENE_META[station.id].laneTone === "critical")
    .reduce((sum, station) => sum + station.tokens.length, 0);
  const branchCount = filteredStations
    .filter((station) => STATION_SCENE_META[station.id].laneTone === "branch")
    .reduce((sum, station) => sum + station.tokens.length, 0);
  const archiveCount = filteredStationMap.archive?.tokens.length || 0;
  const escalatedCount = boardTokens.filter((token) => Boolean(token.escalation)).length;
  const assignedCount = boardTokens.filter((token) => Boolean(token.ownerLabel)).length;

  useLayoutEffect(() => {
    const currentRects = new Map<string, DOMRect>();

    for (const [id, node] of tokenRefs.current.entries()) {
      currentRects.set(id, node.getBoundingClientRect());
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      for (const [id, node] of tokenRefs.current.entries()) {
        const previousRect = previousRectsRef.current.get(id);
        const currentRect = currentRects.get(id);

        if (!previousRect || !currentRect) {
          continue;
        }

        const dx = previousRect.left - currentRect.left;
        const dy = previousRect.top - currentRect.top;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          continue;
        }

        node.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scale(0.96)`,
              zIndex: 10,
            },
            {
              transform: "translate(0px, 0px) scale(1)",
              zIndex: 10,
            },
          ],
          {
            duration: 460,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }
        );
      }
    }

    previousRectsRef.current = currentRects;
  }, [boardTokenSignature]);

  useEffect(() => {
    const nextKnownTokenIds = new Set(view.tokens.map((token) => token.id));
    const newTokenIds = view.tokens
      .filter((token) => !knownTokenIdsRef.current.has(token.id))
      .map((token) => token.id);

    knownTokenIdsRef.current = nextKnownTokenIds;

    if (newTokenIds.length === 0) {
      return;
    }

    setJustArrivedTokenIds(newTokenIds);

    if (arrivalTimerRef.current) {
      clearTimeout(arrivalTimerRef.current);
    }

    arrivalTimerRef.current = setTimeout(() => {
      setJustArrivedTokenIds((current) =>
        current.filter((tokenId) => !newTokenIds.includes(tokenId))
      );
    }, 2200);
  }, [view.tokens]);

  useEffect(
    () => () => {
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current);
      }
    },
    []
  );

  function setTokenRef(id: string, node: HTMLButtonElement | null) {
    if (node) {
      tokenRefs.current.set(id, node);
      return;
    }

    tokenRefs.current.delete(id);
  }

  function handleTokenSelect(tokenId: string, stationId: StudioStationId) {
    startTransition(() => {
      setSelectedStationId(stationId);
      setSelectedTokenId(tokenId);
    });
  }

  function handleStationSelect(stationId: StudioStationId) {
    startTransition(() => {
      setSelectedTokenId(null);
      setSelectedStationId(stationId);
    });
  }

  return (
    <div className="studio-shell min-h-screen px-4 py-5 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1660px] flex-col gap-5">
        <header className="studio-hero studio-reveal-panel overflow-hidden rounded-[34px] border border-slate-900/10 px-5 py-5 text-slate-950 shadow-[0_26px_70px_rgba(15,23,42,0.16)] sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 backdrop-blur">
                Cute Studio V1
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                {businessName} Studio Ops
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-[15px]">
                Scan the floor, spot the bottleneck, click a token, and trigger the
                real workflow action behind it. The scene is playful, but the data
                and mutations stay tied to the canonical workflow model.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Inbox",
                  "Quote",
                  "Cashier",
                  "Design",
                  "Production",
                  "Packing",
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-800"
                  >
                    {label}
                  </span>
                ))}
                {["Hold", "Review", "Archive"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                Admin Fallback
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                Settings
              </Link>
              <Link
                href="/flow"
                target="_blank"
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                Workflow Reference
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Inbox",
                value: view.kpis.inbox,
                tone: "text-slate-950",
              },
              {
                label: "รออนุมัติ",
                value: view.kpis.waitingApproval,
                tone: "text-amber-700",
              },
              {
                label: "กำลังทำ",
                value: view.kpis.active,
                tone: "text-sky-700",
              },
              {
                label: "ติดค้าง",
                value: view.kpis.blocked,
                tone: "text-rose-700",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-[24px] border border-white/75 bg-white/84 px-4 py-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                <p className={cn("text-2xl font-semibold tracking-[-0.04em]", kpi.tone)}>
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <div className="rounded-[28px] border border-white/75 bg-white/72 px-4 py-4 shadow-[0_18px_34px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Reading Pattern
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Follow the critical path across the bright upper floor, then read
                hold and review as side branches below. Archive stays visible as a
                quiet completion shelf, not the main storyline.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                {
                  label: "Critical path",
                  value: criticalPathCount,
                  detail: "Main ops runway",
                  tone: "border-sky-200 bg-sky-50/80 text-sky-800",
                },
                {
                  label: "Side branches",
                  value: branchCount,
                  detail: "Hold and review",
                  tone: "border-amber-200 bg-amber-50/80 text-amber-800",
                },
                {
                  label: "Archive",
                  value: archiveCount,
                  detail: "Done shelf",
                  tone: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-[24px] border px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)]",
                    item.tone
                  )}
                >
                  <p className="text-xl font-semibold tracking-[-0.04em]">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs opacity-80">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_390px]">
          <section className="studio-reveal-panel overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/74 shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Playfield
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Each station maps to one canonical workflow zone. Tokens move when
                    the underlying workflow changes, while hold and review stay readable
                    as side branches instead of swallowing the board.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                  {[
                    {
                      label: "Escalated now",
                      value: escalatedCount,
                      tone: "border-rose-200 bg-rose-50/80 text-rose-800",
                    },
                    {
                      label: "Owned tokens",
                      value: assignedCount,
                      tone: "border-violet-200 bg-violet-50/80 text-violet-800",
                    },
                    {
                      label: "Visible tokens",
                      value: boardTokens.length,
                      tone: "border-slate-200 bg-slate-50/90 text-slate-800",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn("rounded-[20px] border px-3 py-2", item.tone)}
                    >
                      <p className="text-lg font-semibold tracking-[-0.04em]">
                        {item.value}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.16em]">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {STUDIO_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setFilterId(item.id);
                        });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        filterId === item.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-500">
                  `/admin` remains the safe fallback for every action surface.
                </p>
              </div>
            </div>

            <div className="studio-board-wrap px-4 py-5 sm:px-5">
              <div className="studio-board relative rounded-[30px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(241,245,249,0.84))] p-3 shadow-inner sm:p-4">
                <div className="studio-floor pointer-events-none absolute inset-x-6 bottom-5 top-10 rounded-[30px]" />
                <div className="studio-atmosphere pointer-events-none absolute inset-0 rounded-[30px]" />

                <div className="pointer-events-none absolute inset-3 hidden xl:grid xl:grid-cols-7 xl:grid-rows-3 xl:gap-3">
                  <div className="studio-zone xl:[grid-area:1/1/3/8]" data-zone-tone="critical">
                    <span className="studio-zone-label">Critical path</span>
                  </div>
                  <div className="studio-zone xl:[grid-area:3/2/4/6]" data-zone-tone="branch">
                    <span className="studio-zone-label">Side branches</span>
                  </div>
                  <div className="studio-zone xl:[grid-area:3/6/4/8]" data-zone-tone="archive">
                    <span className="studio-zone-label">Archive shelf</span>
                  </div>
                </div>

                <div className="relative grid gap-3 md:grid-cols-4 xl:grid-cols-7 xl:grid-rows-3">
                  {filteredStations.map((station) => {
                    const sceneMeta = STATION_SCENE_META[station.id];
                    const stationAssignedCount = station.tokens.filter((token) =>
                      Boolean(token.ownerLabel)
                    ).length;

                    return (
                      <div
                        key={station.id}
                        role="button"
                        tabIndex={0}
                        data-zone-tone={sceneMeta.laneTone}
                        data-motion-signature={sceneMeta.motionSignature}
                        data-is-selected={
                          selectedStation?.id === station.id && !selectedToken
                            ? "true"
                            : "false"
                        }
                        data-has-blocked={station.blockedCount > 0 ? "true" : "false"}
                        onClick={() => handleStationSelect(station.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleStationSelect(station.id);
                          }
                        }}
                        className={cn(
                          "studio-station group relative flex min-h-[176px] cursor-pointer flex-col rounded-[28px] border border-slate-200/80 bg-gradient-to-br px-4 py-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)]",
                          getStationTone(station.id),
                          STATION_LAYOUT_CLASS[station.id],
                          selectedStation?.id === station.id && !selectedToken
                            ? "ring-2 ring-slate-900/70"
                            : "ring-0"
                        )}
                      >
                        <div className="studio-station-glow pointer-events-none absolute inset-0 rounded-[28px]" />

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-2xl shadow-sm">
                              {station.icon}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-950">
                                  {station.label}
                                </p>
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                    getLaneToneClasses(sceneMeta.laneTone)
                                  )}
                                >
                                  {sceneMeta.laneLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {station.roleLabel} · {sceneMeta.motionLabel}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <div className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                              {station.tokens.length}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {sceneMeta.moodLabel}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-600">
                          {station.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {station.blockedCount > 0 ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-rose-600/10 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                              <span>•</span>
                              <span>{station.blockedCount} blocked</span>
                            </div>
                          ) : null}
                          {stationAssignedCount > 0 ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                              <span>•</span>
                              <span>{stationAssignedCount} owned</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-1 flex-wrap content-start gap-2.5">
                          {station.tokens.length > 0 ? (
                            station.tokens.map((token) => {
                              const tokenSignal = getTokenSignal(token);

                              return (
                                <button
                                  key={token.id}
                                  ref={(node) => setTokenRef(token.id, node)}
                                  type="button"
                                  data-priority-tone={token.priorityTone}
                                  data-escalated={token.escalation ? "true" : "false"}
                                  data-has-owner={token.ownerLabel ? "true" : "false"}
                                  data-just-arrived={
                                    justArrivedTokenIds.includes(token.id) ? "true" : "false"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleTokenSelect(token.id, station.id);
                                  }}
                                  className={cn(
                                    "studio-token relative min-w-[134px] max-w-[208px] rounded-[22px] border px-3 py-3 text-left transition duration-300 hover:-translate-y-1",
                                    getToneClasses(token),
                                    selectedToken?.id === token.id
                                      ? "ring-2 ring-slate-900/70"
                                      : "ring-0"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="studio-token-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/75 text-[11px] font-semibold text-slate-700 shadow-sm">
                                        {getOwnerInitial(token)}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-current/70">
                                          <span>{getTokenIcon(token.tokenKind)}</span>
                                          <span>{token.tokenKind}</span>
                                        </p>
                                        <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-current/78">
                                          {getOwnerBadgeText(token)}
                                        </p>
                                      </div>
                                    </div>

                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                        tokenSignal.className
                                      )}
                                    >
                                      {tokenSignal.label}
                                    </span>
                                  </div>

                                  <p className="mt-3 line-clamp-1 text-sm font-semibold text-current">
                                    {token.title}
                                  </p>
                                  <p className="mt-1 line-clamp-1 text-[11px] text-current/70">
                                    {token.productLabel}
                                  </p>

                                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-current/62">
                                    <span className="line-clamp-1">{token.subtitle}</span>
                                    <span className="shrink-0">
                                      {token.amountLabel || sceneMeta.laneLabel}
                                    </span>
                                  </div>

                                  {token.priorityTone === "blocked" && token.note ? (
                                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-current/72">
                                      {token.note}
                                    </p>
                                  ) : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="flex h-full min-h-[74px] items-center rounded-[22px] border border-dashed border-slate-200 bg-white/55 px-3 py-2 text-xs text-slate-400">
                              No tokens for this filter.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <StudioDrawer
            token={selectedToken}
            stationId={selectedToken ? selectedToken.stationId : selectedStationId}
            view={view}
            baseUrl={baseUrl}
            onClose={() => {
              setSelectedTokenId(null);
              setSelectedStationId(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
