import test from "node:test";
import assert from "node:assert/strict";

import {
  composeLeadAiPrompt,
  hasLeadAiPromptContext,
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
      design_brief: "แบนเนอร์งานเปิดตัวสินค้า",
    }),
    true
  );
});