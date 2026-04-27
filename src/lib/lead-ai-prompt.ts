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
  seed: "snapshot" | "explicit_prompt" | "design_brief";
};

function normalizePromptValue(value: string | null | undefined): string {
  return value?.trim() || "";
}

export function hasLeadAiSeedPrompt(lead: LeadPromptContext): boolean {
  return Boolean(
    normalizePromptValue(lead.ai_prompt_snapshot) ||
      normalizePromptValue(lead.ai_image_prompt) ||
      normalizePromptValue(lead.design_brief)
  );
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
  if (!explicitPrompt && !designBrief) {
    return null;
  }

  const noteFromForm = normalizePromptValue(lead.note_from_form);
  const referenceInfo = normalizePromptValue(lead.reference_info);

  const parts = [
    explicitPrompt || designBrief,
    explicitPrompt && designBrief ? `Design brief: ${designBrief}` : "",
    lead.product_type ? `ประเภทงาน: ${lead.product_type}` : "",
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
    seed: explicitPrompt ? "explicit_prompt" : "design_brief",
  };
}

export function getLeadAiDisplayPrompt(lead: LeadPromptContext): string {
  return prepareLeadAiPrompt(lead)?.prompt || "";
}

export function composeLeadAiPrompt(lead: LeadPromptContext): string {
  return getLeadAiDisplayPrompt(lead);
}

export function hasLeadAiPromptContext(lead: LeadPromptContext): boolean {
  return Boolean(
    hasLeadAiSeedPrompt(lead) ||
      normalizePromptValue(lead.note_from_form) ||
      normalizePromptValue(lead.reference_info) ||
      normalizePromptValue(lead.product_type)
  );
}

export type { LeadPromptContext, PreparedLeadAiPrompt };