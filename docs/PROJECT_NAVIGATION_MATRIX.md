---
title: Project Navigation Matrix
version: 1.0
date: 2026-05-14
owner: Delivery Engineering
status: Active
---

# Project Navigation Matrix

Use this file to choose the right docs, plans, and runbooks before starting work. It is an index and conflict map, not a replacement for source-of-truth policy files.

## 1. Current Stable Baseline

- Date: 2026-05-14
- Baseline commit: `90c97d7`
- Release gate: `npm run check:release`
- Baseline note: `check:release` at `90c97d7` passed 2026-05-14 (lint, TypeScript, scenario runner 19/19, workflow-policy, build). Vercel status for prior baseline `cd99883` was reported as success before this packet.
- Scenario runner (`npm run test:scenario`) is the primary regression gate for webhook state machine behavior. Real LINE device is required only for final launch evidence (LIFF-VAL-006/007/008).
- Known drift: Supabase migration-history drift is known drift, not LINE, LIFF, webhook, or runtime failure.
- Production mutation rule: no production mutation without an explicit packet.

## 2. Source-of-Truth Hierarchy

1. Workflow behavior source of truth:
   - `docs/workflow-policy.json`
   - `src/lib/workflow-policy-core.mjs`
2. Agent guard:
   - `AI_WORKFLOW_GUARD.md`
3. Domain policy:
   - `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`
   - `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md`
4. Operator runbooks:
   - `docs/OPERATOR_RUNBOOK.md`
   - `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md`
   - LIFF/operator runbooks listed below
5. Active execution packets:
   - `plan/process-go-live-waves-1.md`
   - `plan/process-supabase-liff-active-packets-1.md`
   - active feature/process plans listed below
6. Generated or derivative docs:
   - `docs/WORKFLOW_TRANSITION_TABLE.md`
   - `docs/AUTO_RUN_FLOW_OWNER_MAP.md`

If prose conflicts with `docs/workflow-policy.json` or `src/lib/workflow-policy-core.mjs`, the policy JSON and runtime helper win for workflow behavior.

## 3. File Classification Table

