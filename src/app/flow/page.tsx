import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import { getAllowedActions, getWorkflowPolicy } from "@/lib/workflow-policy";

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-flow-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-flow-mono",
});

export const metadata: Metadata = {
  title: "FOGUS Canonical Workflow Reference",
  description: "Canonical workflow reference derived from the current FOGUS runtime policy.",
};

const canonicalPolicyDoc = "docs/workflow-policy.json";
const derivativeTableDoc = "docs/WORKFLOW_TRANSITION_TABLE.md";
const agentReadableNote =
  "This page is derived from docs/workflow-policy.json. Do not use this page as a policy source — read the JSON directly.";

type WorkflowPolicyData = {
  meta: {
    canonicalSources: string[];
    mainPath: string[];
    branches: string[];
    notes: string[];
  };
  conversation: {
    states: string[];
    terminalStates: string[];
    transitions: Record<string, string[]>;
  };
  quote_payment: {
    paymentTerms: string[];
    unlockRules: Record<string, string[]>;
    approvalDecisions: {
      unlockedNextState: string;
      lockedNextState: string;
    };
  };
  policies: {
    guardRails: string[];
  };
};

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function StatePill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "branch" | "terminal";
}) {
  const classes =
    tone === "terminal"
      ? "bg-slate-950 text-white"
      : tone === "branch"
        ? "bg-amber-100 text-amber-800"
        : "bg-[#f5f4f0] text-slate-700";

  return (
    <span
      className={`inline-flex rounded-xl px-3 py-2 text-xs font-semibold tracking-[0.08em] [font-family:var(--font-flow-mono)] ${classes}`}
    >
      {label}
    </span>
  );
}

