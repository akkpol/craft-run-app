export type DeliveryTrackingFields = {
  delivery_provider?: string | null;
  delivery_tracking_url?: string | null;
  delivery_tracking_number?: string | null;
  delivery_dispatched_at?: string | null;
  delivery_notes?: string | null;
};

export function hasDeliveryTrackingDetails(
  job: DeliveryTrackingFields | null | undefined
) {
  return Boolean(
    job?.delivery_provider ||
      job?.delivery_tracking_url ||
      job?.delivery_tracking_number ||
      job?.delivery_dispatched_at ||
      job?.delivery_notes
  );
}
