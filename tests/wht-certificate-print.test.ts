import assert from "node:assert/strict";
import test from "node:test";

import { buildWhtCertificatePrintModel } from "../src/lib/wht-certificate-print.ts";

const source = {
  payment: {
    id: "payment-12345678",
    amount: 970,
    wht_amount: 30,
    paid_at: "2026-05-15T10:00:00.000Z",
    currency: "THB",
  },
  receiver_entity: {
    legal_name: "Receiver Co., Ltd.",
    type: "company",
    tax_id: "0105561234567",
    address: "Bangkok",
    branch_type: "HEAD_OFFICE",
  },
  withholder: {
    billing_name: "Customer Co., Ltd.",
    tax_id: "0105555555999",
    billing_address: "Chiang Mai",
    billing_entity_type: "company",
    customer_display_name: "Customer",
  },
  quote: {
    id: "quote-1",
    wht_rate: 0.03,
  },
};

test("buildWhtCertificatePrintModel picks PND 3 from a personal-account payee even when the payer is a company", () => {
  const model = buildWhtCertificatePrintModel({
    ...source,
    receiver_entity: {
      ...source.receiver_entity,
      legal_name: "Personal Receiver",
      type: "person",
    },
    withholder: {
      ...source.withholder,
      billing_entity_type: "company",
    },
  });

  assert.ok(model);
  assert.equal(model.withholder.formType, "ภ.ง.ด.3");
  assert.equal(model.withholder.formTypeLabel, "ภ.ง.ด.3 (บุคคลธรรมดา)");
});

test("buildWhtCertificatePrintModel picks PND 53 from a company payee even when the payer is an individual", () => {
  const model = buildWhtCertificatePrintModel({
    ...source,
    receiver_entity: {
      ...source.receiver_entity,
      type: "company",
    },
    withholder: {
      ...source.withholder,
      billing_entity_type: "person",
    },
  });

  assert.ok(model);
  assert.equal(model.withholder.formType, "ภ.ง.ด.53");
  assert.equal(model.withholder.formTypeLabel, "ภ.ง.ด.53 (นิติบุคคล)");
});

test("buildWhtCertificatePrintModel is not applicable when no WHT was withheld", () => {
  assert.equal(
    buildWhtCertificatePrintModel({
      ...source,
      payment: {
        ...source.payment,
        wht_amount: 0,
      },
    }),
    null
  );
});