function ReferenceList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="rounded-xl bg-[#f5f4f0] px-3 py-2 [font-family:var(--font-flow-mono)]">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function FlowPage() {
  const policy = getWorkflowPolicy() as WorkflowPolicyData;
  const flowPageActions = getAllowedActions({
    actor: "dev_ai",
    surface: "flow_page",
  });

  const mainPath = policy.meta.mainPath.map((segment) => segment.split("|"));
  const sideBranches = policy.meta.branches.map((state) => ({
    state,
    nextStates: policy.conversation.transitions[state] ?? [],
  }));
  const transitionRows = policy.conversation.states.map((state) => ({
    state,
    nextStates: policy.conversation.transitions[state] ?? [],
  }));
  const paymentRules = policy.quote_payment.paymentTerms.map((term) => ({
    term,
    unlockStatuses: policy.quote_payment.unlockRules[term] ?? [],
  }));
  const approvalOutcomes = policy.quote_payment.approvalDecisions;
  const canonicalSources = policy.meta.canonicalSources;

  return (
    <main
      className={`${plexSansThai.variable} ${jetBrainsMono.variable} min-h-screen bg-[#fafaf8] text-slate-950 [font-family:var(--font-flow-sans)]`}
    >
      <section className="relative overflow-hidden bg-[#1a1a2e] px-6 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(245,158,11,0.18),transparent_24%),radial-gradient(circle_at_82%_65%,rgba(16,185,129,0.18),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            FOGUS Workflow Reference
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Canonical workflow reference derived from the current runtime policy
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
            This page is a read-only reference for humans and agents. It summarizes the active workflow path,
            side branches, payment gate behavior, and policy guard rails without changing runtime logic.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                Agent-readable note
              </p>
              <p
                data-policy-source-note={agentReadableNote}
                className="mt-2 rounded-xl bg-white/80 px-3 py-3 font-semibold [font-family:var(--font-flow-mono)]"
              >
                {agentReadableNote}
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm leading-7 text-white/88">
              <p className="font-semibold">Current flow-page policy intent</p>
              <p className="mt-2">{flowPageActions.ui_intent}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flowPageActions.allowed_actions.map((action) => (
                  <span
                    key={action}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs [font-family:var(--font-flow-mono)]"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 border-b border-[#e8e6df] bg-[#fafaf8]/90 px-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto py-3 text-sm text-slate-600">
          {[
            ["#sources", "Sources"],
            ["#main-path", "Main path"],
            ["#branches", "Side branches"],
            ["#payment-gate", "Payment gate"],
            ["#states", "States"],
            ["#guard-rails", "Guard rails"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-full px-4 py-2 transition hover:bg-white hover:text-slate-950"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-6">
        <section id="sources" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Canonical sources"
            title="Render the policy metadata exactly"
            description="The list below mirrors meta.canonicalSources exactly. The JSON policy is labeled separately because it remains the canonical machine-readable source."
          />

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Exact meta.canonicalSources list
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                  {canonicalSources.length} paths
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                No extra paths are added here. This list stays one-to-one with policy metadata.
              </p>
              <div className="mt-4">
                <ReferenceList items={canonicalSources} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Canonical machine-readable policy
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {canonicalPolicyDoc} is the canonical machine-readable policy.
                </p>
                <div className="mt-4 rounded-xl bg-white px-3 py-3 text-sm [font-family:var(--font-flow-mono)] text-slate-800">
                  {canonicalPolicyDoc}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                  Human-readable derivative
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {derivativeTableDoc} is a human-readable derivative, not source of truth.
                </p>
                <div className="mt-4 rounded-xl bg-white px-3 py-3 text-sm [font-family:var(--font-flow-mono)] text-slate-800">
                  {derivativeTableDoc}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="main-path" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Main path"
            title="Current canonical workflow path"
            description="This sequence is rendered directly from policy.meta.mainPath so the page stays aligned with the active workflow contract."
          />

          <div className="flex flex-wrap items-center gap-2">
            {mainPath.map((options, index) => (
              <div key={`${options.join("-")}-${index}`} className="contents">
                {options.length === 1 ? (
                  <StatePill
                    label={options[0]}
                    tone={policy.conversation.terminalStates.includes(options[0]) ? "terminal" : "default"}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2">
                    {options.map((option, optionIndex) => (
                      <div key={option} className="flex items-center gap-2">
                        <StatePill label={option} />
                        {optionIndex < options.length - 1 ? (
                          <span className="text-xs font-semibold text-blue-700">or</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {index < mainPath.length - 1 ? <span className="px-1 text-slate-400">→</span> : null}
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#f5f4f0] p-4">
              <p className="text-sm font-semibold text-slate-900">Branch handling</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Hold, manual-review, and cancel states are rendered in their own section below so they remain
                explicit and never disappear into the happy-path chain.
              </p>
            </div>

            <div className="rounded-2xl bg-[#f5f4f0] p-4">
              <p className="text-sm font-semibold text-slate-900">Policy notes</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {policy.meta.notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="branches" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Side branches"
            title="Explicit non-happy-path states"
            description="These states are rendered outside the main path on purpose so ON_HOLD_CUSTOMER_INPUT, HUMAN_REVIEW_REQUIRED, and CANCELLED remain first-class policy branches."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sideBranches.map(({ state, nextStates }) => {
              const isTerminal = nextStates.length === 0;

              return (
                <div key={state} className="rounded-2xl border border-[#ece9df] bg-[#fcfcfa] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatePill label={state} tone={isTerminal ? "terminal" : "branch"} />
                    {isTerminal ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        terminal
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                        branch
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Allowed next states
                    </p>
                    {isTerminal ? (
                      <p className="mt-2 text-sm text-slate-600">No further transition is allowed.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStates.map((nextState) => (
                          <StatePill
                            key={`${state}-${nextState}`}
                            label={nextState}
                            tone={policy.conversation.terminalStates.includes(nextState) ? "terminal" : "default"}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="payment-gate" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Payment gate"
            title="Quote approval unlock rules"
            description="Rows are rendered in policy.quote_payment.paymentTerms order, and each unlock condition is shown from unlockRules without rewording the policy values."
          />

          <div className="overflow-hidden rounded-2xl border border-[#e8e6df]">
            <table className="min-w-full divide-y divide-[#e8e6df] text-sm">
              <thead className="bg-[#f5f4f0] text-left text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">paymentTerms row</th>
                  <th className="px-4 py-3 font-semibold">unlockRules value</th>
                  <th className="px-4 py-3 font-semibold">approvalDecisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e6df] bg-white text-slate-700">
                {paymentRules.map(({ term, unlockStatuses }) => (
                  <tr key={term}>
                    <td className="px-4 py-3 align-top font-semibold [font-family:var(--font-flow-mono)]">
                      {term}
                    </td>
                    <td className="px-4 py-3 align-top [font-family:var(--font-flow-mono)]">
                      {JSON.stringify(unlockStatuses)}
                    </td>
                    <td className="px-4 py-3 align-top [font-family:var(--font-flow-mono)]">
                      <div>unlockedNextState: {approvalOutcomes.unlockedNextState}</div>
                      <div className="mt-1">lockedNextState: {approvalOutcomes.lockedNextState}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="states" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Transitions"
            title="Canonical conversation states and allowed next states"
            description="These cards are derived from the current transition map and are intended as a quick reference when validating UI, routes, or operational handoffs."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transitionRows.map(({ state, nextStates }) => {
              const isTerminal = nextStates.length === 0;

              return (
                <div key={state} className="rounded-2xl border border-[#ece9df] bg-[#fcfcfa] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatePill label={state} tone={isTerminal ? "terminal" : "default"} />
                    {isTerminal ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        terminal
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Allowed next states
                    </p>
                    {isTerminal ? (
                      <p className="mt-2 text-sm text-slate-600">No further transition is allowed.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStates.map((nextState) => (
                          <StatePill
                            key={`${state}-${nextState}`}
                            label={nextState}
                            tone={policy.conversation.terminalStates.includes(nextState) ? "terminal" : "default"}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="guard-rails" className="scroll-mt-24 rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <SectionTitle
            eyebrow="Guard rails"
            title="Key implementation constraints"
            description="These reminders are surfaced directly from the current policy so UI and route work stays aligned with runtime behavior."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-rose-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-rose-900">Policy guard rails</p>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-800">
                  {policy.policies.guardRails.length} items
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {policy.policies.guardRails.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Page behavior</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <p>Presentational reference only — no workflow logic is changed here.</p>
                <p>The flow page should help humans and agents inspect the active contract quickly.</p>
                <p>Any actual workflow change must begin in {canonicalPolicyDoc} and the runtime helpers.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#e8e6df] px-6 py-10 text-center text-sm leading-7 text-slate-500">
        <p>FOGUS ERP 2026 · Next.js 16.2 · Supabase · LINE LIFF v2.28 · Vercel</p>
        <p>This reference page mirrors the current runtime workflow contract and stays read-only by design.</p>
      </footer>
    </main>
  );
}
