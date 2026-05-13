---
goal: Runbook launch readiness matrix and single-pass operator execution plan
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Delivery Engineering
status: In progress
tags: [process, runbook, go-live, operator, validation]
---

# Runbook Launch Readiness

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the current runbook-entry decision, launch-readiness matrix, and single-pass operator checklist for the current FOGUS go-live slice. Live validation is the active slice; unrelated local implementation residue is deferred.

## Current Readiness Matrix

| Scope | Item | Status | Source of truth | Execution meaning |
|---|---|---|---|---|
| Slice selection | Live go/no-go and operator validation | Active | `plan/process-anti-loop-execution-1.md` | This is the only slice allowed to move forward in this pass. |
| Slice selection | Local test/config residue | Deferred | Worktree state on 2026-05-02 | Do not mix with operator validation until the live slice is closed. |
| Phase 2 | `P2-G03` | Complete | `docs/GO_NOGO_REVIEW.md` | Production deploy prerequisite is satisfied. |
| Phase 2 | `P2-G05` | Complete | `docs/GO_NOGO_REVIEW.md` | Webhook console verification is satisfied. |
| Phase 2 | `P2-G06` | Complete | `docs/GO_NOGO_REVIEW.md` | LIFF endpoint and LIFF ID prerequisite are satisfied. |
| Phase 2 | `P2-G07` | Complete | `docs/GO_NOGO_REVIEW.md` | Allowlisted admin prerequisite is satisfied. |
| Phase 3 | `P3-G04` | Complete | `docs/GO_NOGO_REVIEW.md` | Signed production webhook simulation proves conversation creation and invalid-signature rejection. |
| Phase 3 | `P3-G05` | Complete | `docs/GO_NOGO_REVIEW.md` | Live LIFF submit created lead and quote evidence. |
| Phase 3 | `P3-G06` | Complete | `docs/GO_NOGO_REVIEW.md` | Payment-blocked approval path is proven. |
| Phase 3 | `P3-G08` | Complete | `docs/GO_NOGO_REVIEW.md` | Quote download path is proven. |
| Phase 3 | `P3-G09` | Complete | `docs/GO_NOGO_REVIEW.md` | Admin commercial unlock path is proven. |
| Phase 3 | `P3-G10` | Complete | `docs/GO_NOGO_REVIEW.md` | Job progression and customer-facing status alignment are proven on production. |
| Phase 3 | `P3-G11` | Complete | `docs/GO_NOGO_REVIEW.md` | Signed production webhook simulation proves escalation routing into `HUMAN_REVIEW_REQUIRED`. |
| Phase 3 | `P3-G12` | Complete | `docs/GO_NOGO_REVIEW.md` | Runtime settings save plus audit event evidence is proven. |
| Phase 3 | `P3-G13` | Complete | `docs/GO_NOGO_REVIEW.md` | Recent production `action_log` rows all carried non-empty `action_ref` values. |
| Commercial documents | Policy v1 handoff | Recorded / implementation deferred | `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` | `P3-G08` proves the current quotation download only; billing note, invoice, receipt, tax-ready, and tax-invoice implementation must follow `feature-commercial-documents-1`. |
| LIFF live checks | `LIFF-VAL-005` | Complete via `P3-G05` evidence | `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` | First-time customer path has matching live evidence. |
| LIFF live checks | `LIFF-VAL-006` | Open | `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` | Returning-customer prefill still needs focused evidence. |
| LIFF live checks | `LIFF-VAL-007` | Open | `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` | Tax-document validation still needs fail and pass evidence. |
| LIFF live checks | `LIFF-VAL-008` | Open | `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` | Runtime catalog and imported label rendering still need focused evidence. |
| Closure | Go/no-go sign-off and `TASK-024` | Open | `plan/process-go-live-waves-1.md` | Launch package cannot close until all required gates and sign-off are recorded. |

## Minimal Execution Order

