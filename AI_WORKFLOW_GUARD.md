# AI Workflow Guard

This repository uses one workflow contract for every AI agent. Keep Claude, Copilot, Cursor, GitHub agents, and Codex aligned to the same runtime policy instead of maintaining separate workflow interpretations.

## Canonical Policy

- `docs/workflow-policy.json` is the canonical machine-readable workflow policy.
- `src/lib/workflow-policy-core.mjs` is the runtime helper layer that loads and enforces that policy.
- `docs/WORKFLOW_TRANSITION_TABLE.md` is a readable derivative, not a second source of truth.

## Required Read Order

1. `AI_WORKFLOW_GUARD.md`
2. `docs/workflow-policy.json`
3. The affected files listed in `docs/workflow-policy.json -> meta.canonicalSources`

## Non-Negotiables

- Do not invent workflow states, shortcut transitions, UI CTAs, or actor permissions outside `docs/workflow-policy.json`.
- Quote approval does not always create a job. Follow `quote_payment.unlockRules` and the `WAITING_PAYMENT` gate exactly.
- Do not offer `approve_quote` once a bundle is payment-gated or already approved.
- Treat `design_status=revision_requested` as team-owned until `preview_sent` returns.
- Do not reuse `COMPLETED` or `CANCELLED` conversations for new intake work.
- If workflow behavior changes, update the policy JSON, runtime helpers, affected routes or UI, and derivative docs in the same change.

## Codex Enforcement

- Codex is the strict workflow checker for this repo.
- For workflow-sensitive work, validate against the MCP or local equivalents of:
  - `getWorkflowPolicy()`
  - `validateTransition()`
  - `getAllowedActions()`
  - `getUiContract()`
- Run `node scripts/workflow-policy-smoke.mjs` after changing workflow policy, workflow UI, or workflow transition code.
- If prose docs conflict with the JSON policy or runtime helpers, the JSON policy and runtime helpers win.

## Escalation Rule

- If a request conflicts with the current workflow policy, do not silently improvise. Update `docs/workflow-policy.json` and the affected runtime code together, or stop and call out the conflict explicitly.
