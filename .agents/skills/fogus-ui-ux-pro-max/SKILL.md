---
name: fogus-ui-ux-pro-max
description: 'UI/UX design intelligence for FOGUS on Next.js 16.2, React 19, Tailwind CSS v4, shadcn/ui, Supabase, Vercel, and LINE LIFF. Use when planning, building, reviewing, fixing, or refactoring customer LIFF pages, admin dashboards, quote and status pages, studio or factory surfaces, cards, forms, tables, charts, navigation, motion, accessibility, visual polish, layout systems, spacing, color, or typography in this repo. Triggers: landing page, dashboard, admin panel, LIFF, mobile UI, UX review, accessibility audit, styling bug, responsive issue, design system, visual consistency.'
argument-hint: '[surface or route] [goal]'
---

# FOGUS UI/UX Pro Max

## Overview
Use this skill whenever the task changes how FOGUS looks, feels, or is interacted with. This is a repo-adapted version of the UI/UX Pro Max workflow: it keeps the design-system-first approach, but anchors decisions to FOGUS constraints such as Thai-first customer flows, LINE LIFF safe areas, existing OKLCH tokens, shadcn/ui primitives, and the established customer/admin surface patterns.

## When to Use

### Must Use
- Designing or refactoring pages in `src/app/liff/`, `src/app/admin/`, `src/app/quote/`, `src/app/status/`, `src/app/factory/`, `src/app/production/`, or `src/app/studio/`
- Creating or restyling reusable UI such as cards, forms, tables, navigation, status chips, progress views, KPI blocks, or review surfaces
- Choosing colors, spacing, typography, interaction states, layout hierarchy, motion, iconography, or responsive behavior
- Reviewing UI code for clarity, accessibility, consistency, or perceived quality
- Fixing styling bugs such as broken hover states, overflow, cramped mobile layouts, weak contrast, or inconsistent panel structure

### Recommended
- The UI works functionally but feels generic, noisy, or visually inconsistent
- A new feature needs to fit an existing FOGUS surface without drifting into a separate visual language
- A user asks for a stronger product feel, better customer trust, clearer workflow status, or better mobile ergonomics

### Skip
- Pure backend, workflow, database, webhook, or integration tasks that do not change the interface
- Supabase schema or route changes with no user-facing impact
- Low-level bug fixes unrelated to visual behavior or interaction

## Required Context
1. Read `CLAUDE.md` for stack, styling, and workflow constraints.
2. Read `docs/FIGMA_DESIGN_SYSTEM_RULES.md` before visual implementation.
3. If the task affects workflow-sensitive screens or CTAs, read `AI_WORKFLOW_GUARD.md` and `docs/workflow-policy.json`.
4. If the task is specifically about `/studio`, load the `fogus-studio-isometric-ops-surface` skill instead of defaulting to dashboard patterns.
5. Inspect the target route and nearby components before proposing new structure or styles.

## Working Rules
- Preserve the established FOGUS visual language unless the task explicitly requests a redesign.
- Use existing tokens and semantic utilities from `src/app/globals.css`; do not hardcode hex values in components.
- Use Geist as the font system for this repo; do not introduce ad hoc font families.
- Reuse `src/components/ui/` primitives first, then extend them with `className` and `cn()`.
- Use `lucide-react` for icons; do not use emoji as interface icons.
- LIFF surfaces must preserve safe-area padding and one-thumb mobile ergonomics.
- Admin surfaces should reuse `.admin-shell`, `.admin-panel`, and `.admin-kpi-card` patterns where appropriate.
- Respect Thai locale and content density; avoid English-first placeholder UX on customer-facing flows.
- Do not invent workflow states, unsupported CTAs, or status actions outside the policy contract.
- Do not add CSS Modules, Styled Components, or legacy React memoization patterns that conflict with the current stack.

## Surface Guide

### LIFF Customer Surfaces
- Default to `.liff-shell` and `.liff-panel`.
- Prioritize trust, clarity, short forms, large touch targets, and obvious next actions.
- Keep copy concise and mobile-safe; watch Thai text wrapping and safe-area bottom spacing.

### Admin Backoffice Surfaces
- Default to `.admin-shell` and `.admin-panel`.
- Optimize for scan speed, operational clarity, and dense but readable information.
- Use KPI cards, filters, and status grouping only when they reduce cognitive load.

### Quote and Status Pages
- Focus on decision confidence, progress clarity, payment state, and next-step visibility.
- Make blockers and waiting states explicit.
- Preserve workflow terminology and customer-safe wording.