| Path | Classification | Controls | Currentness vs cd99883 | Follow for future agents? | Next action | Notes/conflicts |
|---|---|---|---|---|---|---|
| `docs/workflow-policy.json` | source-of-truth | Workflow states, transitions, payment/design/commercial gates, LINE reply policy | Current at `cd99883` | Yes | keep | Machine-readable workflow behavior source. |
| `src/lib/workflow-policy-core.mjs` | source-of-truth | Runtime helpers that load and interpret workflow policy | Current at `cd99883` | Yes | keep | Read-only for this docs packet; update only with workflow behavior changes. |
| `AI_WORKFLOW_GUARD.md` | source-of-truth | AI agent rules, mandatory read order, workflow non-negotiables | Current at `cd99883` | Yes | keep | Defines guardrails for agents before changing workflow-sensitive behavior. |
| `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` | source-of-truth | Commercial document vocabulary, receiver/issuer invariant, VAT and entity rules | Active policy at `cd99883` | Yes | keep | Controls billing note, invoice, receipt, tax-ready, and tax invoice interpretation. |
| `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md` | source-of-truth | Locked v1 commercial-document business flow | Current evidence supports active use | Yes | keep | Current because it names the v1 implementation packet and locks post-payment `RECEIPT` / `TAX_INVOICE_RECEIPT` scope. |
| `docs/OPERATOR_RUNBOOK.md` | active runbook | Production operator triage and incident paths | Active frontmatter; current at `cd99883` | Yes | keep | Controls operator behavior, not workflow state semantics. |
| `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md` | active runbook | Supabase migration-history drift interpretation and safe verification | Active; includes CI Preview drift interpretation | Yes | keep | Do not replay or repair hosted migration history from mismatch alone. |
| `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` | active runbook | Live LIFF validation scenarios and capture rules | Active; still relevant to open LIFF checks | Yes | update | Update only after focused live evidence is captured. |
| `docs/OPERATOR_LAUNCH_ONE_PAGE.md` | active runbook | One-page operator launch execution and evidence handoff | Active; references GO/NO-GO and LIFF runbooks | Yes | keep | Best operator entrypoint before deeper runbooks. |
| `docs/PHASE2_OPERATOR_GATE_CHECKLIST.md` | active runbook | Phase 2 operator gates `P2-G03`, `P2-G05`, `P2-G06`, `P2-G07` | Active but mostly historical after Phase 2 pass | Yes | keep | Use only when Phase 2 evidence or config must be rechecked. |
| `docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md` | conflicting | Evidence capture instructions | Frontmatter says Active, but body contains embedded patch text | Yes | requires human decision | Needs cleanup or split before treating as operator-ready. |
| `docs/GO_NOGO_REVIEW.md` | active runbook | Launch gate order, evidence, sign-off status | Active; says remaining blockers include LIFF checks, commercial decision, sign-off | Yes | update | Live run sheet for GO/NO-GO; do not mark GO from partial evidence. |
| `plan/process-go-live-waves-1.md` | active packet | Primary delivery order and go-live execution checklist | In progress; current active delivery guide | Yes | update | Use for execution order; reconcile other plan files back to it. |
| `plan/process-runbook-launch-readiness-1.md` | active packet | Minimal closeout order for live runbook evidence | In progress; current open gates match GO/NO-GO | Yes | update | Names `LIFF-VAL-006`, `LIFF-VAL-007`, `LIFF-VAL-008` as open. |
| `plan/process-supabase-liff-active-packets-1.md` | active packet | Supabase drift validation and LIFF live evidence closure | In progress but partly historical | Yes | update | Keep drift and LIFF closure separate; reconcile after live evidence updates. |
| `plan/process-anti-loop-execution-1.md` | active runbook | Packet discipline, tooling matrix, stop rules | Active and aligned with release-gate direction | Yes | keep | Use before selecting or widening packets. |
| `plan/CORE_EXECUTION_TOOLKIT.md` | active runbook | Minimum anti-loop toolkit and conflict priority | Active | Yes | keep | Compact operating contract for issue handling and validation tiers. |
| `docs/START_HERE_CONTEXT_RECOVERY.md` | active runbook | Session recovery and one-packet activation | Active | Yes | link | Already points to recovery order; future packet may link this matrix. |
| `docs/AUTO_RUN_FLOW_OWNER_MAP.md` | generated/derivative | Compact owner, automation, and decision map | Active but explicitly not a new behavior source | Yes | keep | Update with policy/runtime changes; do not let it override workflow policy. |
| `docs/WORKFLOW_TRANSITION_TABLE.md` | generated/derivative | Human-readable workflow transition table | Current derivative of policy/runtime | Yes | keep | If it conflicts with policy JSON, update the table. |
| `plan/README.md` | index | Plan navigation and plan roles | Current but missing this matrix before this packet | Yes | link | Index link should point agents here for doc navigation. |
| `package.json` | source-of-truth | Repo commands including `check:release`, `test:scenario`, `check:workflow-policy` | Current at `cd99883` | Yes | keep | Do not infer commands from old docs when package scripts differ. |
| `scripts/release-gate.mjs` | source-of-truth | `npm run check:release` command sequence and drift classification | Current; introduced in stable baseline | Yes | keep | Runs lint, TypeScript, scenario tests, workflow policy, build, and ops doctor. |
| `scripts/ops-doctor.mjs` | source-of-truth | Local ops diagnostic and Supabase drift reporting | Current at `cd99883` | Yes | keep | Release gate classifies known drift from this output. |
| `.agents/skills/fogus-recovery-gate/SKILL.md` | active runbook | Agent recovery wrapper for unstable FOGUS sessions | Active | Yes | keep | Use when context drift, mixed worktree, env checks, or packet confusion reappears. |
| `.agents/skills/build-fogus-erp/SKILL.md` | active runbook | Repo-specific implementation guard for FOGUS ERP work | Active | Yes | keep | Relevant for implementation packets, not this docs-only packet. |
| `.agents/skills/fogus-document-design/SKILL.md` | active runbook | Commercial document design guard | Active | Yes | keep | Presentation guidance only; does not authorize tax/invoice runtime claims. |
| `plan/feature-commercial-documents-1.md` | active packet | Commercial document implementation holder | In progress; explicitly blocked until launch gate closes or pauses | Yes | update | Do not implement before launch gate decision; policy v1 and business-flow freeze control it. |
| `docs/COMMERCIAL_DOCUMENT_DESIGN_REFERENCE.md` | future vision | Visual reference for document family | Draft reference | Yes | keep | Presentation reference only; not legal/tax workflow authority. |
| `docs/INVOICE_FLOW_PATCH.md` | stale | Historical invoice-first patch idea | Older than policy v1 and business-flow freeze | No | ignore | Conflicts with current policy direction; do not follow for implementation order. |
| `plan/feature-payment-record-and-accounting-export-1.md` | completed packet | Manual payment records and accounting export context | Completed | Yes | keep | Provides context for payment records; not receipt/tax invoice issuance authority. |
| `plan/feature-liff-observability-monitor-1.md` | completed packet | LIFF incident logging and `/admin/liff-monitor` slice | Completed | Yes | keep | Do not reopen unless user asks for LIFF observability follow-up. |
| `plan/process-feature-completeness-recovery-1.md` | active runbook | Product gap matrix and safe execution order | Active coordination doc | Yes | keep | Use to select one later feature packet; not for direct broad implementation. |
| `plan/process-docs-and-worktree-repair-1.md` | completed packet | Prior docs/worktree cleanup checkpoint | Completed | Yes | keep | Historical checkpoint; do not reopen unless docs repair regresses. |
| `plan/process-build-first-anti-loop-gates-1.md` | unknown-needs-review | Planned build-first gate ladder | Frontmatter says Planned while other files already contain gate behavior | Yes | requires human decision | Reconcile status before treating it as active or complete. |
| `plan/docs-flow-owner-map-quick-reference-1.md` | completed packet | Creation record for `AUTO_RUN_FLOW_OWNER_MAP.md` | Complete | Yes | keep | Useful audit trail for the derivative owner map. |
| `docs/EXECUTIVE_STATUS_REPORT_2026-05-02.md` | generated/derivative | Executive status snapshot | Older snapshot, not live source | No | ignore | Use only as historical summary; GO/NO-GO doc wins for current status. |
| `docs/PRODUCTION_OWNER_REVIEW_2026-05-04.md` | generated/derivative | Owner/operator browser review findings | Historical QA note | Yes | split | Convert surviving findings into packets before implementation. |
| `docs/ENV_AND_LINE_SETUP.md` | active runbook | LINE, LIFF, Supabase, and env setup explanation | Current setup guide | Yes | keep | Do not print secrets; use for env name/source orientation. |

