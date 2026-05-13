---
name: fogus-recovery-gate
description: 'Recover or resume work safely in craft-run-app after restart, context drift, unstable worktree, mixed local changes, packet confusion, PowerShell quirks, or secret-sensitive env checks. Use when the user asks to resume this repo, recover context, classify local changes, isolate one packet, validate before widening scope, or says "กลับ packet", "context หลุด", "เช็ก env แบบไม่โชว์ secret" in FOGUS.'
argument-hint: 'What FOGUS slice or failure needs recovery?'
metadata:
  author: akkpol
  version: "0.1.0"
---

# FOGUS Recovery Gate

Use this wrapper when craft-run-app feels unstable. It adapts the generic `recovery-validation-guard` workflow to the repo's packet discipline, validation commands, and recovery docs.

## When to Use

- Session restarted and the active packet is unclear
- Git state looks mixed across more than one surface
- The user says to resume work, go back to one packet, or recover context
- A failure may be shell, env, or tooling related rather than product logic
- You need safe env checks for LINE, Supabase, Vercel, or other integrations

## Mandatory Read Order

1. `docs/START_HERE_CONTEXT_RECOVERY.md`
2. Follow its mandatory first-read order: `docs/AUTO_RUN_FLOW_OWNER_MAP.md`, `plan/README.md`, `plan/process-anti-loop-execution-1.md`, then the active packet only
3. `AGENTS.md`
4. Repo-specific domain guard if needed, such as `AI_WORKFLOW_GUARD.md` or `docs/ENV_AND_LINE_SETUP.md`

## Procedure

1. Inspect the current worktree and classify `staged`, `unstaged`, and `untracked` changes.
2. Name one active packet or one coherent slice before coding.
3. If the worktree spans multiple packets or surfaces, stop broad implementation and isolate one slice first.
4. If env or secrets are involved, use the secret-safe checks from the installed `recovery-validation-guard` skill and map them against `docs/ENV_AND_LINE_SETUP.md` or `.env.example`.
5. If the issue looks like shell or tool corruption on Windows, apply the PowerShell recovery path from `recovery-validation-guard` before blaming product code.
6. Form one falsifiable local hypothesis, make the smallest grounded change, and run focused validation immediately.
7. Use impacted-surface validation first. Do not jump to full regression unless the release gate requires it.

## Validation Order In This Repo

1. Behavior-scoped check for the touched slice
2. Narrow test for the touched helper, route, or page
3. `npm run check:workflow-policy` for workflow-sensitive changes
4. `npm test` for the relevant slice or repo test suite when needed
5. `npm run lint` after route, middleware, or TypeScript changes
6. `npm run build` for production compilation confidence

## Non-Negotiables

- One packet at a time
- Do not reopen completed packets unless the user explicitly asks
- Do not print `.env.local` or secret values
- Do not treat tooling failures as product bugs without a fast discriminating check
- Do not invent workflow transitions outside the canonical workflow policy

## Completion Checks

- One active packet or slice is named
- Repo recovery docs were read in the right order
- Secrets were not echoed
- Focused validation ran before broader checks
- The update states done, remaining, risks, and whether tool or env assumptions changed

## Handoff

When the repo is stable again, continue with the domain skill that owns the actual implementation slice.