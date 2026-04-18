export type ProductionRuntimeSettings = {
  productionUploadEnabled: boolean;
  productionCustomerAutoSendEnabled: boolean;
  productionAssetRetentionDays: number;
};

const DEFAULT_PRODUCTION_RETENTION_DAYS = 30;

export function normalizeProductionRetentionDays(
  value: number | null | undefined
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_PRODUCTION_RETENTION_DAYS;
  }

  return Math.floor(value);
}

export function getDefaultProductionSettings(): ProductionRuntimeSettings {
  return {
    productionUploadEnabled: true,
    productionCustomerAutoSendEnabled: false,
    productionAssetRetentionDays: DEFAULT_PRODUCTION_RETENTION_DAYS,
  };
}
