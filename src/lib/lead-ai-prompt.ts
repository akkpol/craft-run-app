type LeadPromptContext = {
  product_type?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  qty?: number | null;
  note_from_form?: string | null;
  reference_info?: string | null;
  design_brief?: string | null;
  ai_image_prompt?: string | null;
};

export function composeLeadAiPrompt(lead: LeadPromptContext): string {
  const explicitPrompt = lead.ai_image_prompt?.trim() || "";
  const designBrief = lead.design_brief?.trim() || "";
  const noteFromForm = lead.note_from_form?.trim() || "";
  const referenceInfo = lead.reference_info?.trim() || "";

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

  return parts.filter(Boolean).join("\n");
}

export function hasLeadAiPromptContext(lead: LeadPromptContext): boolean {
  return Boolean(
    lead.ai_image_prompt?.trim() ||
      lead.design_brief?.trim() ||
      lead.note_from_form?.trim() ||
      lead.reference_info?.trim() ||
      lead.product_type?.trim()
  );
}