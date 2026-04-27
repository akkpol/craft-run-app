type UnknownRecord = Record<string, unknown>;

export type LiffAvailabilitySnapshot = {
  permission: boolean | null;
  minVer: string | null;
  maxVer: string | null;
  unsupportedFromVer: string | null;
  minOsVer: string | null;
  maxOsVer: string | null;
  unsupportedFromOsVer: string | null;
};

export type LiffContextSnapshot = {
  collectedAt: string | null;
  os: string | null;
  appLanguage: string | null;
  lineVersion: string | null;
  liffSdkVersion: string | null;
  isInClient: boolean | null;
  isLoggedIn: boolean | null;
  grantedScopes: string[];
  context: {
    type: string | null;
    userId: string | null;
    liffId: string | null;
    viewType: string | null;
    endpointUrl: string | null;
    scope: string[];
    availability: Record<string, LiffAvailabilitySnapshot>;
    miniAppId: string | null;
    miniDomainAllowed: boolean | null;
    permanentLinkPattern: string | null;
  };
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeAvailability(value: unknown): Record<string, LiffAvailabilitySnapshot> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record)
      .map(([featureName, featureValue]) => {
        const featureRecord = asRecord(featureValue);
        if (!featureRecord) {
          return null;
        }

        return [
          featureName,
          {
            permission: asBoolean(featureRecord.permission),
            minVer: asString(featureRecord.minVer),
            maxVer: asString(featureRecord.maxVer),
            unsupportedFromVer: asString(featureRecord.unsupportedFromVer),
            minOsVer: asString(featureRecord.minOsVer),
            maxOsVer: asString(featureRecord.maxOsVer),
            unsupportedFromOsVer: asString(featureRecord.unsupportedFromOsVer),
          } satisfies LiffAvailabilitySnapshot,
        ] as const;
      })
      .filter(
        (
          entry
        ): entry is readonly [string, LiffAvailabilitySnapshot] => Boolean(entry)
      )
  );
}

export function normalizeLiffContextSnapshot(
  input: unknown
): LiffContextSnapshot | null {
  const root = asRecord(input);
  if (!root) {
    return null;
  }

  const context = asRecord(root.context);

  return {
    collectedAt: asString(root.collectedAt),
    os: asString(root.os),
    appLanguage: asString(root.appLanguage),
    lineVersion: asString(root.lineVersion),
    liffSdkVersion: asString(root.liffSdkVersion),
    isInClient: asBoolean(root.isInClient),
    isLoggedIn: asBoolean(root.isLoggedIn),
    grantedScopes: asStringArray(root.grantedScopes),
    context: {
      type: asString(context?.type),
      userId: asString(context?.userId),
      liffId: asString(context?.liffId),
      viewType: asString(context?.viewType),
      endpointUrl: asString(context?.endpointUrl),
      scope: asStringArray(context?.scope),
      availability: normalizeAvailability(context?.availability),
      miniAppId: asString(context?.miniAppId),
      miniDomainAllowed: asBoolean(context?.miniDomainAllowed),
      permanentLinkPattern: asString(context?.permanentLinkPattern),
    },
  };
}

export function parseLiffContextSnapshot(
  rawValue: string | null | undefined
): LiffContextSnapshot | null {
  const trimmedValue = rawValue?.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    return normalizeLiffContextSnapshot(JSON.parse(trimmedValue));
  } catch {
    return null;
  }
}