| Order | Run item | Stop rule | Output |
|---|---|---|---|
| 1 | Run `LIFF-VAL-006` | Stop if prefill shows wrong customer data or no production prefill. | Add focused evidence to `docs/GO_NOGO_REVIEW.md` and note scenario result. |
| 2 | Run `LIFF-VAL-007` | Stop if Thai validation logic or retry success path disagrees with the runbook. | Add focused evidence to `docs/GO_NOGO_REVIEW.md`. |
| 3 | Run `LIFF-VAL-008` | Stop if runtime catalog fails to load or imported labels regress to slug fallback. | Add focused evidence to `docs/GO_NOGO_REVIEW.md`. |
| 4 | Confirm commercial document handoff | Stop if anyone treats quote PDF, payment unlock, or LIFF tax-document validation as proof that invoice/receipt/tax invoice issuance is production-complete. | Record the policy boundary in `docs/GO_NOGO_REVIEW.md`: source is `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`, implementation is `feature-commercial-documents-1`, and launch sign-off must decide whether to defer it. |
| 5 | Complete sign-off | Do not close sign-off if any required gate above remains open or if commercial document implementation is required for this launch but not implemented. | Record sign-off in `docs/GO_NOGO_REVIEW.md`. |
| 6 | Close `TASK-024` last | Do not close `TASK-024` before sign-off is recorded. | Update `plan/process-go-live-waves-1.md`. |

## No-Chat Completion Contract

Use this contract to finish the work without reopening design discussion. Execute in order and only report when a stop rule triggers or a wave is complete.

| Wave | Objective | Required actions | Completion output | Stop rule |
|---|---|---|---|---|
| CLOSE-001 | Finish live runbook evidence | Run `LIFF-VAL-006`, `LIFF-VAL-007`, and `LIFF-VAL-008` in the minimal execution order above. | `docs/GO_NOGO_REVIEW.md` has complete result, verifier, date, evidence, and notes for each still-open LIFF gate. | Stop immediately if any gate fails and record the exact failed gate, evidence, and rollback or triage path. |
| CLOSE-002 | Close sign-off | Complete the sign-off section in `docs/GO_NOGO_REVIEW.md`, confirm the commercial document policy handoff is recorded, then close the remaining Wave 4 tasks, then close `TASK-024` last in `plan/process-go-live-waves-1.md`. | Go/no-go package is signed, commercial document scope is explicitly deferred or required, and Wave 4 closure is recorded. | Stop if any required gate is still open, waived without written launch reasoning, or if billing/invoice/receipt/tax invoice issuance is required for this launch but still unimplemented. |
| CLOSE-003 | Integrate local test-fix residue | After live runbook closure only, isolate `tests/line-and-production-review.test.ts`, `tests/workflow-transitions.test.ts`, and `vitest.config.ts` as a separate test-resolution slice. | `npm test` passes and the test-fix slice is ready for commit or PR. | Stop if unrelated doc/runbook files are still mixed into the test-fix diff. |
| CLOSE-004 | Final repository handoff | Run final `git status --short --branch`, verify no unintended files are mixed, then prepare the commit or PR package by slice. | One clean live-runbook package and one separate test-fix package, or a documented reason for combining them. | Stop if the worktree spans unrelated surfaces without an explicit package split. |

### Reporting Rule

- **REPORT-001**: Do not send progress updates for routine execution steps.
- **REPORT-002**: Report only when a stop rule triggers, a wave completes, or operator input is required.
- **REPORT-003**: Each report must include only `current wave`, `completed gates`, `blocked gates`, `evidence location`, and `next command/action`.

## Dual-Track Execution Split

Not all open gates require a live LINE device. Separate them before starting CLOSE-001 so each track can proceed without blocking the other.

### Track A - Agent-Executable Gates

| Gate | Method | Expected output | Status |
|---|---|---|---|
| P3-G12 | Browser/admin settings save plus action-log query | Save succeeds and `settings.updated` has non-empty `action_ref`. | Complete: `ACT-20260502-0246` verified. |
| P3-G13 | Production action-log sample query | Every sampled row has non-empty `action_ref`. | Complete: latest sampled rows had populated refs. |

### Track B - Operator-Required Gates

| Gate | Requires | Current status |
|---|---|---|
| P3-G04 | Signed production webhook simulation | Complete on 2026-05-02. |
| P3-G10 | Production route plus public status page | Complete on 2026-05-02. |
| P3-G11 | Signed production webhook simulation | Complete on 2026-05-02. |
| LIFF-VAL-006 | Returning customer LINE account with existing profile | Open: production desktop cannot bypass LIFF, and `/api/customers/prefill` requires a LIFF token in production. |
| LIFF-VAL-007 | Company tax form submission without and with branch code | Open: live proof still requires a real production LIFF session and retry submit. |
| LIFF-VAL-008 | LIFF product picker with runtime catalog loaded | Open: runtime picker proof must come from the live LIFF UI. |

