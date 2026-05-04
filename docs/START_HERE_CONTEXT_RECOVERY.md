---
title: Start Here Context Recovery
version: 1.0
date: 2026-04-27
owner: Delivery Engineering
status: Active
---

## Start Here Context Recovery

Use this file first when the session context is unstable, including:

- profile switched
- accidental checkout
- worktree switched
- machine restarted

## Mandatory First Read Order

1. `plan/README.md`
2. `plan/process-anti-loop-execution-1.md`
3. Current active packet file only, one packet at a time

When reading `plan/process-anti-loop-execution-1.md`, always read the `Central Tooling And Environment Matrix` and `Mandatory Work Update Matrix` sections before selecting or resuming a packet. These sections define the shared shell/tool/env baseline and the required update record after complete, incomplete, blocked, or tooling-changing work.

## Mandatory Worktree Check

1. Inspect the current git worktree before coding and classify `staged`, `unstaged`, and `untracked` changes.
2. If those changes span more than one packet or surface area, mark the repo state as unstable.
3. In an unstable state, do not start new feature work until one coherent slice is selected and the other slices are explicitly deferred, quarantined, or cleaned up.
4. Do not treat local changes by themselves as proof that an older packet is still active.

## Hard Recovery Rules

1. Do not start coding before Discovery Gate is complete in the active packet.
2. Do not mix multiple packets in one implementation pass.
3. Do not run full regression first; run impacted-surface validation first.
4. If a new requirement appears, stop and split to a new packet.

## Packet Activation Rule

- Only one packet may be active in a single implementation pass.
- `plan/feature-liff-ai-prompt-inputs-1.md` is complete and must not be reopened unless the user explicitly asks for follow-up on that packet.
- `plan/feature-admin-ai-prompt-source-visibility-1.md` is complete for the Customer 360 slice and must not be treated as active queue-level dashboard work.
- If the requested work does not map cleanly to one packet, stop and create a new packet before coding.

## Conflict Guard

If documents conflict, use this priority order:

1. `docs/workflow-policy.json`
2. `plan/process-go-live-waves-1.md`
3. `plan/process-anti-loop-execution-1.md`
4. Active packet file
5. Other supporting notes

## One-Page Delta Requirement

Every execution update must include:

- Done
- Remaining
- Risks

Keep updates short and packet-scoped.
