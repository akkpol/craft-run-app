import { describe, expect, it } from "vitest";

import { createFakeLineGateway } from "@/lib/fake-line-gateway";
import {
  documentScenario,
  escalationScenario,
  fullLifecycleScenarioDefinitions,
  newLeadScenario,
  paymentScenario,
  paymentRoutingScenarioDefinitions,
  quoteScenario,
  receiptFullLifecycle200Scenario,
  runCoreScenarios,
  runScenario,
  taxInvoiceFullLifecycle10000Scenario,
} from "@/lib/scenario-runner";

function getPaymentProfileSnapshot(result: Awaited<ReturnType<typeof runScenario>>) {
  return result.supabase.table("quotes")[0]?.payment_profile_snapshot as
    | Record<string, unknown>
    | null
    | undefined;
}

function actionPayload(row: Record<string, unknown>) {
  return row.payload as Record<string, unknown> | null;
}

describe("runScenario", () => {
  it("captures transport calls per step and preserves mutable state", async () => {
    const result = await runScenario({
      name: "new-lead-and-status",
      initialState: {
        stages: [] as string[],
      },
      lineGateway: createFakeLineGateway(),
      steps: [
        {
          key: "new-lead",
          title: "Reply to new lead",
          async run(context) {
            context.state.stages.push("new-lead");
            await context.lineGateway.replyMessage({
              replyToken: "reply-1",
              messages: [{ type: "text", text: "เริ่ม intake" }],
            });
          },
          assert(result) {
            expect(result.transportCalls).toHaveLength(1);
            expect(result.transportCalls[0]).toMatchObject({
              method: "replyMessage",
            });
          },
        },
        {
          key: "payment-status",
          title: "Push status update",
          async run(context) {
            context.state.stages.push("payment");
            await context.lineGateway.pushMessage({
              to: "user-1",
              messages: [{ type: "text", text: "รอชำระเงิน" }],
            });
          },
          assert(result, context) {
            expect(context.state.stages).toEqual(["new-lead", "payment"]);
            expect(result.transportCalls).toHaveLength(1);
            expect(result.transportCalls[0]).toMatchObject({
              method: "pushMessage",
            });
          },
        },
      ],
    });

    expect(result.name).toBe("new-lead-and-status");
    expect(result.steps).toHaveLength(2);
    expect(result.transportCalls).toHaveLength(2);
    expect(result.state.stages).toEqual(["new-lead", "payment"]);
  });

  it("runs new lead scenario through the webhook processor", async () => {
    const result = await runScenario(newLeadScenario);

    expect(result.state.stages).toEqual(["line-inbound-new-lead"]);
    expect(result.supabase.table("conversations")[0]).toMatchObject({
      line_user_id: "sim:line:user-001",
      state: "COLLECTING_REQUIREMENTS",
    });
    expect(result.transportCalls.some((call) => call.method === "replyMessage")).toBe(
      true
    );
  });

  it("runs quote scenario into the payment gate", async () => {
    const result = await runScenario(quoteScenario);

    expect(result.supabase.table("quotes")[0]).toMatchObject({
      status: "approved",
      payment_status: "unpaid",
    });
    expect(result.supabase.table("conversations")[0]).toMatchObject({
      state: "WAITING_PAYMENT",
    });
    expect(result.state.requiresPayment).toBe(true);
  });

  it("runs payment scenario into design with a job", async () => {
    const result = await runScenario(paymentScenario);

    expect(result.supabase.table("quotes")[0]).toMatchObject({
      payment_status: "paid",
    });
    expect(result.supabase.table("conversations")[0]).toMatchObject({
      state: "IN_DESIGN",
    });
    expect(result.supabase.table("jobs")[0]).toMatchObject({
      status: "IN_DESIGN",
    });
    expect(result.supabase.table("payments")[0]).toMatchObject({
      status: "CONFIRMED",
    });
    expect(result.supabase.table("commercial_orders")[0]).toHaveProperty(
      "payment_receiver_locked_at"
    );
    expect(result.supabase.table("quote_payment_records")[0]).toMatchObject({
      payment_status: "paid",
      proof_reference: `sim-proof-${result.runId}`,
    });
    expect(result.transportCalls.some((call) => call.method === "pushMessage")).toBe(
      true
    );
  });

  it("runs document scenario and sends a document link", async () => {
    const result = await runScenario(documentScenario);

    expect(result.supabase.table("commercial_documents")[0]).toMatchObject({
      status: "ISSUED",
      document_type: "TAX_INVOICE_RECEIPT",
    });
    expect(result.transportCalls.some((call) => call.method === "pushMessage")).toBe(
      true
    );
  });

  it.each([
    [
      paymentRoutingScenarioDefinitions[0],
      "secondary",
      "secondary_total_threshold",
    ],
    [paymentRoutingScenarioDefinitions[1], "primary", "default"],
    [paymentRoutingScenarioDefinitions[2], "secondary", "secondary_customer_scope"],
    [paymentRoutingScenarioDefinitions[3], "secondary", "secondary_payment_terms"],
  ])(
    "resolves payment routing for %s",
    async (definition, sourceProfile, reason) => {
      const result = await runScenario(definition);
      const snapshot = getPaymentProfileSnapshot(result);

      expect(snapshot).toMatchObject({
        sourceProfile,
        reason,
      });
      expect(
        result.transportCalls.some((call) => call.method === "pushMessage")
      ).toBe(true);
    }
  );

  it("runs receipt full lifecycle through production complete", async () => {
    const result = await runScenario(receiptFullLifecycle200Scenario);
    const snapshot = getPaymentProfileSnapshot(result);

    expect(snapshot).toMatchObject({
      sourceProfile: "secondary",
      reason: "secondary_total_threshold",
    });
    expect(result.supabase.table("commercial_documents")[0]).toMatchObject({
      status: "ISSUED",
      document_type: "RECEIPT",
    });
    expect(result.supabase.table("jobs")[0]).toMatchObject({
      status: "COMPLETED",
      production_status: "done",
      completion_package_status: "sent",
    });
    expect(result.supabase.table("leads")[0]).toMatchObject({
      status: "completed",
      design_status: "approved",
      ai_image_status: "generated",
    });
    expect(result.supabase.table("conversations")[0]).toMatchObject({
      state: "COMPLETED",
    });
    expect(
      result.supabase.table("action_log").some((row) => {
        const payload = actionPayload(row);
        return (
          row.action_type === "lead.design_preview_sent" &&
          payload?.simulation === true
        );
      })
    ).toBe(true);
  });

  it("runs tax invoice full lifecycle through production complete", async () => {
    const result = await runScenario(taxInvoiceFullLifecycle10000Scenario);
    const snapshot = getPaymentProfileSnapshot(result);

    expect(snapshot).toMatchObject({
      sourceProfile: "primary",
      reason: "default",
    });
    expect(result.supabase.table("customer_tax_profiles")).toHaveLength(1);
    expect(result.supabase.table("commercial_documents")[0]).toMatchObject({
      status: "ISSUED",
      document_type: "TAX_INVOICE_RECEIPT",
    });
    expect(result.supabase.table("quote_payment_records")[0]).toMatchObject({
      payment_status: "paid",
      proof_reference: `sim-proof-${result.runId}`,
    });
    expect(result.supabase.table("jobs")[0]).toMatchObject({
      status: "COMPLETED",
      production_status: "done",
      completion_package_status: "sent",
    });
    expect(
      result.transportCalls.filter((call) => call.method === "pushMessage").length
    ).toBeGreaterThanOrEqual(5);
  });

  it("keeps full lifecycle scenario action logs tagged as simulation runs", async () => {
    for (const definition of fullLifecycleScenarioDefinitions) {
      const result = await runScenario(definition);
      const simulationActions = result.supabase.table("action_log").filter((row) => {
        const payload = actionPayload(row);
        return payload?.simulation === true && payload.simulation_run_id === result.runId;
      });

      expect(simulationActions.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("runs escalation scenario into human review", async () => {
    const result = await runScenario(escalationScenario);

    expect(result.supabase.table("conversations")[0]).toMatchObject({
      state: "HUMAN_REVIEW_REQUIRED",
    });
    expect(result.supabase.table("escalations")[0]).toMatchObject({
      status: "open",
    });
  });

  it("tags core scenario action logs as simulation runs", async () => {
    const results = await runCoreScenarios();

    expect(results).toHaveLength(11);
    for (const result of results) {
      expect(
        result.supabase.table("action_log").some((row) => {
          const payload = row.payload as Record<string, unknown> | null;
          return payload?.simulation === true && payload.simulation_run_id === result.runId;
        })
      ).toBe(true);
    }
  });
});
