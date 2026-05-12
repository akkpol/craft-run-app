---
title: Windows Reinstall Recovery Checklist
version: 1.0
date: 2026-05-12
owner: Delivery Engineering
status: Active
---

# Windows Reinstall Recovery Checklist

Use this file when rebuilding the development machine for `craft-run-app` after a Windows reinstall.

## Remote Safety Points Already Created

- Active branch pushed: `fix/uat-smoke-release-20260504` at `1e222c3`
- Backup branch for former `stash@{0}`: `backup/2026-05-12-stash0-liff-inspector` at `96bbb94`
- Backup branch for former `stash@{1}`: `backup/2026-05-12-stash1-main-waiting-to-pending` at `25c9aa2`

If the local machine is wiped, these three branches are the primary git recovery points.

## Before Wiping This Machine

1. Backup local-only files that are not stored in git:
   - `.env.local`
   - `.vercel/project.json`
   - `.agents/`
   - `.claude/`
   - `.cursorrules`
   - evidence files under `output/`
2. Verify access to GitHub, Vercel, Supabase, and LINE Developers from a browser.
3. Keep a note of the Supabase project ref: `wpayfrvvnwqiygnwrlfp`.
4. Keep a note of the Vercel project name: `craft-run`.

## Fresh Machine Setup

Install the base toolchain first:

```powershell
winget install Microsoft.PowerShell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install GitHub.cli
winget install Microsoft.VisualStudioCode
```

Optional but useful tools:

```powershell
winget install BurntSushi.ripgrep.msvc
winget install sharkdp.fd
```

For this repo, `npx --yes supabase` is an accepted fallback if the global Supabase CLI is missing.

## Repository Restore

```powershell
git clone https://github.com/akkpol/craft-run-app.git
cd craft-run-app
git fetch origin
git checkout fix/uat-smoke-release-20260504
npm ci
```

If you need the backup branches:

```powershell
git fetch origin backup/2026-05-12-stash0-liff-inspector
git fetch origin backup/2026-05-12-stash1-main-waiting-to-pending
git checkout backup/2026-05-12-stash0-liff-inspector
git checkout backup/2026-05-12-stash1-main-waiting-to-pending
```

## Auth And Secret Restore

### GitHub

```powershell
gh auth login
gh auth status
```

### Vercel

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

Expected project: `craft-run`

### Supabase

```powershell
npx --yes supabase login
npx --yes supabase link --project-ref wpayfrvvnwqiygnwrlfp
npx --yes supabase migration list
```

Expected project ref: `wpayfrvvnwqiygnwrlfp`

### LINE Developers

Restore these values into `.env.local` from the LINE Developers console if they were not pulled from Vercel:

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LIFF_ID`
- `NEXT_PUBLIC_LIFF_ID`

Confirm the production URLs still match the deployed app:

- Webhook URL: `<base-url>/api/webhook`
- LIFF endpoint: `<base-url>/liff`

## VS Code Restore

1. Install GitHub Copilot and GitHub Pull Requests extensions.
2. Open the repo in VS Code.
3. Restore any local agent or editor configuration you backed up:
   - `.agents/`
   - `.claude/`
   - `.cursorrules`
   - optional workspace settings under `.vscode/`

## Repo Validation After Restore

Run these in order:

```powershell
npm run lint
npm run build
npm test
npm run check:line-liff-env
npm run check:workflow-policy
npm run ops:doctor
```

## Repo-Specific Notes

- PR `#41` tracks `fix/uat-smoke-release-20260504` into `main`.
- PR `#42` exists on GitHub as a draft follow-up for merge-readiness hardening.
- `npm run ops:doctor` currently reports Supabase migration drift with local-only migrations. Treat that as a known repo state to review, not as proof the reinstall failed. Use `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md` if drift work resumes.
- If chat context is unstable after the rebuild, resume from `docs/START_HERE_CONTEXT_RECOVERY.md`.

## Current Branch Packet Summary

The current branch now contains these separated commits:

- `bd8f747` `fix: harden intake validation and prefill consistency`
- `5fd8ddc` `fix: resolve owner surface links in queue and studio`
- `a23d718` `feat: add LIFF validation reporting harness`
- `f186a58` `feat: add LIFF validation run storage`
- `1e222c3` `chore: add ops doctor and LIFF validation runbook`