import type { StudioStationId, StudioToken } from "@/lib/studio-view";

export type StudioAccentTone =
  | "sky"
  | "amber"
  | "violet"
  | "emerald"
  | "rose"
  | "slate";

export type StudioMotionTag =
  | "steady"
  | "gate-pulse"
  | "creative-loop"
  | "machine-hum"
  | "dispatch-loop"
  | "review-glow"
  | "arrival-pop";

export type StudioPrimitiveAsset = {
  id: string;
  src: string;
  width: number;
  height: number;
  accentTone: StudioAccentTone;
  motionTag?: StudioMotionTag;
};

export type StudioPrimitivePlacement = {
  width: number;
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  zIndex?: number;
};

export type StudioStationArtConfig = {
  accentTone: StudioAccentTone;
  stationAsset: StudioPrimitiveAsset;
  actorAsset: StudioPrimitiveAsset;
  stationPlacement: StudioPrimitivePlacement;
  actorPlacement: StudioPrimitivePlacement;
  featureAsset?: StudioPrimitiveAsset;
  featurePlacement?: StudioPrimitivePlacement;
};

export type StudioTokenArtConfig = {
  objectAsset: StudioPrimitiveAsset;
  markerAsset: StudioPrimitiveAsset | null;
  accentTone: StudioAccentTone;
};

export type StudioConnectorConfig = {
  asset: StudioPrimitiveAsset;
  placement: StudioPrimitivePlacement;
  className?: string;
};

const STATION_ASSETS = {
  inboxDesk: {
    id: "station-inbox-desk",
    src: "/studio/primitives/stations/inbox-desk.svg",
    width: 320,
    height: 200,
    accentTone: "sky",
    motionTag: "steady",
  },
  quoteDesk: {
    id: "station-quote-desk",
    src: "/studio/primitives/stations/quote-desk.svg",
    width: 320,
    height: 200,
    accentTone: "violet",
    motionTag: "steady",
  },
  cashierGate: {
    id: "station-cashier-gate",
    src: "/studio/primitives/stations/cashier-gate.svg",
    width: 320,
    height: 200,
    accentTone: "amber",
    motionTag: "gate-pulse",
  },
  designBench: {
    id: "station-design-bench",
    src: "/studio/primitives/stations/design-bench.svg",
    width: 320,
    height: 200,
    accentTone: "violet",
    motionTag: "creative-loop",
  },
  productionMachine: {
    id: "station-production-machine",
    src: "/studio/primitives/stations/production-machine.svg",
    width: 320,
    height: 200,
    accentTone: "sky",
    motionTag: "machine-hum",
  },
  packingShelf: {
    id: "station-packing-shelf",
    src: "/studio/primitives/stations/packing-shelf.svg",
    width: 320,
    height: 200,
    accentTone: "emerald",
    motionTag: "dispatch-loop",
  },
  holdPocket: {
    id: "station-hold-pocket",
    src: "/studio/primitives/stations/hold-pocket.svg",
    width: 320,
    height: 200,
    accentTone: "amber",
    motionTag: "steady",
  },
  reviewBooth: {
    id: "station-review-booth",
    src: "/studio/primitives/stations/review-booth.svg",
    width: 320,
    height: 200,
    accentTone: "rose",
    motionTag: "review-glow",
  },
  archiveShelf: {
    id: "station-archive-shelf",
    src: "/studio/primitives/stations/archive-shelf.svg",
    width: 320,
    height: 200,
    accentTone: "emerald",
    motionTag: "steady",
  },
} as const;

const ACTOR_ASSETS = {
  salesAdmin: {
    id: "actor-sales-admin",
    src: "/studio/primitives/actors/sales-admin.svg",
    width: 128,
    height: 148,
    accentTone: "sky",
    motionTag: "steady",
  },
  cashier: {
    id: "actor-cashier",
    src: "/studio/primitives/actors/cashier.svg",
    width: 128,
    height: 148,
    accentTone: "amber",
    motionTag: "gate-pulse",
  },
  designer: {
    id: "actor-designer",
    src: "/studio/primitives/actors/designer.svg",
    width: 128,
    height: 148,
    accentTone: "violet",
    motionTag: "creative-loop",
  },
  productionOperator: {
    id: "actor-production-operator",
    src: "/studio/primitives/actors/production-operator.svg",
    width: 128,
    height: 148,
    accentTone: "sky",
    motionTag: "machine-hum",
  },
  dispatcher: {
    id: "actor-dispatcher",
    src: "/studio/primitives/actors/dispatcher.svg",
    width: 128,
    height: 148,
    accentTone: "emerald",
    motionTag: "dispatch-loop",
  },
  reviewer: {
    id: "actor-reviewer",
    src: "/studio/primitives/actors/reviewer.svg",
    width: 128,
    height: 148,
    accentTone: "rose",
    motionTag: "review-glow",
  },
} as const;

