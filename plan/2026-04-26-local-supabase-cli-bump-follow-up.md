---
goal: Evaluate deferred local Supabase CLI package bump
version: 1.0
date_created: 2026-04-26
last_updated: 2026-04-26
owner: Delivery Engineering
status: Backlog
tags: [supabase, cli, dependency, follow-up]
---

# Local Supabase CLI Bump Follow-up

## Role In Plan Stack

This file is not the main delivery plan.

It is a standalone tooling follow-up for one deferred local dependency task only: evaluating a Supabase CLI package bump after the current landing and validation work is stable.

Use these files as the primary references first:

- [process-go-live-waves-1.md](process-go-live-waves-1.md) - main execution plan
- [2026-04-25-main-landing-consolidated-plan.md](2026-04-25-main-landing-consolidated-plan.md) - landing coordination and merge status

Return to this file only when the branch is ready to handle the Supabase CLI bump as a separate tooling change.

## Reason For Separation

The current branch is focused on migration parity and post-merge validation on `main`.
An unrelated local-only dependency change was left in the working tree:

- `supabase` devDependency: `^2.92.1` -> `^2.95.3`

This change has been removed from the current branch so it can be handled as a standalone task.

## Follow-up Scope

- Review Supabase CLI release notes between `2.92.1` and `2.95.3`
- Confirm the repo's CLI workflows still behave as expected with the newer package
- Re-run the commands this repo depends on via `--help` discovery before adopting the bump

## Validation Checklist

- `npm ci`
- `npx supabase --version`
- `npx supabase --help`
- `npx supabase migration --help`
- `npx supabase db --help`
- Re-run any branch or migration command used in normal handoff flow if the version is upgraded

## Notes

- Treat this as a tooling task only; no application runtime dependency changes are required.
- If the bump is adopted later, include the regenerated lockfile in the same change.