## 4. Active Work Queue

Active or likely-active packets only:

1. `plan/process-runbook-launch-readiness-1.md`
   - Close `LIFF-VAL-006`, `LIFF-VAL-007`, and `LIFF-VAL-008`.
   - Update `docs/GO_NOGO_REVIEW.md` only with captured evidence.
2. `plan/process-go-live-waves-1.md`
   - Close the remaining go-live gate and sign-off flow after focused LIFF evidence.
   - Record the commercial document defer-or-required decision before final sign-off.
3. `plan/process-supabase-liff-active-packets-1.md`
   - Reconcile active packet status after live LIFF evidence and known Supabase drift notes are updated.
4. `plan/feature-commercial-documents-1.md`
   - Hold until launch gate is closed or explicitly paused.
   - Do not start while navigation or live evidence is unresolved.

## 5. Do-Not-Do List

- Do not edit `main` directly.
- Do not bypass `docs/workflow-policy.json`.
- Do not mutate Supabase casually.
- Do not confuse known Supabase migration-history drift with runtime, LINE, LIFF, or webhook failure.
- Do not implement features while navigation is unresolved.
- Do not modify `src/`, `tests/`, `supabase/`, migrations, `.env*`, or `docs/workflow-policy.json` from this docs-navigation packet.
- Do not run Vercel deploys, Supabase mutation commands, `supabase db push`, or migration repair commands from this packet.
- Do not silently resolve doc conflicts; classify weak evidence as `unknown-needs-review` or `conflicting`.

## 6. Next Single Recommended Packet

Next packet: close LIFF live evidence gates.

Use `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md`, `docs/OPERATOR_LAUNCH_ONE_PAGE.md`, and `docs/GO_NOGO_REVIEW.md` to close exactly:

- `LIFF-VAL-006` Returning-customer prefill path
- `LIFF-VAL-007` Company tax-document validation
- `LIFF-VAL-008` Runtime catalog path

Do not start feature work until those gates are closed, waived with written launch reasoning, or explicitly paused by the owner.
