---
goal: Refactor the /admin/prompts page into an owner-aware design workbench without changing prompt or preview APIs
version: 1.0
date_created: 2026-05-05
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [admin, prompts, ai-preview, design, owner-map, ux]
---

# Feature: Admin Prompts Owner Surface

## Packet Contract

Goal: turn `/admin/prompts` into a design operations workbench that shows which leads are ready for prompt work, which are already inside the preview loop, and which still lack enough context before AI should run.

In Scope:

- `/admin/prompts` page only.
- Reuse existing prompt composition helpers and workflow owner contract for `IN_DESIGN`.
- Preserve the existing prompt-edit and AI-preview actions.

Out of Scope:

- No prompt-generation API changes.
- No `/studio` refactor.
- No workflow state changes.
- No deploy or production mutation.

Definition of Done:

- `/admin/prompts` is grouped into owner-aware prompt lanes instead of a flat prompt list.
- Each card explains why the lead is in that lane, what evidence supports the classification, and what action should happen next.
- Existing prompt/preview/design actions remain usable.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- `prepareLeadAiPrompt()` already resolves whether a lead has a usable prompt and what the prompt seed is.
- `IN_DESIGN` owner and automation rules already exist in `src/lib/workflow-owner-map.ts`.
- The existing page already has the right mutation controls through prompt and preview actions.

Unknowns:

- Whether operators need a separate lane for failed AI generations or whether retry-ready items can stay in the same prompt-ops lane. Decision: defer with fallback and keep failures inside the prompt-ops lane with explicit stop-reason copy.

Assumptions:

- A first-pass lane model of `ready`, `active`, and `missing` is enough to make `/admin/prompts` operationally clearer without adding new APIs.

Decision Owner:

- Delivery Engineering.

## Acceptance Evidence

- Run `npm run lint -- src/app/admin/prompts/page.tsx`.
- Check editor diagnostics for the touched page.
- Run `git diff --check` before closing.

## Closure Record

Packet: `feature-admin-prompts-owner-surface-1.md`
Date: 2026-05-05
Owner: Delivery Engineering

Done:

- Refactored `src/app/admin/prompts/page.tsx` from a flat prompt list into an owner-aware design workbench with `Prompt Ops`, `Preview Loop`, and `Need Context` lanes.
- Added lane classification using the existing prompt composition helper, AI image status, preview counts, and design status.
- Kept the existing prompt, AI preview, send-preview, and design-status actions available on each lead card.

Validated:

- `npm run lint -- src/app/admin/prompts/page.tsx` returned no lint errors.
- Editor diagnostics reported no errors for the touched page.
- `git diff --check` returned no output.

Remaining:

- `/studio` and any deeper preview-approval orchestration remain separate packets.

Risks:

- Lane classification is derived from the current lead fields, so if operators later need preview-asset quality signals or staff assignment on this page, that requires a dedicated follow-up packet.

Tool/env changed:

- No.