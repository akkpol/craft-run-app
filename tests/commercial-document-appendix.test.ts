import assert from "node:assert/strict";
import test from "node:test";

import { resolveCommercialDocumentAppendixSnapshot } from "../src/lib/commercial-document-appendix.ts";

test("resolveCommercialDocumentAppendixSnapshot prefers the per-order lead image", () => {
  const appendix = resolveCommercialDocumentAppendixSnapshot({
    leadAiGeneratedImages: [
      "https://example.com/per-order-preview.png",
      "https://example.com/unused-second-image.png",
    ],
    documentAppendixImageUrl: "https://example.com/settings-appendix.png",
    documentAppendixImageName: "settings-appendix.png",
  });

  assert.deepEqual(appendix, {
    image_url: "https://example.com/per-order-preview.png",
    image_name: null,
    source: "lead_ai_generated_images",
  });
});

test("resolveCommercialDocumentAppendixSnapshot falls back to the configured settings appendix", () => {
  const appendix = resolveCommercialDocumentAppendixSnapshot({
    leadAiGeneratedImages: [],
    documentAppendixImageUrl: "https://example.com/settings-appendix.png",
    documentAppendixImageName: "settings-appendix.png",
  });

  assert.deepEqual(appendix, {
    image_url: "https://example.com/settings-appendix.png",
    image_name: "settings-appendix.png",
    source: "app_settings",
  });
});

test("resolveCommercialDocumentAppendixSnapshot returns null when no appendix image is available", () => {
  const appendix = resolveCommercialDocumentAppendixSnapshot({
    leadAiGeneratedImages: [""],
    documentAppendixImageUrl: "",
    documentAppendixImageName: "",
  });

  assert.equal(appendix, null);
});
