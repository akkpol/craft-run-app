---
name: build-fogus-erp
description: Build or update the FOGUS digital signage and print ERP built on Next.js 16.2, Supabase, Vercel, LINE Messaging API, and LIFF. Use when implementing or modifying FOGUS routes, LIFF pages, webhook handlers, quote and job workflow, admin dashboard, environment configuration, LINE notifications, or customer/admin state transitions in this project.
---

# Build FOGUS ERP

## Overview
Use this skill for repo-specific work on FOGUS. Treat the locked stack, workflow states, route contracts, and LINE/LIFF/Supabase rules as product requirements rather than optional guidance.

## Quick Start
1. Read `AI_WORKFLOW_GUARD.md` and `docs/workflow-policy.json` first for the canonical workflow contract.
2. Read `references/locked-spec.md` for non-negotiable constraints.
3. Read `references/customer-flow.md` when the task changes customer journey, admin behavior, escalation, or approval/status flow.
4. Keep changes aligned with the current repo setup in `package.json` and `next.config.ts`; do not regress to pre-2026 Next.js or legacy Supabase patterns.

## Hard Rules
- Preserve the locked stack: Next.js 16.2.x, React 19, Supabase, Vercel, LINE Messaging API, LIFF v2.28.
- Treat `docs/workflow-policy.json` as canonical and `docs/WORKFLOW_TRANSITION_TABLE.md` as derivative only.
- Preserve the hardcoded workflow states exactly as defined in `src/lib/types.ts`: `NEW_MESSAGE -> COLLECTING_REQUIREMENTS -> REQUIREMENTS_REVIEW -> WAITING_QUOTE_APPROVAL -> WAITING_PAYMENT -> IN_DESIGN -> IN_PRODUCTION -> READY_FOR_FULFILLMENT -> COMPLETED`, with `ON_HOLD_CUSTOMER_INPUT`, `HUMAN_REVIEW_REQUIRED`, and `CANCELLED` handled explicitly.
- Keep webhook processing stateless and backed by the database.
- Keep `SUPABASE_SECRET_KEY` server-only.
- Use Push messages for async updates; do not rely on Reply messages after the webhook turn.
- Every LIFF page needs safe-area bottom padding.
- The registered LIFF endpoint is `/liff`; `/liff/intake` is the intake form page reached from there.
- Quote approval and payment handling must stay aligned with `src/lib/quote-workflow.ts`; approval may stop at `WAITING_PAYMENT` and should only create a job when payment terms unlock production.

## Working Pattern

### Route and state work
- Match route handlers and public pages to the contracts in `references/locked-spec.md`.
- In Next.js 16 dynamic routes, await `props.params` before using route params.
- When changing state transitions, compare the result to both the happy path and escalation paths in `references/customer-flow.md`.

### LINE and LIFF work
- Call `liff.requestFriendship()` only after `liff.init()`.
- Keep the message -> LIFF -> intake -> quote -> approve -> payment gate -> job -> status sequence intact.
- Preserve the Thai escalation keywords and manual-review branch behavior.

### Supabase and server work
- Use publishable-key clients for browser and SSR contexts; use the secret-key client only in server-only code.
- Store all dimensions in mm and convert units at the intake boundary.
- Keep workflow state, quote creation, payment gating, job creation, and timeline writes explicit in the database.

### UI and copy work
- Prefer mobile-safe, LINE-friendly pages with minimal friction.
- Use `references/customer-flow.md` as the source of truth for what the customer and admin see first.

## Read These References
- `references/locked-spec.md`: stack, env vars, routes, database model, implementation patterns, anti-patterns, deployment notes.
- `references/customer-flow.md`: customer journey, admin journey, escalation paths, workflow states, and smoke-test expectations.

## Deliverables Checklist
- Mention which routes or files changed.
- State whether workflow states, route contracts, or env vars were affected.
- Call out any LINE Console, LIFF, or Supabase configuration required to make the change work.
- Run `node scripts/workflow-policy-smoke.mjs` when workflow policy or workflow surfaces changed.
- If webhook or LIFF behavior could not be tested end to end, say so explicitly.
