---
goal: Create one compact owner/automation flow map so future implementation passes do not need to reread the full documentation stack before seeing the operating model
version: 1.0
date_created: 2026-05-04
last_updated: 2026-05-04
owner: Delivery Engineering
status: Complete
role: scoped documentation plan
tags: [docs, workflow, owner-map, automation, context-recovery]
---

# Docs Flow Owner Map Quick Reference

## Packet Contract

Goal: Add a compact markdown flow map that shows state, owner, automation mode, decision rule, primary surface, and how work continues.

In scope:

- `docs/AUTO_RUN_FLOW_OWNER_MAP.md`
- `docs/START_HERE_CONTEXT_RECOVERY.md`
- `plan/README.md`
- this packet file

Out of scope:

- Figma design file creation
- workflow state or transition behavior changes
- admin UI refactor
- event processor/idempotency implementation
- production deploy

Definition of done:

- One markdown file can answer who owns each state, what the system does, what humans/customers do, and what decision moves the job forward.
- The recovery doc points to the quick flow map so future agents read it before long-form docs.
- Plan index registers this packet.
- Docs-only validation records no whitespace issues and no workflow-policy drift.

## Discovery Gate

Known facts:

- Canonical workflow policy is `docs/workflow-policy.json`.
- Executable owner/automation contract is `src/lib/workflow-owner-map.ts`.
- The user asked for a visible end-to-end map before more UI work.

Unknowns:

- Whether the final visual should also become a Figma board.

Assumptions:

- Markdown with Mermaid is the fastest durable artifact for repo recovery and future Figma translation.

Out of scope:

- No runtime behavior change in this packet.

Decision owner:

- User decides later whether this markdown map should be converted into a Figma board.

## Closure Record

Packet: `docs-flow-owner-map-quick-reference-1.md`
Date: 2026-05-04
Owner: Delivery Engineering

Done:

- Added `docs/AUTO_RUN_FLOW_OWNER_MAP.md` with one-screen Mermaid flow, owner table, decision rules, UI implication, and recovery shortcut.
- Updated `docs/START_HERE_CONTEXT_RECOVERY.md` to read the quick flow map before long-form packet docs.
- Registered this packet in `plan/README.md`.

Validated:

- Mermaid diagram rendered successfully with `renderMermaidDiagram`.
- Editor diagnostics reported no errors for the new quick-reference doc, this packet file, `docs/START_HERE_CONTEXT_RECOVERY.md`, or `plan/README.md`.
- `npm run check:workflow-policy` passed.
- `git diff --check` returned no whitespace errors.

Remaining:

- Optional future packet: convert the Mermaid/table into a Figma operations map.
- Optional future packet: consume `src/lib/workflow-owner-map.ts` in admin queue UI.

Risks:

- This doc summarizes current behavior and owner-map intent. If policy/runtime changes later, update this doc in the same pass.
- Existing untracked `docs/PRODUCTION_OWNER_REVIEW_2026-05-04.md` remains unrelated QA note work and is not part of this packet.

Tool/env changed:

- No.