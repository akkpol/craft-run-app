import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJobMediaStoragePath,
  buildLeadAiPreviewStoragePath,
  buildLeadCustomerReferenceStoragePath,
} from "../src/lib/asset-storage-paths.ts";

test("buildLeadCustomerReferenceStoragePath keeps customer uploads under a lead-scoped root", () => {
  const path = buildLeadCustomerReferenceStoragePath("lead-123", "My Ref File.png", {
    now: 123,
    nonce: "nonce",
  });

  assert.equal(
    path,
    "leads/lead-123/customer-reference/123-nonce-My-Ref-File.png"
  );
});

test("buildLeadAiPreviewStoragePath keeps generated previews under a lead-scoped root", () => {
  const path = buildLeadAiPreviewStoragePath("lead-123", "png", {
    now: 456,
    nonce: "nonce",
  });

  assert.equal(path, "leads/lead-123/ai-preview/456-nonce.png");
});

test("buildJobMediaStoragePath keeps production assets under a job event root", () => {
  const path = buildJobMediaStoragePath("job-123", "event-456", "proof 1.jpg", {
    now: 789,
    nonce: "nonce",
  });

  assert.equal(
    path,
    "jobs/job-123/events/event-456/789-nonce-proof-1.jpg"
  );
});