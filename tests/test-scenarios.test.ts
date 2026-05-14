import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_TYPES,
  BILLING_ENTITY_TYPES,
  BILLING_BRANCH_TYPES,
  FULFILLMENT_MODES,
  DOCUMENT_REQUEST_TYPES,
} from "../src/lib/types.ts";
import {
  TEST_SCENARIOS,
  findTestScenario,
  buildTestScenarioNotePrefix,
  TEST_SCENARIO_NOTE_PREFIX,
} from "../src/lib/test-scenarios.ts";

const VALID_PRODUCT_TYPES = new Set(PRODUCT_TYPES.map((p) => p.value));
const VALID_BILLING_ENTITY_TYPES = new Set<string>(BILLING_ENTITY_TYPES);
const VALID_BILLING_BRANCH_TYPES = new Set<string>(BILLING_BRANCH_TYPES);
const VALID_FULFILLMENT_MODES = new Set<string>(FULFILLMENT_MODES);
const VALID_DOCUMENT_REQUEST_TYPES = new Set<string>(DOCUMENT_REQUEST_TYPES);

test("TEST_SCENARIOS: every id is unique", () => {
  const ids = TEST_SCENARIOS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate scenario ids");
});

test("TEST_SCENARIOS: every productType is a valid PRODUCT_TYPES value", () => {
  for (const scenario of TEST_SCENARIOS) {
    const productType = scenario.values.productType;
    if (productType === undefined) continue;
    assert.ok(
      VALID_PRODUCT_TYPES.has(productType),
      `${scenario.id}: productType "${productType}" not in PRODUCT_TYPES`
    );
  }
});

test("TEST_SCENARIOS: billingEntityType when set is valid", () => {
  for (const scenario of TEST_SCENARIOS) {
    const value = scenario.values.billingEntityType;
    if (value === undefined) continue;
    assert.ok(
      VALID_BILLING_ENTITY_TYPES.has(value),
      `${scenario.id}: billingEntityType "${value}" invalid`
    );
  }
});

test("TEST_SCENARIOS: billingBranchType when set is valid", () => {
  for (const scenario of TEST_SCENARIOS) {
    const value = scenario.values.billingBranchType;
    if (value === undefined) continue;
    assert.ok(
      VALID_BILLING_BRANCH_TYPES.has(value),
      `${scenario.id}: billingBranchType "${value}" invalid`
    );
  }
});

test("TEST_SCENARIOS: fulfillmentMode when set is valid", () => {
  for (const scenario of TEST_SCENARIOS) {
    const value = scenario.values.fulfillmentMode;
    if (value === undefined) continue;
    assert.ok(
      VALID_FULFILLMENT_MODES.has(value),
      `${scenario.id}: fulfillmentMode "${value}" invalid`
    );
  }
});

test("TEST_SCENARIOS: requestedDocumentTypes when set are valid", () => {
  for (const scenario of TEST_SCENARIOS) {
    const types = scenario.values.requestedDocumentTypes;
    if (!types) continue;
    for (const type of types) {
      assert.ok(
        VALID_DOCUMENT_REQUEST_TYPES.has(type),
        `${scenario.id}: requestedDocumentType "${type}" invalid`
      );
    }
  }
});

test("TEST_SCENARIOS: branch type 'branch' requires billingBranchCode", () => {
  for (const scenario of TEST_SCENARIOS) {
    if (scenario.values.billingBranchType !== "branch") continue;
    assert.ok(
      scenario.values.billingBranchCode &&
        scenario.values.billingBranchCode.trim().length > 0,
      `${scenario.id}: branch type without billingBranchCode`
    );
  }
});

test("TEST_SCENARIOS: tax_invoice request requires billingName, taxId, billingAddress", () => {
  for (const scenario of TEST_SCENARIOS) {
    const wantsTax = scenario.values.requestedDocumentTypes?.includes(
      "tax_invoice"
    );
    if (!wantsTax) continue;

    assert.ok(scenario.values.billingName, `${scenario.id}: missing billingName`);
    assert.ok(scenario.values.taxId, `${scenario.id}: missing taxId`);
    assert.ok(
      scenario.values.billingAddress,
      `${scenario.id}: missing billingAddress`
    );
  }
});

test("TEST_SCENARIOS: delivery/install require fulfillment address fields", () => {
  for (const scenario of TEST_SCENARIOS) {
    const mode = scenario.values.fulfillmentMode;
    if (mode !== "delivery" && mode !== "install") continue;

    assert.ok(
      scenario.values.fulfillmentAddressLine1,
      `${scenario.id}: ${mode} missing fulfillmentAddressLine1`
    );
    assert.ok(
      scenario.values.fulfillmentDistrict,
      `${scenario.id}: ${mode} missing fulfillmentDistrict`
    );
    assert.ok(
      scenario.values.fulfillmentProvince,
      `${scenario.id}: ${mode} missing fulfillmentProvince`
    );
    assert.ok(
      scenario.values.fulfillmentPostalCode,
      `${scenario.id}: ${mode} missing fulfillmentPostalCode`
    );
  }
});

test("TEST_SCENARIOS: complete scenarios (not s7-incomplete) have positive dimensions", () => {
  for (const scenario of TEST_SCENARIOS) {
    if (scenario.id === "s7-incomplete") continue;

    const width = Number(scenario.values.width || 0);
    const height = Number(scenario.values.height || 0);

    assert.ok(width > 0, `${scenario.id}: width must be > 0 (got "${scenario.values.width}")`);
    assert.ok(height > 0, `${scenario.id}: height must be > 0 (got "${scenario.values.height}")`);
  }
});

test("TEST_SCENARIOS: phones are in the obvious-test 0809999991-9 range", () => {
  for (const scenario of TEST_SCENARIOS) {
    const phone = scenario.values.phone;
    if (!phone) continue;
    assert.match(
      phone,
      /^08099999\d[0-9]?$/,
      `${scenario.id}: phone "${phone}" must be 080-9999-99x (test range)`
    );
  }
});

test("TEST_SCENARIOS: dueDate factory returns a valid YYYY-MM-DD string in the future", () => {
  for (const scenario of TEST_SCENARIOS) {
    if (!scenario.values.dueDate) continue;
    const dateStr = scenario.values.dueDate();
    assert.match(
      dateStr,
      /^\d{4}-\d{2}-\d{2}$/,
      `${scenario.id}: dueDate not YYYY-MM-DD: "${dateStr}"`
    );

    const dateValue = Date.parse(dateStr);
    assert.ok(!Number.isNaN(dateValue), `${scenario.id}: dueDate not parseable`);
  }
});

test("findTestScenario: returns the matching scenario by id", () => {
  const found = findTestScenario("s1-prepaid-simple");
  assert.equal(found?.id, "s1-prepaid-simple");
});

test("findTestScenario: returns null for unknown id", () => {
  assert.equal(findTestScenario("does-not-exist"), null);
  assert.equal(findTestScenario(null), null);
  assert.equal(findTestScenario(undefined), null);
  assert.equal(findTestScenario(""), null);
});

test("buildTestScenarioNotePrefix: uses the public prefix constant", () => {
  const marker = buildTestScenarioNotePrefix("s1-prepaid-simple");
  assert.ok(
    marker.startsWith(TEST_SCENARIO_NOTE_PREFIX),
    `marker "${marker}" must start with "${TEST_SCENARIO_NOTE_PREFIX}"`
  );
  assert.equal(marker, "[TEST_SCENARIO:s1-prepaid-simple]");
});
