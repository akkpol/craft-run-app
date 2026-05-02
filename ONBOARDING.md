# Welcome to FOGUS

## How We Use Claude

Based on Akkapol's usage over the last 30 days (3 sessions):

Work Type Breakdown:
  _TODO — not enough session data to classify_

Top Skills & Commands:
  /review        ████░░░░░░░░░░░░░░░░  1x/month
  /update-config ████░░░░░░░░░░░░░░░░  1x/month
  /claude-api    ████░░░░░░░░░░░░░░░░  1x/month
  /cost          ████░░░░░░░░░░░░░░░░  1x/month

Top MCP Servers:
  _None configured yet_

## Your Setup Checklist

### Codebases
- [ ] craft-run-backup-20260415 — github.com/akkpol/craft-run-backup-20260415

### MCP Servers to Activate
- [ ] _None configured — ask Akkapol if any are used for Supabase or LINE integrations_

### Skills to Know About
- `/review` — Reviews an open PR (or lists PRs if no number given). Use it before merging to get a structured code review with correctness, security, and style feedback.
- `/update-config` — Edits Claude Code `settings.json` for hooks, permissions, and env vars. Use it to set up automated behaviors like auto-formatting or allowed commands.
- `/claude-api` — Helps build, debug, and optimize Anthropic SDK / Claude API code. Triggers automatically when you're working with `anthropic` imports or prompt caching.
- `/cost` — Shows session token usage and cost. Handy for keeping an eye on spend during long sessions.

## Team Tips

- Start with `README.md` for install, local run, route entry points, and the document map.
- Use `docs/START_HERE_CONTEXT_RECOVERY.md` before continuing old work after context drift, branch confusion, or a machine restart.
- Use `docs/ENV_AND_LINE_SETUP.md` when the blocker is env wiring, LINE Messaging API, or LIFF registration.
- Use `docs/GO_NOGO_REVIEW.md` when the blocker is launch readiness, evidence capture, or operator sign-off.

## Get Started

1. Open `README.md` and complete the `Local Install And Run` section.
2. Copy `.env.example` to `.env.local` and fill only the values you actually need for the slice you are testing.
3. Run `npm run dev`, then verify `/admin`, `/liff`, and one public route.
4. Before changing workflow behavior, read `AI_WORKFLOW_GUARD.md` and `docs/workflow-policy.json`.

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
