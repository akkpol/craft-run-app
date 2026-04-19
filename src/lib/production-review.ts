export const PRODUCTION_EVENT_TYPES = [
  "proof",
  "ready_for_production",
  "completed",
] as const;

export type ProductionEventType = (typeof PRODUCTION_EVENT_TYPES)[number];

export const PRODUCTION_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "sent",
] as const;

export type ProductionReviewStatus =
  (typeof PRODUCTION_REVIEW_STATUSES)[number];

type ProductionReviewLocale = "th" | "my" | "en";

const LOCALIZED_PRODUCTION_EVENT_TYPE_LABELS: Record<
  ProductionReviewLocale,
  Record<ProductionEventType, string>
> = {
  th: {
    proof: "Proof",
    ready_for_production: "พร้อมผลิต",
    completed: "ผลิตเสร็จ",
  },
  my: {
    proof: "နမူနာစစ်ရန်",
    ready_for_production: "ထုတ်လုပ်ရန် အသင့်",
    completed: "ထုတ်လုပ်ပြီး",
  },
  en: {
    proof: "Proof",
    ready_for_production: "Ready for production",
    completed: "Completed",
  },
};

export const PRODUCTION_EVENT_TYPE_LABELS =
  LOCALIZED_PRODUCTION_EVENT_TYPE_LABELS.th;

export function getProductionEventTypeLabel(
  eventType: ProductionEventType,
  locale: ProductionReviewLocale = "th"
): string {
  return LOCALIZED_PRODUCTION_EVENT_TYPE_LABELS[locale][eventType];
}

export type ProductionTimelineAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "sent";

function getEventTypeLabel(eventType: ProductionEventType): string {
  return getProductionEventTypeLabel(eventType, "en").toLowerCase();
}

export function getReviewStatusAfterApproval(
  customerAutoSendEnabled: boolean
): ProductionReviewStatus {
  return customerAutoSendEnabled ? "sent" : "approved";
}

export function getReviewTimelineNote(input: {
  action: ProductionTimelineAction;
  eventType: ProductionEventType;
  assetCount: number;
}): string {
  const eventLabel = getEventTypeLabel(input.eventType);
  const fileLabel = input.assetCount === 1 ? "file" : "files";

  if (input.action === "submitted") {
    return `Production ${eventLabel} submitted with ${input.assetCount} ${fileLabel}`;
  }

  if (input.action === "approved") {
    return `Production ${eventLabel} approved by admin`;
  }

  if (input.action === "rejected") {
    return `Production ${eventLabel} rejected by admin`;
  }

  return `Production ${eventLabel} sent to customer`;
}
