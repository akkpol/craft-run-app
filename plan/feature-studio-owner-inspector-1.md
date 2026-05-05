---
goal: Refine /studio into a clearer owner-aware operations surface by localizing the operator copy and adding workflow-contract guidance in the inspector
version: 1.0
date_created: 2026-05-05
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [studio, owner-map, design, ops, ux]
---

# Feature: Studio Owner Inspector

## Packet Contract

Goal: keep the existing scene layout in `/studio`, but make the operator layer explain who owns each token, why the work is blocked, and what action should happen next using the workflow owner contract.

In Scope:

- `src/lib/studio-view.ts`
- `src/app/studio/studio-surface.tsx`
- Thai-first operator copy and inspector guidance only.

Out of Scope:

- No new workflow states.
- No major scene-layout rewrite.
- No `/studio` data-fetch changes.
- No deploy or production mutation.

Definition of Done:

- Studio inspector shows stop reason, workflow summary, next action owner, and primary surface.
- Key operator copy is Thai-first instead of generic English dashboard language.
- Existing studio actions remain wired to the same real workflow controls.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- `/studio` already has the scene and action wiring; the current mismatch is mostly in the operator-facing explanation layer.
- `src/lib/workflow-owner-map.ts` already defines owner, next action owner, primary surface, summary, and human gate reasons per workflow state.
- `getStudioTokenMeta()` is the narrowest place to enrich token guidance without moving workflow logic into JSX.

Unknowns:

- Whether the board itself needs a deeper spatial redesign after the copy and inspector are fixed. Decision: defer; this packet stops at the owner-aware inspector layer.

Assumptions:

- Reusing the workflow owner contract is sufficient for the first `/studio` follow-up and avoids inventing separate studio-only guidance rules.

Decision Owner:

- Delivery Engineering.

## Acceptance Evidence

- Run `npm run lint -- src/app/studio/studio-surface.tsx src/lib/studio-view.ts`.
- Check editor diagnostics for the touched files.
- Run `git diff --check` before closing.

## Closure Record

Packet: `feature-studio-owner-inspector-1.md`
Date: 2026-05-05
Owner: Delivery Engineering

Done:

- Enriched `getStudioTokenMeta()` with workflow-contract owner guidance, stop-reason labels, next action owner, and primary surface metadata.
- Updated `src/app/studio/studio-surface.tsx` so the drawer now explains why a token is blocked and what should happen next.
- Localized key `/studio` operator copy to Thai-first while preserving the existing scene and action surfaces.

Validated:

- `npm run lint -- src/app/studio/studio-surface.tsx src/lib/studio-view.ts` returned no lint errors.
- Editor diagnostics reported no errors in `src/lib/studio-view.ts`; `src/app/studio/studio-surface.tsx` still has one pre-existing inline-style warning in `StudioPrimitiveLayer` because the scene engine positions decorative primitives with computed placement values.
- `git diff --check` returned no output.
- Local browser verification rendered `/studio` after restarting the dev server with a temporary session-level `ADMIN_ALLOWED_EMAILS` value; the page showed the Thai-first operator copy and updated empty-state inspector on `http://localhost:3000/studio`.

Remaining:

- If the owner wants a deeper spatial redesign of the board itself, that should be a separate `/studio` layout packet.

Risks:

- Stop-reason selection in Studio is intentionally lightweight and derived from the workflow owner contract; if the team needs row-level finance/design evidence inside Studio, that requires a separate follow-up packet.
- The `StudioPrimitiveLayer` inline-style warning remains until the primitive placement system is refactored away from computed positioning.
- The local dataset used in this verification had zero visible tokens, so the token-specific inspector branch was not exercised through browser interaction in this pass.

Tool/env changed:

- No.