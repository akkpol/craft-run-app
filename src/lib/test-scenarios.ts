/**
 * Test scenario library for LIFF intake autofill.
 *
 * Used by the scenario picker (chip + sheet UI) in /liff/intake to let an
 * operator/developer pre-fill the form with one tap during real-device testing.
 *
 * Constraints:
 *  - Data only — no JSX, no React imports.
 *  - Every `productType` must exist in PRODUCT_TYPES (see src/lib/types.ts).
 *  - All scenarios use phone numbers in the 0809999991-0809999999 range so
 *    they cannot collide with real customer phone numbers.
 *  - Tax IDs use the obvious test pattern "0xxxxxxxxxxxx" (1 leading + 12 zeros)
 *    so they can be filtered out of accounting exports.
 *  - The "s7-incomplete" scenario intentionally omits dimensions to exercise the
 *    ON_HOLD_CUSTOMER_INPUT branch in /api/intake.
 *
 * Adding a new scenario:
 *  1. Add it to TEST_SCENARIOS below.
 *  2. The unit test in tests/test-scenarios.test.ts will validate shape.
 *  3. The picker UI surfaces it automatically — no further wiring needed.
 */

import type { DocumentRequestType } from "@/lib/document-request";
import type {
  BillingBranchType,
  BillingEntityType,
  FulfillmentMode,
} from "@/lib/types";

export type TestScenarioValues = {
  productType?: string;
  width?: string;
  height?: string;
  unit?: string;
  qty?: string;
  /** Function so each apply call gets a fresh date offset from "today". */
  dueDate?: () => string;
  phone?: string;
  billingEntityType?: BillingEntityType;
  billingBranchType?: BillingBranchType;
  billingBranchCode?: string;
  requestedDocumentTypes?: DocumentRequestType[];
  billingName?: string;
  taxId?: string;
  billingAddress?: string;
  fulfillmentMode?: FulfillmentMode;
  fulfillmentAddressLine1?: string;
  fulfillmentAddressLine2?: string;
  fulfillmentSubdistrict?: string;
  fulfillmentDistrict?: string;
  fulfillmentProvince?: string;
  fulfillmentPostalCode?: string;
  designBrief?: string;
  note?: string;
};

export type TestScenario = {
  id: string;
  label: string;
  description: string;
  values: TestScenarioValues;
};

/**
 * Returns YYYY-MM-DD in Asia/Bangkok timezone, offset by `daysFromToday`.
 * Matches the format the intake form expects for the dueDate input.
 */
