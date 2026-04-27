import { PRICING, PRODUCT_TYPES } from "@/lib/types";

export type ProductCatalogItem = {
  value: string;
  label: string;
  category: string;
  categoryLabel: string;
  description: string;
  keywords: string[];
  perSqm: number;
  minCharge: number;
  active: boolean;
  sortOrder: number;
};

const DEFAULT_OTHER_PRICING = PRICING.other;

export const DEFAULT_PRODUCT_CATALOG: ProductCatalogItem[] = PRODUCT_TYPES.map((item, index) => ({
  value: item.value,
  label: item.label,
  category: item.category,
  categoryLabel: item.categoryLabel,
  description: item.description,
  keywords: [...item.keywords],
  perSqm: PRICING[item.value]?.perSqm ?? DEFAULT_OTHER_PRICING.perSqm,
  minCharge: PRICING[item.value]?.minCharge ?? DEFAULT_OTHER_PRICING.minCharge,
  active: true,
  sortOrder: index,
}));

function normalizeWhitespace(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: string | number | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeWhitespace(String(value || "")).replace(/,/g, "");
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | boolean | null | undefined, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeWhitespace(String(value || "")).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function splitKeywords(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWhitespace(item)).filter(Boolean);
  }

  return normalizeWhitespace(String(value || ""))
    .split(/[|,]/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function simpleHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function slugifyProductValue(value: string) {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized;
}

function buildGeneratedProductValue(
  explicitValue: string | null | undefined,
  label: string,
  category: string,
  lineNumber: number
) {
  const normalizedExplicit = slugifyProductValue(explicitValue || "");
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  const slug = slugifyProductValue(`${category}-${label}`);
  if (slug) {
    return slug;
  }

  return `product-${lineNumber}-${simpleHash(`${category}:${label}`)}`;
}

export function getDefaultProductCatalog() {
  return DEFAULT_PRODUCT_CATALOG.map((item) => ({
    ...item,
    keywords: [...item.keywords],
  }));
}

export function sortProductCatalog(items: ProductCatalogItem[]) {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.categoryLabel !== right.categoryLabel) {
      return left.categoryLabel.localeCompare(right.categoryLabel, "th");
    }

    return left.label.localeCompare(right.label, "th");
  });
}

export function findProductCatalogItem(
  items: ProductCatalogItem[],
  value: string | null | undefined
) {
  if (!value) {
    return null;
  }

  return items.find((item) => item.value === value) || null;
}

export function resolveProductCatalogLabel(input: {
  productType: string | null | undefined;
  productLabelSnapshot?: string | null;
  fallbackLabel?: string;
}) {
  const snapshotLabel = normalizeWhitespace(input.productLabelSnapshot);
  if (snapshotLabel) {
    return snapshotLabel;
  }

  if (!input.productType) {
    return input.fallbackLabel || "ไม่ระบุ";
  }

  return (
    findProductCatalogItem(DEFAULT_PRODUCT_CATALOG, input.productType)?.label ||
    input.productType
  );
}

export function calculateProductCatalogPrice(
  item: Pick<ProductCatalogItem, "perSqm" | "minCharge">,
  widthMm: number,
  heightMm: number,
  qty: number
) {
  const areaSqm = (widthMm * heightMm * qty) / 1_000_000;
  const calculated = areaSqm * item.perSqm;
  return Math.max(calculated, item.minCharge);
}

export type ProductCatalogCsvInput = Record<string, string>;

function normalizeCsvHeader(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function normalizeProductCatalogItem(
  input: ProductCatalogCsvInput,
  lineNumber: number
): ProductCatalogItem {
  const label = normalizeWhitespace(input.label);
  if (!label) {
    throw new Error("missing label");
  }

  const category = normalizeWhitespace(input.category) || "custom";
  const categoryLabel =
    normalizeWhitespace(input.category_label || input.categorylabel) || category;
  const generatedValue = buildGeneratedProductValue(
    input.value,
    label,
    category,
    lineNumber
  );

  const fallbackPricing =
    PRICING[generatedValue] || PRICING[input.value || ""] || DEFAULT_OTHER_PRICING;

  return {
    value: generatedValue,
    label,
    category,
    categoryLabel,
    description: normalizeWhitespace(input.description),
    keywords: splitKeywords(input.keywords),
    perSqm: parseNumber(input.per_sqm || input.persqm, fallbackPricing.perSqm),
    minCharge: parseNumber(
      input.min_charge || input.mincharge,
      fallbackPricing.minCharge
    ),
    active: parseBoolean(input.active, true),
    sortOrder: parseNumber(input.sort_order || input.sortorder, lineNumber),
  };
}

export function parseProductCatalogCsv(csvText: string) {
  const normalizedText = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return {
      items: [] as ProductCatalogItem[],
      errors: ["CSV ว่างเปล่า"],
    };
  }

  const headers = parseCsvLine(rawLines[0]).map(normalizeCsvHeader);
  const items: ProductCatalogItem[] = [];
  const errors: string[] = [];

  for (let index = 1; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    const values = parseCsvLine(line);
    const row: ProductCatalogCsvInput = {};

    headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex] || "";
    });

    try {
      items.push(normalizeProductCatalogItem(row, index));
    } catch (error) {
      errors.push(
        `แถว ${index + 1}: ${error instanceof Error ? error.message : "invalid row"}`
      );
    }
  }

  return { items, errors };
}