Delivery Engineering rechecked production on 2026-05-02 and confirmed `/liff` in a desktop browser remains at `กำลังเปิดฟอร์มใน LINE...`; the `devNoLiff=1` bypass is intentionally limited to localhost or non-production, so there is no supported agent-side shortcut for the three remaining LIFF checks on production.

Regression coverage note (updated 2026-05-14): `npm run check:release` (scenario runner: `webhook-event-processor`, `fake-line-gateway`, `scenario-runner` — 19 tests) is the primary regression gate for webhook state machine behavior and covers the automated layer fully. Track B gates (LIFF-VAL-006/007/008) are exclusively final launch evidence gates requiring a real LINE device; they are not regression tests.

## Operator Evidence Worksheet

Copy each completed block into `docs/GO_NOGO_REVIEW.md` immediately after the live step passes. Leave `Result` as `FAIL` and stop the wave if any expected outcome does not match.

```md
Gate: LIFF-VAL-006
Result: PASS | FAIL
Verified by / Date:
Evidence:
- Masked returning LINE account:
- Screenshot showing prefilled phone/document/billing defaults:
- Lead/customer reference used for comparison:
Notes:
- Expected: returning-customer prefill appears for the correct profile only.

Gate: LIFF-VAL-007
Result: PASS | FAIL
Verified by / Date:
Evidence:
- Screenshot of company tax invoice submission without branch code:
- Thai validation message screenshot:
- Screenshot or lead ID after retry with branch code:
Notes:
- Expected: missing branch code blocks submit, adding branch code allows submit.

Gate: LIFF-VAL-008
Result: PASS | FAIL
Verified by / Date:
Evidence:
- Product picker screenshot showing runtime catalog item:
- Quote page screenshot showing imported product label:
- Status page screenshot showing imported product label:
- Download page screenshot showing imported product label:
Notes:
- Expected: no page falls back to raw slug when imported label exists.
```

## Final Done Criteria

- **DONE-001**: Every open LIFF gate in the worksheet above is copied into `docs/GO_NOGO_REVIEW.md` with `PASS`, verifier, date, and evidence.
- **DONE-002**: `docs/GO_NOGO_REVIEW.md` has no required launch gate left as pending unless it is explicitly waived with written launch reasoning.
- **DONE-003**: `plan/process-go-live-waves-1.md` closes `TASK-024` only after sign-off is fully recorded.
- **DONE-004**: The local test-fix slice is integrated separately after launch evidence closure, with `npm test` passing.
- **DONE-005**: Final handoff contains either one clean combined PR package with written reason, or two separate packages: live runbook evidence and test-fix resolution.
- **DONE-006**: Commercial document policy handoff is recorded in `docs/GO_NOGO_REVIEW.md`; sign-off explicitly says whether `feature-commercial-documents-1` is deferred or required before launch.

## 1. Requirements & Constraints

- **REQ-001**: Classify the current worktree before selecting the active execution slice.
- **REQ-002**: Treat live go/no-go validation as a single coherent slice separate from local test-fix residue.
- **REQ-003**: Use `docs/GO_NOGO_REVIEW.md` as the master execution sheet for Wave 3 and Wave 4 launch validation.
- **REQ-004**: Do not close launch readiness until `TASK-024` in `plan/process-go-live-waves-1.md` is satisfied.
- **REQ-005**: Run LIFF live scenarios from `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` only after the hard preconditions are met.
- **OPS-001**: Capture evidence for every live gate with result, verifier, date, screenshots, IDs, and notes.
- **OPS-002**: Stop the live run immediately if a stop-rule gate fails in `docs/GO_NOGO_REVIEW.md`.
- **CON-001**: ~~The current worktree is unstable because it spans documentation updates plus local test/config changes.~~ Resolved at `90c97d7` — worktree is clean, `check:release` passed 2026-05-14.
- **CON-002**: No new implementation work may start while the runbook slice is active.
- **CON-003**: Local files `tests/line-and-production-review.test.ts`, `tests/workflow-transitions.test.ts`, and `vitest.config.ts` are deferred from this runbook slice.
- **GUD-001**: Follow the unstable-worktree rule in `plan/process-anti-loop-execution-1.md`: choose one coherent slice and explicitly defer the others.
- **PAT-001**: Close Phase 2 launch gates first, then Phase 3 live gates, then sign-off, then `TASK-024` last.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Declare the active runbook slice and separate it from unrelated local implementation residue.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-001 | Record the current worktree as unstable because it contains runbook docs, local test files, and `vitest.config.ts`. | Yes | 2026-05-02 |
| TASK-002 | Select `live go/no-go and operator validation` as the only active slice for this pass. | Yes | 2026-05-02 |
| TASK-003 | Defer local test/config residue from the runbook pass and do not mix it with operator validation. | Yes | 2026-05-02 |

