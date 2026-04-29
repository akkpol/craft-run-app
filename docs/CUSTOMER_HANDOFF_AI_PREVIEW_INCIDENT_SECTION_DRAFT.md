---
title: Draft Section — Customer Handoff Package AI Preview Incident Handling
version: 0.1
date: 2026-04-27
owner: Delivery Engineering
status: Draft
target_document: docs/CUSTOMER_HANDOFF_PACKAGE.md
placement_note: Insert after the existing support and escalation section and before build evidence, then renumber the following sections if needed.
---

## AI Preview Incident Handling

Use this section when staff cannot generate an AI design preview from the admin surface.

### What the operator should check first

1. Retry with one affected lead only.
2. Record the exact error shown in the admin UI.
3. Check the failed lead's `ai_image_error` value.
4. Check Vercel logs for `POST /api/leads/[id]/ai-preview`.

### Typical failure modes

| Signal | Meaning | Owner |
|--------|---------|-------|
| `AI image generation is not configured` | AI runtime is disabled or the API key is missing | Delivery Engineering |
| `Unsupported AI image provider` | Provider setting does not match the runtime supported by the app | Delivery Engineering |
| Invalid key / auth / insufficient quota / billing error | Provider rejected the configured key or account | Delivery Engineering, then Business/Billing owner if quota or billing is the cause |
| `AI image provider request failed` or provider 5xx/timeout | Upstream provider instability | Delivery Engineering |
| Storage upload error after generation | App could not store or publish the generated image | Delivery Engineering |

### Temporary fallback

- Do not block the lead entirely if AI preview is unavailable.
- Move the affected lead through manual design handling until one AI preview test succeeds again.
- Tell the customer that preview generation is delayed, not the full order.

### Escalation package

When handing the issue off, include:

- lead ID
- Bangkok timestamp of first failure
- exact UI error text
- exact `ai_image_error` value
- Vercel log lines for the failed request
- whether `/admin/settings` or env vars were recently changed
- whether the issue affects one lead or all leads

### Configuration owners

- Operator: collect evidence and stop repeated retries
- Delivery Engineering: runtime config, API key source, provider response, storage path
- Business owner or billing owner: provider quota, account suspension, or payment problems