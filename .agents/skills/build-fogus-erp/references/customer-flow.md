# Customer Flow

Source documents for deeper context:
- `../../../../fogus-flow.html`
- `../../../../CLAUDE.md`
- `../../../../FOGUS_FINAL_SPEC.md`

## Happy path
1. Customer sends a LINE message.
2. Webhook saves the message, verifies signature, and replies with a Flex Message that contains the LIFF link.
3. Customer opens LIFF inside LINE.
4. Customer fills the intake form.
5. `POST /api/intake` normalizes dimensions to mm and creates the lead.
6. If data is incomplete, the workflow moves to `ON_HOLD_CUSTOMER_INPUT` until the customer adds enough detail.
7. If data is complete, the API creates the quote and moves the conversation to `WAITING_QUOTE_APPROVAL`.
8. LIFF shows success and can close.
9. Customer receives the quote link in LINE.
10. Customer opens `/quote/[token]` and approves.
11. `POST /api/quotes/[id]/approve` either moves the flow to `WAITING_PAYMENT` or creates the job and first timeline entry at `IN_DESIGN`.
12. Admin updates job status, the customer receives a LINE notification, and `/status/[token]` shows progress until completion.

## State progression
```text
NEW_MESSAGE -> COLLECTING_REQUIREMENTS -> REQUIREMENTS_REVIEW ->
WAITING_QUOTE_APPROVAL -> WAITING_PAYMENT? -> IN_DESIGN ->
IN_PRODUCTION -> READY_FOR_FULFILLMENT -> COMPLETED
```

Use `ON_HOLD_CUSTOMER_INPUT` and `HUMAN_REVIEW_REQUIRED` as explicit branches, not hidden notes on the main sequence.

## Customer-facing surfaces
- LINE chat: message intake, LIFF link, quote link, status updates.
- LIFF pages: `/liff` entrypoint and `/liff/intake` form.
- Quote page: `/quote/[token]`.
- Status page: `/status/[token]`.

## Admin journey
1. Admin logs in.
2. Admin dashboard shows leads, quotes, jobs, and escalations.
3. Admin can adjust payment terms and payment status before a job exists.
4. Once payment terms unlock production, approval or commercial updates create the job at `IN_DESIGN`.
5. Admin updates job status through `POST /api/jobs/[id]/status`.
6. Customer receives a push notification with the new status.

## Escalation paths
Escalate to `HUMAN_REVIEW_REQUIRED` when either of these happens:
- The customer asks to talk to a human or admin.

Move to `ON_HOLD_CUSTOMER_INPUT` when intake data is incomplete and the customer needs to add more detail before quoting can continue.

When escalating:
- Create an escalation record.
- Preserve the underlying customer conversation context.
- Reply with a human handoff message rather than pretending automation can continue.

## Flow-specific implementation notes
- The LIFF endpoint registered in LINE Console is `/liff`.
- The intake page still lives at `/liff/intake`.
- The success state should feel final enough that the customer can safely leave LIFF and return to LINE.
- Quote approval must be idempotent enough to avoid duplicate jobs if the customer retries.
- Status updates should reflect the latest job timeline entry.

## Smoke-test checklist
- Customer message triggers a LIFF link reply.
- LIFF opens inside LINE.
- `liff.requestFriendship()` is called after `liff.init()`.
- Intake submission creates the expected database records.
- Incomplete intake moves the conversation to `ON_HOLD_CUSTOMER_INPUT`.
- Quote page loads by token.
- Approval either creates a job or parks the conversation at `WAITING_PAYMENT`, depending on payment terms.
- Admin dashboard shows current records.
- Status page shows the latest status.
- Escalation branch works for keyword-triggered human handoff.
- Android safe-area padding is visible.
- No LIFF initialization console errors occur.
