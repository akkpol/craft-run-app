type LeadPromptContext = {
  product_type?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  qty?: number | null;
  note_from_form?: string | null;
  reference_info?: string | null;
  design_brief?: string | null;
  ai_image_prompt?: string | null;
  ai_prompt_snapshot?: string | null;
};

type PreparedLeadAiPrompt = {
  prompt: string;
  seed: "snapshot" | "explicit_prompt" | "design_brief" | "structured";
};

function normalizePromptValue(value: string | null | undefined): string {
  return value?.trim() || "";
}

const PRODUCT_PROMPT_METADATA: Record<
  string,
  { label: string; categoryLabel: string }
> = {
  vinyl_banner: { label: "ป้ายไวนิล", categoryLabel: "ป้ายและหน้าร้าน" },
  acrylic_sign: { label: "ป้ายอะคริลิค", categoryLabel: "ป้ายและหน้าร้าน" },
  sticker: { label: "สติ๊กเกอร์", categoryLabel: "สติ๊กเกอร์และฉลาก" },
  foam_board: { label: "ฟิวเจอร์บอร์ด", categoryLabel: "บอร์ดและดิสเพลย์" },
  aluminium: { label: "ป้ายอลูมิเนียม", categoryLabel: "ป้ายและหน้าร้าน" },
  other: { label: "อื่นๆ", categoryLabel: "งานพิเศษ" },
};

export function hasLeadAiSeedPrompt(lead: LeadPromptContext): boolean {
  return Boolean(
    normalizePromptValue(lead.ai_prompt_snapshot) ||
      normalizePromptValue(lead.ai_image_prompt) ||
      normalizePromptValue(lead.design_brief)
  );
}

export function hasLeadAiPromptContext(lead: LeadPromptContext): boolean {
  return Boolean(prepareLeadAiPrompt(lead));
}

export function getLeadDesignRoutingSummary(lead: LeadPromptContext): string {
  return prepareLeadAiPrompt(lead)
    ? "มี AI prompt พร้อมใช้งาน"
    : "คิวนี้ขยับต่อด้วยทีมออกแบบได้ทันที";
}

function resolveProductPromptContext(productType: string | null | undefined) {
  const product = productType ? PRODUCT_PROMPT_METADATA[productType] : null;

  return {
    productLabel: product?.label || normalizePromptValue(productType),
    categoryLabel: product?.categoryLabel || "",
  };
}

export function prepareLeadAiPrompt(
  lead: LeadPromptContext
): PreparedLeadAiPrompt | null {
  const promptSnapshot = normalizePromptValue(lead.ai_prompt_snapshot);
  if (promptSnapshot) {
    return {
      prompt: promptSnapshot,
      seed: "snapshot",
    };
  }

  const explicitPrompt = normalizePromptValue(lead.ai_image_prompt);
  const designBrief = normalizePromptValue(lead.design_brief);
  const noteFromForm = normalizePromptValue(lead.note_from_form);
  const referenceInfo = normalizePromptValue(lead.reference_info);
  const { productLabel, categoryLabel } = resolveProductPromptContext(
    lead.product_type
  );
  const hasStructuredContext = Boolean(
    productLabel ||
      (lead.width_mm && lead.height_mm) ||
      lead.qty ||
      noteFromForm ||
      referenceInfo
  );

  if (!explicitPrompt && !designBrief && !hasStructuredContext) {
    return null;
  }

  const structuredPrompt = productLabel
    ? `สร้าง mockup งาน${productLabel}${categoryLabel ? ` สำหรับ${categoryLabel}` : ""} ที่ดูพร้อมผลิตและเหมาะกับงานลูกค้าจริง`
    : "Create a polished Thai signage or print concept mockup, front-facing, realistic materials, readable layout, production-friendly composition.";

  const parts = [
    explicitPrompt || designBrief || structuredPrompt,
    explicitPrompt && designBrief ? `Design brief: ${designBrief}` : "",
    productLabel ? `ประเภทงาน: ${productLabel}` : "",
    categoryLabel ? `หมวดงาน: ${categoryLabel}` : "",
    lead.width_mm && lead.height_mm
      ? `ขนาดงานประมาณ ${(lead.width_mm / 10).toFixed(1)} x ${(lead.height_mm / 10).toFixed(1)} ซม.`
      : "",
    lead.qty ? `จำนวน ${lead.qty} ชิ้น` : "",
    noteFromForm ? `รายละเอียดจากลูกค้า: ${noteFromForm}` : "",
    referenceInfo ? `ข้อมูลอ้างอิง: ${referenceInfo}` : "",
    "Create a polished Thai signage or print concept mockup, front-facing, realistic materials, readable layout, production-friendly composition.",
  ];

  return {
    prompt: parts.filter(Boolean).join("\n"),
    seed: explicitPrompt
      ? "explicit_prompt"
      : designBrief
        ? "design_brief"
        : "structured",
  };
}

export function getLeadAiDisplayPrompt(lead: LeadPromptContext): string {
  return prepareLeadAiPrompt(lead)?.prompt || "";
}

export function composeLeadAiPrompt(lead: LeadPromptContext): string {
  return getLeadAiDisplayPrompt(lead);
}

export type { LeadPromptContext, PreparedLeadAiPrompt };