function bangkokDateOffset(daysFromToday: number): () => string {
  return () => {
    const now = new Date();
    const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    bangkokNow.setUTCDate(bangkokNow.getUTCDate() + daysFromToday);
    return bangkokNow.toISOString().slice(0, 10);
  };
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: "s1-prepaid-simple",
    label: "s1 · บุคคล/สติกเกอร์/prepaid",
    description: "Fast-path flow — prepaid, no tax invoice, pickup",
    values: {
      productType: "sticker",
      width: "10",
      height: "10",
      unit: "cm",
      qty: "100",
      dueDate: bangkokDateOffset(7),
      phone: "0809999991",
      billingEntityType: "person",
      requestedDocumentTypes: ["quote"],
      fulfillmentMode: "pickup",
      designBrief: "สติกเกอร์โลโก้ร้านกาแฟ พื้นขาว ตัวอักษรน้ำตาล",
      note: "เทสต์ s1",
    },
  },
  {
    id: "s2-deposit-company-vat-head",
    label: "s2 · บริษัทสำนักงานใหญ่/ใบกำกับ/deposit",
    description: "VAT entity, head office, pickup",
    values: {
      productType: "vinyl_banner",
      width: "200",
      height: "100",
      unit: "cm",
      qty: "1",
      dueDate: bangkokDateOffset(10),
      phone: "0809999992",
      billingEntityType: "company",
      billingBranchType: "head_office",
      requestedDocumentTypes: ["tax_invoice"],
      billingName: "บริษัท ทดสอบ จำกัด (สำนักงานใหญ่)",
      taxId: "0000000000001",
      billingAddress: "123 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพมหานคร 10000",
      fulfillmentMode: "pickup",
      designBrief: "ไวนิลโปรโมชั่นเปิดสาขาใหม่ ลายสีน้ำเงิน-เหลือง",
      note: "เทสต์ s2",
    },
  },
  {
    id: "s3-deposit-company-vat-branch",
    label: "s3 · บริษัทสาขา/ใบกำกับ/deposit",
    description: "Branch entity — exercises branch_code required path",
    values: {
      productType: "acrylic_sign",
      width: "50",
      height: "30",
      unit: "cm",
      qty: "2",
      dueDate: bangkokDateOffset(14),
      phone: "0809999993",
      billingEntityType: "company",
      billingBranchType: "branch",
      billingBranchCode: "00001",
      requestedDocumentTypes: ["tax_invoice"],
      billingName: "บริษัท ทดสอบ จำกัด (สาขา 00001)",
      taxId: "0000000000001",
      billingAddress: "456 ถนนสาขาทดสอบ แขวงสาขา เขตสาขา กรุงเทพมหานคร 10110",
      fulfillmentMode: "pickup",
      designBrief: "ป้ายอะคริลิคบริษัทสาขา",
      note: "เทสต์ s3",
    },
  },
  {
    id: "s4-credit-person-pickup",
    label: "s4 · บุคคล/credit/รับเอง",
    description: "Credit term — quote approval unlocks production immediately",
    values: {
      productType: "vinyl_banner",
      width: "300",
      height: "150",
      unit: "cm",
      qty: "1",
      dueDate: bangkokDateOffset(5),
      phone: "0809999994",
      billingEntityType: "person",
      requestedDocumentTypes: ["quote"],
      fulfillmentMode: "pickup",
      designBrief: "ป้ายไวนิลโฆษณาขนาดใหญ่ ตัวอักษรหนา อ่านชัดจากระยะไกล",
      note: "เทสต์ s4",
    },
  },
  {
    id: "s5-prepaid-delivery",
    label: "s5 · บุคคล/prepaid/จัดส่ง",
    description: "Delivery address required",
    values: {
      productType: "sticker",
      width: "5",
      height: "5",
      unit: "cm",
      qty: "500",
      dueDate: bangkokDateOffset(10),
      phone: "0809999995",
      billingEntityType: "person",
      requestedDocumentTypes: ["quote"],
      fulfillmentMode: "delivery",
      fulfillmentAddressLine1: "789 ถนนจัดส่ง คอนโดทดสอบ ห้อง 5/01",
      fulfillmentSubdistrict: "ทดสอบเหนือ",
      fulfillmentDistrict: "พระโขนง",
      fulfillmentProvince: "กรุงเทพมหานคร",
      fulfillmentPostalCode: "10110",
      designBrief: "สติกเกอร์ฉลากสินค้า ขนาด 5x5 ซม. ใส่ชื่อแบรนด์",
      note: "เทสต์ s5",
    },
  },
  {
    id: "s6-deposit-install-tax",
    label: "s6 · บริษัท/ใบกำกับ/ติดตั้ง",
    description: "Install + VAT combo — full commercial path",
    values: {
      productType: "aluminium",
      width: "400",
      height: "200",
      unit: "cm",
      qty: "1",
      dueDate: bangkokDateOffset(21),
      phone: "0809999996",
      billingEntityType: "company",
      billingBranchType: "head_office",
      requestedDocumentTypes: ["tax_invoice"],
      billingName: "บริษัท ติดตั้งทดสอบ จำกัด",
      taxId: "0000000000002",
      billingAddress: "999 ถนนติดตั้ง แขวงหน้าร้าน เขตติดตั้ง กรุงเทพมหานคร 10240",
      fulfillmentMode: "install",
      fulfillmentAddressLine1: "999 ถนนติดตั้ง หน้าอาคารทดสอบ ติดตั้งกลางแจ้ง",
      fulfillmentSubdistrict: "หน้าร้าน",
      fulfillmentDistrict: "ติดตั้ง",
      fulfillmentProvince: "กรุงเทพมหานคร",
      fulfillmentPostalCode: "10240",
      designBrief: "ป้ายอลูมิเนียมหน้าร้าน ทนแดดทนฝน",
      note: "เทสต์ s6",
    },
  },
  {
    id: "s7-incomplete",
    label: "s7 · ข้อมูลไม่ครบ (ทดสอบ ON_HOLD)",
    description: "Intentionally missing width — exercises ON_HOLD_CUSTOMER_INPUT",
    values: {
      productType: "sticker",
      // width omitted intentionally
      height: "10",
      unit: "cm",
      qty: "10",
      dueDate: bangkokDateOffset(7),
      phone: "0809999997",
      billingEntityType: "person",
      requestedDocumentTypes: ["quote"],
      fulfillmentMode: "pickup",
      note: "เทสต์ s7 (ตั้งใจไม่ใส่ขนาดกว้าง)",
    },
  },
];

export function findTestScenario(id: string | null | undefined): TestScenario | null {
  if (!id) {
    return null;
  }
  return TEST_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

/** Marker prefix prepended to the `note` field so admin can filter test entries. */
export const TEST_SCENARIO_NOTE_PREFIX = "[TEST_SCENARIO";

export function buildTestScenarioNotePrefix(id: string): string {
  return `${TEST_SCENARIO_NOTE_PREFIX}:${id}]`;
}
