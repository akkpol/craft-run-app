---
goal: Split AI preview follow-up work into independent drafting packets with sufficient context for separate execution
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-27
owner: Delivery Engineering
status: Completed
tags: [process, ai, docs, feature, split]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This package records the work split for the AI preview follow-up items so each task can be drafted or implemented independently without re-reading the full conversation history.

## 1. Requirements & Constraints

- **REQ-001**: Create one independent artifact per requested work item.
- **REQ-002**: Include enough repo context in each artifact for a separate agent or engineer to continue without transcript access.
- **REQ-003**: Preserve the current workflow contract defined by `docs/workflow-policy.json`.
- **CON-001**: Do not invent new workflow states, CTAs, or payment/design transitions.
- **CON-002**: LIFF changes must stay mobile-safe and use the existing intake route at `src/app/api/intake/route.ts`.
- **CON-003**: Admin visibility work must reuse existing backoffice surfaces instead of inventing a new screen unless explicitly required.
- **PAT-001**: Treat `designBrief` as the customer-facing prompt seed and keep `aiImagePrompt` available in the payload path for advanced or prefilled use.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Produce the separated draft artifacts.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create the one-page Thai SOP draft at `docs/AI_PREVIEW_INCIDENT_SOP_TH_DRAFT.md` based on the AI incident flow already added to `docs/OPERATOR_RUNBOOK.md`. | ✅ | 2026-04-27 |
| TASK-002 | Create the handoff-package section draft at `docs/CUSTOMER_HANDOFF_AI_PREVIEW_INCIDENT_SECTION_DRAFT.md` for later insertion into `docs/CUSTOMER_HANDOFF_PACKAGE.md`. | ✅ | 2026-04-27 |
| TASK-003 | Create the LIFF intake implementation packet at `plan/feature-liff-ai-prompt-inputs-1.md`. | ✅ | 2026-04-27 |
| TASK-004 | Create the admin raw prompt-source visibility packet at `plan/feature-admin-ai-prompt-source-visibility-1.md`. | ✅ | 2026-04-27 |

### Implementation Phase 2

- **GOAL-002**: Register the reusable planning artifacts in the plan index.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add the new implementation packets to `plan/README.md` so future work can find them quickly. | ✅ | 2026-04-27 |

## 3. Alternatives

- **ALT-001**: Put all four items in one large plan file. Rejected because the user explicitly asked for separated drafts with independent context.
- **ALT-002**: Implement all four tasks immediately. Rejected because the request was to split and draft the work rather than execute all changes in one pass.

## 4. Dependencies

- **DEP-001**: `docs/OPERATOR_RUNBOOK.md`
- **DEP-002**: `docs/CUSTOMER_HANDOFF_PACKAGE.md`
- **DEP-003**: `src/app/liff/intake/intake-form.tsx`
- **DEP-004**: `src/app/api/intake/route.ts`
- **DEP-005**: `src/app/admin/customers/[id]/page.tsx`
- **DEP-006**: `src/app/admin/customers/[id]/customer-360-client.tsx`

## 5. Files

- **FILE-001**: `docs/AI_PREVIEW_INCIDENT_SOP_TH_DRAFT.md` — one-page Thai SOP draft for live admin use.
- **FILE-002**: `docs/CUSTOMER_HANDOFF_AI_PREVIEW_INCIDENT_SECTION_DRAFT.md` — ready-to-insert handoff section draft.
- **FILE-003**: `plan/feature-liff-ai-prompt-inputs-1.md` — implementation packet for LIFF prompt source fields.
- **FILE-004**: `plan/feature-admin-ai-prompt-source-visibility-1.md` — implementation packet for admin raw source visibility.

## 6. Testing

- **TEST-001**: Verify every created file is self-contained and references exact repo paths.
- **TEST-002**: Verify new plan files follow the repo implementation-plan template.

## 7. Risks & Assumptions

- **RISK-001**: The LIFF packet includes a product decision about exposing `designBrief` to customers and keeping `aiImagePrompt` advanced-only; if product direction changes, the packet must be updated.
- **ASSUMPTION-001**: Customer 360 is the preferred first surface for raw AI prompt-source visibility because it already has dedicated lead/customer detail context.

## 8. Related Specifications / Further Reading

- `AI_WORKFLOW_GUARD.md`
- `docs/workflow-policy.json`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/CUSTOMER_HANDOFF_PACKAGE.md`