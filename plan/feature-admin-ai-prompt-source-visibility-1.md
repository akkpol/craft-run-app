---
goal: Expose raw AI prompt-source fields separately in admin so operators can see design_brief, ai_image_prompt, and ai_prompt_snapshot without guessing which prompt text is derived versus original
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-30
owner: Delivery Engineering
status: Completed
tags: [feature, admin, ai, visibility, backoffice]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines the first admin surface for clear AI prompt-source visibility. The primary target is Customer 360 because it already has dedicated customer and lead context. The plan keeps the raw fields separate so staff can distinguish original input from the final prepared prompt snapshot.

## Packet Contract

Goal

- Expose raw AI prompt-source fields in Customer 360 without expanding into queue-level dashboard work.

In Scope

- `src/app/admin/customers/[id]/page.tsx`
- `src/app/admin/customers/[id]/customer-360-client.tsx`

Out of Scope

- `src/app/admin/admin-dashboard-sections.tsx`
- prompt authoring UI
- workflow or customer-facing behavior changes

Definition of Done

- Customer 360 shows `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot` as separate read-only fields.
- Focused validation for the touched Customer 360 slice is recorded.
- Queue-level dashboard expansion remains a follow-up packet instead of being merged into this one.

## Discovery Gate

Complete this gate before starting implementation tasks.

| Field | Required content |
|------|------------------|
| Known Facts | Admin must show `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot` as separate read-only values with clear Thai labels. |
| Unknowns | Whether queue-level dashboard summary is mandatory in this slice or handled as follow-up. |
| Assumptions | Customer 360 is the mandatory first surface; dashboard expansion is optional unless product explicitly requests same-slice delivery. |
| Out of Scope | Prompt authoring UI, workflow behavior changes, or customer-facing copy changes outside admin visibility scope. |
| Decision Owner | Product owner for scope boundary, Delivery Engineering for data/query and UI implementation choices. |

Unknown handling rule:

- Label each unknown as `decide now`, `defer with fallback`, or `block and escalate` before coding.
- If unresolved, defer with fallback and ship Customer 360 visibility first.

## 1. Requirements & Constraints

- **REQ-001**: Show `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot` as separate fields in admin.
- **REQ-002**: Preserve the current derived prompt behavior used by preview actions; this packet is about visibility, not changing generation logic.
- **REQ-003**: Reuse an existing admin surface rather than introducing a new route.
- **REQ-004**: Make the distinction between raw customer input and final prepared prompt obvious in Thai copy.
- **CON-001**: The first implementation target is Customer 360 at `src/app/admin/customers/[id]/customer-360-client.tsx`.
- **CON-002**: The route query in `src/app/admin/customers/[id]/page.tsx` must fetch the required prompt-source fields.
- **CON-003**: Do not alter workflow states, design actions, or customer-facing behavior.
- **PAT-001**: Use existing admin shell and panel patterns.
- **PAT-002**: Prefer read-only presentation with clear labels over editable controls in this packet.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Extend the data path for Customer 360.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update the lead select list in `src/app/admin/customers/[id]/page.tsx` to include `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot`. | Yes | 2026-04-27 |
| TASK-002 | Extend the local `Lead` type in `src/app/admin/customers/[id]/customer-360-client.tsx` with `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot`. | Yes | 2026-04-27 |

### Implementation Phase 2

- **GOAL-002**: Add a read-only AI prompt source panel to Customer 360.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-003 | Add a new section or card in `src/app/admin/customers/[id]/customer-360-client.tsx` labeled in Thai to show the latest lead's prompt-source data. | Yes | 2026-04-27 |
| TASK-004 | Render three separate rows or blocks for `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot`, each with clear labels describing origin and purpose. | Yes | 2026-04-27 |
| TASK-005 | Add empty-state text for each field so staff can distinguish between missing customer input and missing prepared snapshot. | Yes | 2026-04-27 |

### Implementation Phase 3

- **GOAL-003**: Decide whether the dashboard detail panel is a follow-up or part of the same slice.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Evaluate whether `src/app/admin/admin-dashboard-sections.tsx` needs a compact raw-source summary in an existing detail surface after Customer 360 is complete. Keep this as a follow-up unless product explicitly requests queue-level visibility. | | |
| TASK-007 | If queue-level visibility is requested, reuse the same labels and data semantics instead of introducing a second interpretation of the prompt fields. | | |

### Implementation Phase 4

- **GOAL-004**: Validate the admin visibility behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Verify Customer 360 shows the raw fields for a lead containing any combination of `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot`. | Yes | 2026-04-27 |
| TASK-009 | Run a focused lint/typecheck or equivalent editor validation on the touched admin files. | Yes | 2026-04-27 |

## Execution Update - 2026-04-27

- Customer 360 now fetches and renders prompt-source fields with Thai labels and per-field empty-state text.
- Focused diagnostics on touched admin files report no editor/type problems.
- TASK-006 and TASK-007 remain intentionally deferred because queue-level dashboard expansion was not requested in this slice.

## Closure Record - 2026-04-30

- Changed files for this packet: `src/app/admin/customers/[id]/page.tsx`, `src/app/admin/customers/[id]/customer-360-client.tsx`
- Validation already recorded for the Customer 360 slice; no additional queue-level dashboard validation belongs to this packet.
- Follow-up trigger: create a new packet only if the user explicitly requests queue-level prompt-source visibility outside Customer 360.

## 3. Alternatives

- **ALT-001**: Show only the final composed prompt. Rejected because staff cannot tell whether the text came from raw customer input or a generated snapshot.
- **ALT-002**: Add an editable prompt authoring UI in the same packet. Rejected because the requested scope is visibility, not authoring.
- **ALT-003**: Put the raw fields only in the dashboard queue cards. Rejected because Customer 360 already has the richer context and avoids crowding high-density queue surfaces.

## 4. Dependencies

- **DEP-001**: `src/app/admin/customers/[id]/page.tsx`
- **DEP-002**: `src/app/admin/customers/[id]/customer-360-client.tsx`
- **DEP-003**: `src/lib/lead-ai-prompt.ts`
- **DEP-004**: `src/lib/backoffice-snapshot.ts`

## 5. Files

- **FILE-001**: `src/app/admin/customers/[id]/page.tsx` — data query must fetch the raw/source fields.
- **FILE-002**: `src/app/admin/customers/[id]/customer-360-client.tsx` — presentation target for the new read-only panel.
- **FILE-003**: `src/app/admin/admin-dashboard-sections.tsx` — optional follow-up target if queue-level visibility is later approved.

## 6. Testing

- **TEST-001**: Load Customer 360 for a customer with a lead that has only `design_brief` and verify the panel shows source-versus-snapshot distinction.
- **TEST-002**: Load Customer 360 for a lead with all three fields populated and verify labels and values are rendered separately.
- **TEST-003**: Confirm the panel gracefully handles all-null fields.

## 7. Risks & Assumptions

- **RISK-001**: If raw and derived prompt text are not labeled clearly, staff may still misread the snapshot as direct customer input.
- **RISK-002**: Queue-level duplication of the same information could add noise if pushed into the dashboard too early.
- **ASSUMPTION-001**: Customer 360 is an acceptable first admin surface for prompt-source visibility and can be extended later if queue-level demand appears.

## 8. Related Specifications / Further Reading

- `docs/FIGMA_DESIGN_SYSTEM_RULES.md`
- `src/lib/lead-ai-prompt.ts`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/CUSTOMER_HANDOFF_PACKAGE.md`