### Implementation Phase 2

- **GOAL-002**: Confirm whether the repository is allowed to enter LIFF live runbook execution.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-004 | Confirm `P2-G03` is complete in `docs/GO_NOGO_REVIEW.md`: latest production deploy is `Ready`. | Yes | 2026-05-02 |
| TASK-005 | Confirm `P2-G05` is complete in `docs/GO_NOGO_REVIEW.md`: LINE webhook verify returned success. | Yes | 2026-05-02 |
| TASK-006 | Confirm `P2-G06` is complete in `docs/GO_NOGO_REVIEW.md`: LIFF endpoint is `<base-url>/liff` and ID alignment is verified. | Yes | 2026-05-02 |
| TASK-007 | Confirm `P2-G07` is complete in `docs/GO_NOGO_REVIEW.md`: allowlisted admin account is valid in production. | Yes | 2026-05-02 |
| TASK-008 | Mark the hard preconditions in `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` as satisfied because `P2-G03`, `P2-G05`, `P2-G06`, and `P2-G07` are complete. | Yes | 2026-05-02 |

### Implementation Phase 3

- **GOAL-003**: Publish the current launch-readiness matrix for the active runbook slice.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-009 | Mark all Phase 3 gates as complete based on current `docs/GO_NOGO_REVIEW.md` evidence. | Yes | 2026-05-02 |
| TASK-010 | Mark `LIFF-VAL-005` as implicitly evidenced by the completed live LIFF submission under `P3-G05`. | Yes | 2026-05-02 |
| TASK-011 | Mark `LIFF-VAL-006`, `LIFF-VAL-007`, and `LIFF-VAL-008` as open because production still requires operator/device execution for those scenarios. | Yes | 2026-05-02 |

### Implementation Phase 4

- **GOAL-004**: Execute the single-pass operator checklist required to reach launch sign-off.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-012 | Run `P3-G04`: send one normal LINE message to the OA and capture evidence that the webhook created the conversation row. | Yes | 2026-05-02 |
| TASK-013 | Run `LIFF-VAL-006`: open LIFF with an existing customer account and verify production prefill fields. |  |  |
| TASK-014 | Run `LIFF-VAL-007`: verify company tax-invoice validation fail path and pass path in production. |  |  |
| TASK-015 | Run `LIFF-VAL-008`: verify runtime catalog items load in LIFF and imported product labels render correctly across quote, status, and download pages. |  |  |
| TASK-016 | Run `P3-G10`: advance one job through remaining staff-controlled states and validate the public status page after each major transition. | Yes | 2026-05-02 |
| TASK-017 | Run `P3-G11`: send escalation keywords such as `admin` or `คุยกับแอดมิน` and verify `HUMAN_REVIEW_REQUIRED`. | Yes | 2026-05-02 |
| TASK-018 | Run `P3-G12`: change one runtime setting in `/admin/settings`, save successfully, and capture the `settings.updated` action log evidence. | Yes | 2026-05-02 |
| TASK-019 | Run `P3-G13`: inspect sampled `action_log` rows from the live run and verify non-empty `action_ref` values. | Yes | 2026-05-02 |

### Implementation Phase 5

