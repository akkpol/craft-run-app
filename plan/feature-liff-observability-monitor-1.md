---
goal: Isolate LIFF incident logging, trace correlation, and the admin LIFF Monitor surface into one coherent packet
version: 1.0
date_created: 2026-04-30
last_updated: 2026-04-30
owner: Delivery Engineering
status: Completed
tags: [feature, liff, observability, admin, trace]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This packet exists to keep LIFF incident capture and triage work together instead of letting it bleed into unrelated admin, docs, or workspace slices.

## Packet Contract

Goal

- Capture LIFF client and server failures with one shared trace path and review them from `/admin/liff-monitor`.

In Scope

- `src/app/liff/intake/intake-form.tsx`
- `src/app/api/intake/route.ts`
- `src/app/api/customers/prefill/route.ts`
- `src/app/api/liff/incidents/route.ts`
- `src/app/admin/liff-monitor/page.tsx`
- `src/app/admin/admin-sidebar.tsx`
- `src/lib/liff-observability.ts`
- `src/lib/intake-payload.ts`
- `tests/intake-payload.test.ts`

Out of Scope

- admin CTA/dashboard redesign work already staged in the admin slice
- operator handoff documents and go/no-go documentation updates
- workspace-only files such as `.vscode/*` and `.env.vault`
- unrelated runtime cleanup in quote, status, studio, or factory surfaces

Definition of Done

- LIFF client-side failures can be correlated through one fingerprint/trace path.
- Server-side LIFF failures write actionable incident records.
- `/admin/liff-monitor` can read and summarize recent incidents.
- Validation is recorded only for the touched LIFF slice.

## Discovery Gate

| Field | Required content |
|------|------------------|
| Known Facts | The current worktree already contains LIFF incident logging changes in intake, server routes, and a new admin monitor page. |
| Unknowns | Whether operator-facing runbook docs belong in this packet or should remain quarantined as a separate docs slice. |
| Assumptions | Operator docs are not part of this feature packet and should stay out of the code-focused slice unless explicitly requested. |
| Out of Scope | Broad admin redesign, quote/status formatting cleanup, workspace config files, and package metadata churn. |
| Decision Owner | Delivery Engineering for packet boundaries; product owner if operator docs must ship in the same pass. |

Unknown handling rule:

- Default to keeping docs and workspace files quarantined unless the user explicitly asks to ship them with this packet.

## Files In Current Local Slice

- `src/app/liff/intake/intake-form.tsx`
- `src/app/api/intake/route.ts`
- `src/app/api/customers/prefill/route.ts`
- `src/app/api/liff/incidents/route.ts`
- `src/app/admin/liff-monitor/page.tsx`
- `src/app/admin/admin-sidebar.tsx`
- `src/lib/liff-observability.ts`
- `src/lib/intake-payload.ts`
- `tests/intake-payload.test.ts`

## Closure Rule

- Do not mix this packet with the staged admin CTA slice.
- Do not absorb operator docs into this packet without an explicit user ask.
- If quote/status/studio cleanup must continue, split that into a new packet instead of widening this one.

## Execution Update - 2026-04-30

Done

- Kept the LIFF observability changes inside the declared packet scope only.
- Confirmed editor diagnostics report no errors for every in-scope file.
- Confirmed the focused helper test passes with `node --test tests/intake-payload.test.ts`.

Remaining

- No code work remains inside this packet.
- Live operator validation and handoff docs stay outside this packet unless explicitly requested.

Risks

- The code slice is complete, but live LINE or LIFF runtime behavior still needs separate operator evidence before any go/no-go claim.
- Admin CTA staging remains a separate slice and must not be mixed into the LIFF packet commit by default.

## Closure Record - 2026-04-30

Changed files

- `src/app/liff/intake/intake-form.tsx`
- `src/app/api/intake/route.ts`
- `src/app/api/customers/prefill/route.ts`
- `src/app/api/liff/incidents/route.ts`
- `src/app/admin/liff-monitor/page.tsx`
- `src/app/admin/admin-sidebar.tsx`
- `src/lib/intake-payload.ts`
- `src/lib/liff-observability.ts`
- `tests/intake-payload.test.ts`

Validation executed

- Editor diagnostics via `get_errors` on all in-scope files: no errors found.
- `node --test tests/intake-payload.test.ts`: pass (2 tests, 0 failures).

Blocked items

- None inside this packet.

Next packet trigger

- Resume only if the user explicitly asks for live LIFF validation follow-through, LIFF monitor UX follow-up, or operator-document shipping.