const TOKEN_ASSETS = {
  conversationSlip: {
    id: "token-conversation-slip",
    src: "/studio/primitives/tokens/conversation-slip.svg",
    width: 104,
    height: 88,
    accentTone: "sky",
    motionTag: "arrival-pop",
  },
  quoteSheet: {
    id: "token-quote-sheet",
    src: "/studio/primitives/tokens/quote-sheet.svg",
    width: 104,
    height: 88,
    accentTone: "violet",
    motionTag: "steady",
  },
  paymentProof: {
    id: "token-payment-proof",
    src: "/studio/primitives/tokens/payment-proof.svg",
    width: 104,
    height: 88,
    accentTone: "amber",
    motionTag: "gate-pulse",
  },
  designProof: {
    id: "token-design-proof",
    src: "/studio/primitives/tokens/design-proof.svg",
    width: 104,
    height: 88,
    accentTone: "violet",
    motionTag: "creative-loop",
  },
  printRoll: {
    id: "token-print-roll",
    src: "/studio/primitives/tokens/print-roll.svg",
    width: 104,
    height: 88,
    accentTone: "sky",
    motionTag: "machine-hum",
  },
  packageBox: {
    id: "token-package-box",
    src: "/studio/primitives/tokens/package-box.svg",
    width: 104,
    height: 88,
    accentTone: "emerald",
    motionTag: "dispatch-loop",
  },
  blockedMarker: {
    id: "token-blocked-marker",
    src: "/studio/primitives/tokens/blocked-marker.svg",
    width: 56,
    height: 56,
    accentTone: "amber",
  },
  doneMarker: {
    id: "token-done-marker",
    src: "/studio/primitives/tokens/done-marker.svg",
    width: 56,
    height: 56,
    accentTone: "emerald",
  },
} as const;

const CONNECTOR_ASSETS = {
  mainTopLane: {
    id: "connector-main-top-lane",
    src: "/studio/primitives/connectors/main-top-lane.svg",
    width: 620,
    height: 110,
    accentTone: "sky",
    motionTag: "steady",
  },
  mainBottomLane: {
    id: "connector-main-bottom-lane",
    src: "/studio/primitives/connectors/main-bottom-lane.svg",
    width: 520,
    height: 100,
    accentTone: "sky",
    motionTag: "steady",
  },
  branchSpur: {
    id: "connector-branch-spur",
    src: "/studio/primitives/connectors/branch-spur.svg",
    width: 280,
    height: 140,
    accentTone: "amber",
    motionTag: "steady",
  },
  designLoop: {
    id: "connector-design-loop",
    src: "/studio/primitives/connectors/design-loop.svg",
    width: 220,
    height: 170,
    accentTone: "violet",
    motionTag: "creative-loop",
  },
  archiveRoute: {
    id: "connector-archive-route",
    src: "/studio/primitives/connectors/archive-route.svg",
    width: 180,
    height: 120,
    accentTone: "emerald",
    motionTag: "dispatch-loop",
  },
  paymentGateMarker: {
    id: "connector-payment-gate-marker",
    src: "/studio/primitives/connectors/payment-gate-marker.svg",
    width: 120,
    height: 120,
    accentTone: "amber",
    motionTag: "gate-pulse",
  },
} as const;

export const STUDIO_CONNECTOR_ART: readonly StudioConnectorConfig[] = [
  {
    asset: CONNECTOR_ASSETS.mainTopLane,
    placement: { width: 620, left: "11%", top: "6%", zIndex: 1 },
    className: "hidden xl:block",
  },
  {
    asset: CONNECTOR_ASSETS.mainBottomLane,
    placement: { width: 520, left: "19%", top: "36%", zIndex: 1 },
    className: "hidden xl:block",
  },
  {
    asset: CONNECTOR_ASSETS.branchSpur,
    placement: { width: 240, left: "34%", top: "40%", zIndex: 1 },
    className: "hidden xl:block",
  },
  {
    asset: CONNECTOR_ASSETS.designLoop,
    placement: { width: 160, left: "30%", top: "34%", zIndex: 1 },
    className: "hidden xl:block",
  },
  {
    asset: CONNECTOR_ASSETS.archiveRoute,
    placement: { width: 122, right: "8%", top: "44%", zIndex: 1 },
    className: "hidden xl:block",
  },
] as const;