- **GOAL-005**: Close the launch package only after all required runbook evidence is recorded.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-020 | Update the open LIFF gate rows in `docs/GO_NOGO_REVIEW.md` with result, verifier, date, evidence, and notes immediately after each live run step. |  |  |
| TASK-021 | Complete the sign-off section in `docs/GO_NOGO_REVIEW.md` after all required gates are closed. |  |  |
| TASK-022 | Close `TASK-024` in `plan/process-go-live-waves-1.md` only after sign-off is fully recorded. |  |  |

## 3. Alternatives

- **ALT-001**: Continue fixing the local test/config residue before operator validation. Rejected because the current active slice is live launch validation and the anti-loop plan forbids mixing surfaces in an unstable worktree.
- **ALT-002**: Start LIFF live validation before `P2-G03`, `P2-G05`, `P2-G06`, and `P2-G07` are complete. Rejected because `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` defines those as hard preconditions.
- **ALT-003**: Use the LIFF runbook as the only launch artifact. Rejected because Wave 3 and Wave 4 explicitly route execution and closure through `docs/GO_NOGO_REVIEW.md`.

## 4. Dependencies

- **DEP-001**: `docs/GO_NOGO_REVIEW.md` - master sheet for current launch execution and sign-off.
- **DEP-002**: `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` - detailed LIFF live scenarios and capture rules.
- **DEP-003**: `docs/OPERATOR_RUNBOOK.md` - incident, redeploy, reconfiguration, and hypercare procedures.
- **DEP-004**: `plan/process-go-live-waves-1.md` - Wave 3/Wave 4 execution and closure rules.
- **DEP-005**: `plan/process-anti-loop-execution-1.md` - unstable worktree guardrails.
- **DEP-006**: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` - commercial document policy and sign-off boundary.
- **DEP-007**: `plan/feature-commercial-documents-1.md` - deferred implementation packet for billing note, invoice, receipt, tax-ready, and tax-invoice behavior.

## 5. Files

- **FILE-001**: `plan/process-runbook-launch-readiness-1.md` - current readiness matrix and operator execution plan.
- **FILE-002**: `docs/GO_NOGO_REVIEW.md` - live launch gates and sign-off destination.
- **FILE-003**: `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md` - detailed LIFF live validation checklist.
- **FILE-004**: `docs/OPERATOR_RUNBOOK.md` - operational incident and redeploy runbook.
- **FILE-005**: `plan/process-go-live-waves-1.md` - wave mapping and final closure rule.
- **FILE-006**: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` - source-of-truth policy for commercial documents.
- **FILE-007**: `plan/feature-commercial-documents-1.md` - implementation packet to open only after launch gate closure or explicit pause.

## 6. Testing

- **TEST-001**: Verify the current worktree classification still matches Phase 1 before starting the operator pass.
- **TEST-002**: Verify `P2-G03`, `P2-G05`, `P2-G06`, and `P2-G07` remain complete in `docs/GO_NOGO_REVIEW.md` before starting LIFF live scenarios.
- **TEST-003**: Verify each open LIFF gate is updated with concrete evidence immediately after execution.
- **TEST-004**: Verify the sign-off section is complete before marking `TASK-024` complete.

## 7. Risks & Assumptions

- **RISK-001**: Mixing local test-fix work with live operator validation can reintroduce context drift and invalidate evidence ordering.
- **RISK-002**: A fresh deploy or console reconfiguration can invalidate previously captured Phase 2 evidence and require rerun.
- **RISK-003**: Leaving `LIFF-VAL-006`, `LIFF-VAL-007`, or `LIFF-VAL-008` open blocks final launch sign-off even though Phase 3 now passes.
- **RISK-004**: Treating the current quote PDF or payment unlock as invoice/receipt/tax-invoice compliance can create a business/legal false-ready signal. Mitigation: use `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` as the policy boundary and require explicit defer-or-block sign-off.
- **ASSUMPTION-001**: The production alias remains `https://craft-run.vercel.app` during the active runbook pass.
- **ASSUMPTION-002**: The current evidence already recorded in `docs/GO_NOGO_REVIEW.md` is trustworthy unless a new production change occurs.

## 8. Related Specifications / Further Reading

- `docs/GO_NOGO_REVIEW.md`
- `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`
- `plan/feature-commercial-documents-1.md`
- `plan/process-go-live-waves-1.md`
- `plan/process-anti-loop-execution-1.md`
