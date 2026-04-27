# Local GPT Image 2 Workflow For Studio

This repo now supports a local-only GPT Image 2 handoff for Studio and design preview work.

## What this is

- `gpt-image-2` is installed as an agent skill on the local machine.
- The repo wrapper is `scripts/invoke-gpt-image-2.ps1`.
- The Studio and admin design action sheet can now copy:
  - the raw prompt from the selected lead
  - a repo-local command for running GPT Image 2 from the developer machine

## What this is not

- Not a deployed provider.
- Not a replacement for `src/lib/ai-images.ts`.
- Not a backend route integration.
- Not a capability that works on Vercel or on shared staff machines unless they also have local prerequisites.

The current server runtime still uses the configured OpenAI image provider path in `src/lib/ai-images.ts` and `src/app/api/leads/[id]/ai-preview/route.ts`.

## Why Studio uses this path

`gpt-image-2` depends on a local `codex` login tied to the developer's ChatGPT subscription. That makes it a good fit for:

- Studio-side concept exploration
- reference-image remixing
- style transfer for mockups
- local review loops before assets are formalized in the product workflow

It is not suitable as a direct production provider for `/api/leads/[id]/ai-preview`.

## Prerequisites

Required on the local machine:

1. `bash`
2. `python3`
3. `codex`
4. `codex login` with an Image 2-capable ChatGPT plan

At the time this repo wiring was added, `bash` and `python3` were available in the current environment, but `codex` was not installed yet.

## Studio flow

From `/studio` or admin design actions:

1. Open the lead's `Design / AI Preview` action sheet.
2. Click `คัดลอก prompt` to put the raw lead prompt on the clipboard.
3. Click `คัดลอกคำสั่ง GPT Image 2` to copy the repo-local wrapper command.
4. Run the command from the repo root in PowerShell.

Dry-run first:

```powershell
pwsh -File .\scripts\invoke-gpt-image-2.ps1 -LeadId "<lead-id>" -PromptFromClipboard -DryRun
```

Run for real:

```powershell
pwsh -File .\scripts\invoke-gpt-image-2.ps1 -LeadId "<lead-id>" -PromptFromClipboard
```

Add one or more references:

```powershell
pwsh -File .\scripts\invoke-gpt-image-2.ps1 -LeadId "<lead-id>" -PromptFromClipboard -Ref "C:\path\ref-1.png" -Ref "C:\path\ref-2.jpg"
```

## Output path

If `-Out` is not provided, the wrapper writes to:

```text
tmp/gpt-image-2/lead-<lead-id>/image-<timestamp>.png
```

If no lead id is provided, output falls back to:

```text
tmp/gpt-image-2/image-<timestamp>.png
```

## Current limitation

This wiring stops at local asset generation and command handoff.

Feeding the generated image back into `lead_media_assets`, `ai_generated_images`, or a formal customer-review package remains a separate product task. That is intentional: the current design review flow still needs a proper managed asset-package model.