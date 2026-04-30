import test from "node:test";
import assert from "node:assert/strict";

import {
  composeLeadAiPrompt,
  getLeadAiDisplayPrompt,
  getLeadDesignRoutingSummary,
  hasLeadAiPromptContext,
  hasLeadAiSeedPrompt,
  prepareLeadAiPrompt,
} from "../src/lib/lead-ai-prompt.ts";

test("composeLeadAiPrompt falls back to design brief when explicit prompt is missing", () => {
  const prompt = composeLeadAiPrompt({
    product_type: "signage",
    width_mm: 1200,
    height_mm: 600,
    qty: 1,
    design_brief: "ป้ายร้านกาแฟมินิมอล โทนไม้ โลโก้สีขาว",
    ai_image_prompt: null,
    note_from_form: "ใช้หน้าร้านคาเฟ่ใหม่",
    reference_info: null,
  });

  assert.match(prompt, /ป้ายร้านกาแฟมินิมอล/);
  assert.match(prompt, /ประเภทงาน: signage/);
  assert.match(prompt, /รายละเอียดจากลูกค้า: ใช้หน้าร้านคาเฟ่ใหม่/);
});

test("composeLeadAiPrompt keeps explicit prompt first and carries design brief as supporting context", () => {
  const prompt = composeLeadAiPrompt({
    product_type: "sticker",
    width_mm: 500,
    height_mm: 500,
    qty: 10,
    design_brief: "เน้นโทน playful",
    ai_image_prompt: "สร้างสติ๊กเกอร์ die-cut คาแรกเตอร์แมวสีส้ม",
    note_from_form: null,
    reference_info: "มีไฟล์ logo เดิม",
  });

  assert.match(prompt, /^สร้างสติ๊กเกอร์ die-cut คาแรกเตอร์แมวสีส้ม/);
  assert.match(prompt, /Design brief: เน้นโทน playful/);
  assert.match(prompt, /ข้อมูลอ้างอิง: มีไฟล์ logo เดิม/);
});

test("hasLeadAiPromptContext detects design-ready input without explicit AI prompt", () => {
  assert.equal(
    hasLeadAiPromptContext({
      product_type: "banner",
      width_mm: 2000,
      height_mm: 1000,
      qty: 1,
    }),
    true
  );
});

test("prepareLeadAiPrompt creates a final prompt from design brief only", () => {
  const prepared = prepareLeadAiPrompt({
    product_type: "banner",
    width_mm: 2000,
    height_mm: 1000,
    qty: 1,
    design_brief: "แบนเนอร์งานเปิดตัวสินค้า โทนแดงดำ",
    ai_image_prompt: null,
    note_from_form: "ติดหน้าบูธ",
    reference_info: "ใช้โลโก้ไฟล์เดิม",
  });

  assert.equal(prepared?.seed, "design_brief");
  assert.match(prepared?.prompt || "", /แบนเนอร์งานเปิดตัวสินค้า โทนแดงดำ/);
  assert.match(prepared?.prompt || "", /รายละเอียดจากลูกค้า: ติดหน้าบูธ/);
});

test("getLeadAiDisplayPrompt prefers a stored prompt snapshot", () => {
  assert.equal(
    getLeadAiDisplayPrompt({
      ai_prompt_snapshot: "snapshot prompt",
      ai_image_prompt: "explicit prompt",
      design_brief: "design brief",
    }),
    "snapshot prompt"
  );
});

test("hasLeadAiSeedPrompt accepts design brief without explicit AI prompt", () => {
  assert.equal(
    hasLeadAiSeedPrompt({
      design_brief: "สรุปทิศทางงานหน้าร้าน",
      ai_image_prompt: null,
    }),
    true
  );
});

test("getLeadDesignRoutingSummary distinguishes AI-ready leads from manual design leads", () => {
  assert.equal(
    getLeadDesignRoutingSummary({
      product_type: "vinyl_banner",
      width_mm: 1200,
      height_mm: 600,
      qty: 1,
      ai_image_prompt: null,
    }),
    "มี AI prompt พร้อมใช้งาน"
  );

  assert.equal(
    getLeadDesignRoutingSummary({
      design_brief: null,
      ai_image_prompt: null,
      ai_prompt_snapshot: null,
    }),
    "คิวนี้ขยับต่อด้วยทีมออกแบบได้ทันที"
  );
});

test("prepareLeadAiPrompt creates a structured fallback from product and dimensions", () => {
  const prepared = prepareLeadAiPrompt({
    product_type: "vinyl_banner",
    width_mm: 1200,
    height_mm: 600,
    qty: 1,
    design_brief: null,
    ai_image_prompt: null,
    note_from_form: null,
    reference_info: null,
  });

  assert.equal(prepared?.seed, "structured");
  assert.match(prepared?.prompt || "", /ประเภทงาน: ป้ายไวนิล/);
  assert.match(prepared?.prompt || "", /ขนาดงานประมาณ 120.0 x 60.0 ซม\./);
});