export function getStationArtConfig(stationId: StudioStationId): StudioStationArtConfig {
  const baseMap: Record<StudioStationId, StudioStationArtConfig> = {
    inbox: {
      accentTone: "sky",
      stationAsset: STATION_ASSETS.inboxDesk,
      actorAsset: ACTOR_ASSETS.salesAdmin,
      stationPlacement: { width: 184, left: "14px", bottom: "-6px", zIndex: 2 },
      actorPlacement: { width: 86, right: "10px", bottom: "6px", zIndex: 3 },
    },
    quote: {
      accentTone: "violet",
      stationAsset: STATION_ASSETS.quoteDesk,
      actorAsset: ACTOR_ASSETS.salesAdmin,
      stationPlacement: { width: 188, left: "12px", bottom: "-6px", zIndex: 2 },
      actorPlacement: { width: 84, right: "12px", bottom: "6px", zIndex: 3 },
    },
    cashier: {
      accentTone: "amber",
      stationAsset: STATION_ASSETS.cashierGate,
      actorAsset: ACTOR_ASSETS.cashier,
      stationPlacement: { width: 180, left: "18px", bottom: "-4px", zIndex: 2 },
      actorPlacement: { width: 84, right: "10px", bottom: "8px", zIndex: 3 },
      featureAsset: CONNECTOR_ASSETS.paymentGateMarker,
      featurePlacement: { width: 58, right: "52px", top: "8px", zIndex: 1 },
    },
    design: {
      accentTone: "violet",
      stationAsset: STATION_ASSETS.designBench,
      actorAsset: ACTOR_ASSETS.designer,
      stationPlacement: { width: 188, left: "10px", bottom: "-4px", zIndex: 2 },
      actorPlacement: { width: 84, right: "8px", bottom: "8px", zIndex: 3 },
    },
    production: {
      accentTone: "sky",
      stationAsset: STATION_ASSETS.productionMachine,
      actorAsset: ACTOR_ASSETS.productionOperator,
      stationPlacement: { width: 190, left: "8px", bottom: "-4px", zIndex: 2 },
      actorPlacement: { width: 82, right: "10px", bottom: "6px", zIndex: 3 },
    },
    packing: {
      accentTone: "emerald",
      stationAsset: STATION_ASSETS.packingShelf,
      actorAsset: ACTOR_ASSETS.dispatcher,
      stationPlacement: { width: 184, left: "12px", bottom: "-4px", zIndex: 2 },
      actorPlacement: { width: 84, right: "12px", bottom: "4px", zIndex: 3 },
    },
    hold: {
      accentTone: "amber",
      stationAsset: STATION_ASSETS.holdPocket,
      actorAsset: ACTOR_ASSETS.salesAdmin,
      stationPlacement: { width: 180, left: "14px", bottom: "-2px", zIndex: 2 },
      actorPlacement: { width: 82, right: "14px", bottom: "8px", zIndex: 3 },
    },
    review: {
      accentTone: "rose",
      stationAsset: STATION_ASSETS.reviewBooth,
      actorAsset: ACTOR_ASSETS.reviewer,
      stationPlacement: { width: 180, left: "14px", bottom: "-2px", zIndex: 2 },
      actorPlacement: { width: 82, right: "12px", bottom: "8px", zIndex: 3 },
    },
    archive: {
      accentTone: "emerald",
      stationAsset: STATION_ASSETS.archiveShelf,
      actorAsset: ACTOR_ASSETS.dispatcher,
      stationPlacement: { width: 178, left: "14px", bottom: "-2px", zIndex: 2 },
      actorPlacement: { width: 78, right: "14px", bottom: "8px", zIndex: 3 },
    },
  };

  return baseMap[stationId];
}

export function getTokenArtConfig(token: StudioToken): StudioTokenArtConfig {
  let objectAsset: StudioPrimitiveAsset = TOKEN_ASSETS.conversationSlip;

  if (token.state === "WAITING_PAYMENT") {
    objectAsset = TOKEN_ASSETS.paymentProof;
  } else if (token.stationId === "design") {
    objectAsset = TOKEN_ASSETS.designProof;
  } else if (token.stationId === "production") {
    objectAsset = TOKEN_ASSETS.printRoll;
  } else if (token.stationId === "packing" || token.stationId === "archive") {
    objectAsset = TOKEN_ASSETS.packageBox;
  } else if (token.tokenKind === "quote") {
    objectAsset = TOKEN_ASSETS.quoteSheet;
  }

  const markerAsset =
    token.priorityTone === "blocked"
      ? TOKEN_ASSETS.blockedMarker
      : token.priorityTone === "done"
        ? TOKEN_ASSETS.doneMarker
        : null;

  const accentTone: StudioAccentTone =
    token.priorityTone === "blocked"
      ? "amber"
      : token.priorityTone === "done"
        ? "emerald"
        : token.priorityTone === "active"
          ? "sky"
          : objectAsset.accentTone;

  return {
    objectAsset,
    markerAsset,
    accentTone,
  };
}
