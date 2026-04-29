import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLeadPromptFields,
  parseMultipartIntakeFormData,
} from "../src/lib/intake-payload.ts";

test("parseMultipartIntakeFormData keeps design brief and advanced prompt values", () => {
  const formData = new FormData();
  formData.set("productType", "signage");
  formData.set("width", "1200");
  formData.set("height", "600");
  formData.set("unit", "mm");
  formData.set("qty", "2");
  formData.set("dueDate", "2026-05-01");
  formData.set("phone", "0812345678");
  formData.set("fulfillmentMode", "pickup");
  formData.set("designBrief", "ป้ายร้านกาแฟมินิมอล โทนไม้");
  formData.set("aiImagePrompt", "clean storefront sign mockup");
  formData.set("note", "ใช้หน้าร้านใหม่");
  formData.set("referenceInfo", "มีโลโก้เดิม");
  formData.append("referenceFiles", new File(["mock"], "ref.txt", { type: "text/plain" }));
  formData.append("referenceFiles", new File([""], "empty.txt", { type: "text/plain" }));

  const { data, customerMediaFiles } = parseMultipartIntakeFormData(formData);

  assert.equal(data.designBrief, "ป้ายร้านกาแฟมินิมอล โทนไม้");
  assert.equal(data.aiImagePrompt, "clean storefront sign mockup");
  assert.equal(data.note, "ใช้หน้าร้านใหม่");
  assert.equal(data.referenceInfo, "มีโลโก้เดิม");
  assert.equal(customerMediaFiles.length, 1);
  assert.equal(customerMediaFiles[0]?.name, "ref.txt");
});

test("buildLeadPromptFields keeps ai image status tied to explicit aiImagePrompt only", () => {
  assert.deepEqual(
    buildLeadPromptFields({
      designBrief: "แบนเนอร์โปรโมชัน โทนแดงทอง",
      aiImagePrompt: undefined,
      note: "ติดหน้าร้าน",
      referenceInfo: "ใช้ฟอนต์แบรนด์เดิม",
    }),
    {
      design_brief: "แบนเนอร์โปรโมชัน โทนแดงทอง",
      note_from_form: "ติดหน้าร้าน",
      reference_info: "ใช้ฟอนต์แบรนด์เดิม",
      ai_image_prompt: null,
      ai_image_status: "not_requested",
    }
  );

  assert.deepEqual(
    buildLeadPromptFields({
      designBrief: "แบนเนอร์โปรโมชัน โทนแดงทอง",
      aiImagePrompt: "cinematic promotional banner",
      note: "ติดหน้าร้าน",
      referenceInfo: "ใช้ฟอนต์แบรนด์เดิม",
    }),
    {
      design_brief: "แบนเนอร์โปรโมชัน โทนแดงทอง",
      note_from_form: "ติดหน้าร้าน",
      reference_info: "ใช้ฟอนต์แบรนด์เดิม",
      ai_image_prompt: "cinematic promotional banner",
      ai_image_status: "pending",
    }
  );
});