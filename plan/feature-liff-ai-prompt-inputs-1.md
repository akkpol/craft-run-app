---
goal: Add customer-facing designBrief capture and advanced aiImagePrompt payload support in the LIFF intake flow, then persist both through the intake route
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-27
owner: Delivery Engineering
status: Completed
tags: [feature, liff, ai, intake, form]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines the exact work required to capture AI prompt-source inputs from the LIFF intake UI and persist them through `/api/intake` without changing workflow behavior.

## Discovery Gate

Complete this gate before starting implementation tasks.

| Field | Required content |
|---|---|
| Known Facts | `designBrief` is customer-facing, `aiImagePrompt` remains supported in payload path, and workflow state behavior must remain unchanged. |
| Unknowns | Any unresolved product decision about exposing advanced prompt controls in LIFF UI. |
| Assumptions | Default to non-destructive behavior: capture fields safely, preserve existing status semantics, and avoid implicit AI generation triggers. |
| Out of Scope | New workflow states, auto-generation side effects, or broad LIFF redesign outside this packet. |
| Decision Owner | Product owner plus Delivery Engineering for runtime behavior decisions. |

Unknown handling rule:

- Label each unknown as `decide now`, `defer with fallback`, or `block and escalate` before coding.
- If unresolved, defer with fallback and keep behavior backward-compatible.

## 1. Requirements & Constraints

- **REQ-001**: Add a visible `designBrief` field to the LIFF intake UI as the customer-facing design description input.
- **REQ-002**: Preserve support for `aiImagePrompt` in the data path even if the customer-facing UI does not expose it as a primary field.
- **REQ-003**: Submit `designBrief` and `aiImagePrompt` to `POST /api/intake` when populated.
- **REQ-004**: Persist `design_brief` and `ai_image_prompt` on the created `leads` row.
- **REQ-005**: Do not change workflow states, quote creation rules, or AI preview trigger semantics.
- **CON-001**: The registered customer entry point remains `/liff` and the intake form remains `/liff/intake`.
- **CON-002**: LIFF UI must preserve safe-area behavior and one-thumb ergonomics.
- **CON-003**: `ai_image_status` must not be auto-promoted to generation success merely because `designBrief` exists.
- **PAT-001**: Treat `designBrief` as the primary human-friendly prompt seed.
- **PAT-002**: Treat `aiImagePrompt` as advanced payload support for prefill, testing, or future non-customer authoring paths.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Wire the missing prompt-source fields through the LIFF form state and submit payload.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-001 | Update `src/app/liff/intake/intake-form.tsx` to define `designBrief` state next to existing note/reference inputs and keep `aiImagePrompt` state available for payload wiring. | Yes | 2026-04-27 |
| TASK-002 | Add a customer-facing textarea in `src/app/liff/intake/intake-form.tsx` for `designBrief` near the existing creative requirement fields, using the current LIFF panel field patterns and Thai-first copy. | Yes | 2026-04-27 |
| TASK-003 | Append `designBrief` and `aiImagePrompt` in the `FormData` submit block in `src/app/liff/intake/intake-form.tsx`. The current payload block already appends `note` and `referenceInfo`; extend this same block. | Yes | 2026-04-27 |

### Implementation Phase 2

- **GOAL-002**: Parse and persist the new inputs in the intake route.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-004 | Update request parsing in `src/app/api/intake/route.ts` to read `designBrief` in addition to the existing `aiImagePrompt` parsing. | Yes | 2026-04-27 |
| TASK-005 | Update the lead insert block in `src/app/api/intake/route.ts` to persist `design_brief: data.designBrief || null` and continue persisting `ai_image_prompt: data.aiImagePrompt || null`. | Yes | 2026-04-27 |
| TASK-006 | Keep `ai_image_status` behavior unchanged: it should remain driven by `aiImagePrompt`, not by `designBrief` alone, unless product explicitly changes that rule in a later packet. | Yes | 2026-04-27 |

### Implementation Phase 3

- **GOAL-003**: Validate the flow and guard against regression.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-007 | Add or update tests covering intake payload parsing and persistence of `designBrief` and `aiImagePrompt`. Prefer the closest existing LIFF/intake coverage rather than creating a broad new suite. | Yes | 2026-04-29 |
| TASK-008 | Run a focused validation pass on the touched slice, including the relevant test file(s) and a narrow typecheck or lint step if JSX/TS structure changes materially. | Yes | 2026-04-27 |

## Execution Update - 2026-04-27

- Focused validation run completed for touched files via editor diagnostics and targeted node:test suite.
- `tests/lead-ai-prompt.test.ts`, `tests/liff-capture.test.ts`, and `tests/admin-overview-pagination.test.ts` passed.
- Added `tests/intake-payload.test.ts` to cover multipart intake parsing for `designBrief` and `aiImagePrompt`, plus persistence mapping for `ai_image_status`.
- `tests/intake-payload.test.ts` passed.
- `tests/payment-display.test.ts` failed due to unrelated pre-existing module resolution issue (`src/lib/payment-display` import path in `src/lib/payment-routing.ts`).
- Remaining for this packet: none.

## 3. Alternatives

- **ALT-001**: Expose both `designBrief` and `aiImagePrompt` as customer-visible fields. Rejected because `aiImagePrompt` is too technical for the LIFF customer surface.
- **ALT-002**: Persist only `designBrief` and drop `aiImagePrompt` support. Rejected because downstream code and future advanced authoring paths already understand `aiImagePrompt`.

## 4. Dependencies

- **DEP-001**: `src/app/liff/intake/intake-form.tsx`
- **DEP-002**: `src/app/api/intake/route.ts`
- **DEP-003**: `src/lib/types.ts`
- **DEP-004**: `tests/lead-ai-prompt.test.ts`

## 5. Files

- **FILE-001**: `src/app/liff/intake/intake-form.tsx` — source UI state, field rendering, and payload appends.
- **FILE-002**: `src/app/api/intake/route.ts` — server parsing and lead persistence.
- **FILE-003**: `src/lib/types.ts` — already contains `designBrief` and `aiImagePrompt`; verify it remains aligned with the form payload.
- **FILE-004**: Relevant LIFF/intake or prompt tests — update the nearest existing coverage.

## 6. Testing

- **TEST-001**: Submit a LIFF intake payload containing `designBrief` and verify the created lead stores `design_brief`.
- **TEST-002**: Submit a payload containing `aiImagePrompt` and verify the created lead stores `ai_image_prompt` and preserves current `ai_image_status` behavior.
- **TEST-003**: Confirm a lead with only `design_brief` still composes into a final AI prompt later via `prepareLeadAiPrompt()`.

## 7. Risks & Assumptions

- **RISK-001**: Adding too many creative-input fields on LIFF may reduce completion rate if copy and placement are not kept tight.
- **RISK-002**: If `ai_image_status` semantics are changed accidentally, intake could appear to request preview generation before any explicit preview action.
- **ASSUMPTION-001**: Product intent is to expose `designBrief` publicly and keep `aiImagePrompt` as an advanced/internal payload path.

## 8. Related Specifications / Further Reading

- `AI_WORKFLOW_GUARD.md`
- `docs/workflow-policy.json`
- `src/lib/lead-ai-prompt.ts`
- `docs/FIGMA_DESIGN_SYSTEM_RULES.md`