### Studio and Factory Surfaces
- Prioritize flow visibility, ownership, blockers, and station handoff clarity.
- Avoid generic dashboard grids when the task calls for spatial or operational storytelling.

## Procedure

### Step 1: Analyze the Request
Extract the following before making design decisions:
- Surface: LIFF, admin, quote, status, factory, production, or studio
- User role: customer, staff, reviewer, operator, or owner
- Primary action: submit, approve, review, advance, inspect, or monitor
- Workflow sensitivity: whether states, payment gates, or CTAs must match policy exactly
- Device context: mobile-first, desktop-first, or mixed
- Success metric: speed, clarity, trust, completion rate, scannability, or reduced errors

### Step 2: Lock Constraints
Read the relevant repo sources and treat them as requirements:
- `CLAUDE.md` for stack and implementation rules
- `docs/FIGMA_DESIGN_SYSTEM_RULES.md` for token and component translation
- `docs/workflow-policy.json` for state-driven UI constraints when status or approvals appear

Then identify what already exists:
- Shell or panel pattern already used on the target surface
- Nearby components worth reusing
- Existing tokens, radii, spacing, and icon patterns

### Step 3: Choose a Visual Direction
Pick one clear direction that fits the surface instead of mixing styles.

Examples:
- LIFF: calm, guided, trust-building, frosted-card mobile flow
- Admin: operational, sharp, high-contrast, scan-first command surface
- Quote/status: reassuring, milestone-based, progress-first customer tracking
- Studio/factory: scene-first or station-first operations map

The direction must be expressed through composition, spacing, contrast, status framing, and motion. In this repo, novelty should come from structure and hierarchy, not from introducing unrelated fonts or random gradients.

### Step 4: Map Decisions to the System
- Colors: use semantic tokens such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`
- Radius: match the existing rounded scale and shell patterns
- Typography: use Geist with a clear scale, generous line-height, and Thai-friendly wrapping
- Components: prefer existing shadcn/ui primitives and compose from them
- Icons: map concepts to `lucide-react` icons
- Motion: use purposeful 150-300ms transitions and respect reduced motion

### Step 5: Implement With Surface Discipline
- Build mobile-first unless the route is clearly backoffice-only
- Keep forms short and obvious on LIFF surfaces
- Keep dense information grouped and scannable on admin surfaces
- Avoid layout shift, horizontal scroll, and ambiguous action priority
- Be explicit with `"use client"` and server/client boundaries under `src/app`

### Step 6: Run the Review Pass
Check the result against these categories:

#### Accessibility
- Contrast is sufficient for text and status indicators
- Focus states are visible
- Icon-only controls have labels
- Form fields have labels and validation feedback
- Information is not conveyed by color alone

#### Touch and Interaction
- Touch targets are comfortable on mobile
- Hover, active, loading, disabled, and error states are obvious
- Primary actions are visually dominant

#### Layout and Responsive
- No horizontal scroll at common widths
- Spacing scale is consistent
- Critical actions remain visible on small screens
- Thai copy does not collapse the layout

#### Visual Consistency
- Tokens are reused instead of hardcoded one-offs
- Shell/panel patterns match the surface family
- Icons, radii, shadows, and borders feel related

#### Workflow Clarity
- Status language matches the actual workflow
- Waiting states and blockers are clear
- The next action is obvious and policy-safe

### Step 7: Verify and Report
- Run `npm run lint` when the change touches TypeScript, routes, or JSX structure in a meaningful way
- Manually verify the target screen at mobile and desktop sizes when relevant
- State what was verified and what remains untested

## Anti-Patterns
- Hardcoded hex colors or arbitrary token bypasses in component code
- New font families that drift from the current design system
- Purple-on-white AI default gradients that clash with the product
- Emoji used as UI icons
- Dense desktop forms copied directly into LIFF
- New bespoke controls where an existing primitive is sufficient
- Unsupported workflow CTAs or status labels
- Generic KPI dashboards for studio work that should show flow and ownership

## Deliverables Checklist
- Name the target surface and chosen visual direction
- Mention which existing tokens, shell patterns, or components were reused
- Call out accessibility and responsive decisions
- State whether workflow-sensitive UI was checked against the policy
- Say what verification was completed

## Example Prompts
- `Refactor the LIFF intake page to feel calmer and clearer on small phones without changing the workflow.`
- `Review the admin quote screen for visual hierarchy, spacing, and accessibility issues.`
- `Make the public status page feel more trustworthy and progress-oriented while preserving the current states.`
- `Polish the production review UI so blockers, approvals, and next actions are easier to scan.`
