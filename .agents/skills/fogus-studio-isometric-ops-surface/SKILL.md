---
name: fogus-studio-isometric-ops-surface
description: Build or refactor the FOGUS /studio route into a scene-first isometric operations surface that shows who owns each job, where it is blocked, and how work flows between stations. Use when the user wants /studio to feel like an isometric infographic, studio floor, operations map, or cute workflow scene instead of a dashboard; when deciding between DOM/CSS isometric composition and React Three Fiber; or when editing src/app/studio/studio-surface.tsx, src/app/globals.css, src/lib/studio-view.ts, or src/lib/backoffice-snapshot.ts.
---

# FOGUS Studio Isometric Ops Surface

## Overview

Use this skill when `/studio` should read as a spatial work scene instead of an admin board.

The target outcome is not just "prettier UI". The screen should answer, at a glance:

- who owns the work
- where the work is sitting now
- what is blocking it
- where it flows next

This skill is for the FOGUS ERP repo and assumes the route already lives in a Next.js App Router app with shared workflow state and admin actions.

## Default Technical Direction

Start with the existing DOM/CSS/Tailwind stack.

Prefer DOM/CSS isometric composition when:

- the scene is mostly a spatial metaphor for workflow
- stations are fixed landmarks
- tokens are lightweight cards, avatars, or job chips
- animation is atmospheric, not simulation-heavy
- the rest of the screen still needs normal React UI and admin controls

Escalate to React Three Fiber only when the scene needs real 3D behavior such as:

- camera movement as a primary interaction
- true 3D object placement or depth-driven navigation
- scene-driven gameplay-like interaction instead of a decorated operations surface
- continuous 3D simulation that would be awkward in layered DOM/CSS

If React Three Fiber is chosen, keep HUD and action panels in DOM.

## Use This Skill When

- the user says `/studio` feels like a dashboard and not a studio
- the user wants an isometric scene similar to infographic or settlement visuals
- the user wants work ownership to be more obvious than raw workflow metadata
- the user wants stations to feel like places instead of generic panels
- the user wants flow lines, handoff paths, or platform-based layout
- the user is deciding whether the scene should stay DOM/CSS or move to R3F

## Do Not Use This Skill When

- the task is a generic admin dashboard cleanup unrelated to `/studio`
- the user only wants colors, typography, or small polish changes
- the change is primarily workflow-policy logic rather than representation
- the scene truly needs a game-like 3D runtime from the start with no DOM-first phase

## Required Repo Context

Read these first:

1. `AI_WORKFLOW_GUARD.md`
2. `docs/workflow-policy.json`
3. `src/app/studio/page.tsx`
4. `src/app/studio/studio-surface.tsx`
5. `src/app/globals.css`
6. `src/lib/studio-view.ts`
7. `src/lib/backoffice-snapshot.ts`

Treat workflow policy as canonical. Do not invent new states, transitions, or call-to-action paths just to make the scene look better.

## Scene Design Rules

1. Represent stations as places, not cards.
   - Example mental model: desk, gate, corner, line, shelf, booth, couch.

2. Represent work as owned tokens.
   - Each visible token should show owner first, then work type, then blocker or progress signal.

3. Make the flow legible before the details.
   - The first read should reveal the route through the system.
   - Details belong in a secondary inspector or contextual panel.

4. Empty states must be quiet.
   - Empty stations should not dominate the scene more than active work.

5. Keep `/admin` as fallback.
   - `/studio` is the expressive scene surface, not the only place actions can exist.

6. Preserve mobile and reduced-motion dignity.
   - Desktop may carry the full scene.
   - Smaller breakpoints may simplify layout while preserving meaning.

## Workflow

### 1. Diagnose the mismatch

Compare the current `/studio` against the intended experience.

Look for these failure modes:

- reads like kanban or CRM instead of a studio floor
- owner is hidden, generic, or replaced with state names
- work flow is unclear without reading labels
- side inspector dominates the scene
- empty placeholders carry more visual weight than real work
- station blocks are uniform and flat instead of distinct places

### 2. Choose the rendering tier

Default to DOM/CSS.

Use DOM/CSS if you can achieve the effect with:

- layered gradients
- skewed or rotated floor planes
- pseudo-elements for depth and shadows
- animated flow lines
- positioned platforms and tokens
- compact DOM inspector panels

Choose R3F only if the user explicitly wants a true 3D scene or the interaction model clearly requires it.

### 3. Reframe the layout

Shift from "board plus sidebar" to "scene plus inspector".

Preferred hierarchy:

- scene floor first
- stations second
- tokens third
- inspector last

The inspector should support the scene, not compete with it.

### 4. Give each station a physical identity

Each station should have:

- a place metaphor
- a lane tone
- a unique silhouette or platform feel
- a role label that sounds human and operational

Examples in this repo family:

- Inbox / Sales
- Quote Desk
- Cashier Gate
- Design Corner
- Production Line
- Packing Shelf
- Hold Couch
- Review Booth
- Archive Shelf

### 5. Make ownership obvious

Every token should expose:

- owner avatar or initials
- owner label or role label
- token kind
- signal state such as blocked, active, escalated, done

Do not let workflow-state jargon replace ownership.

### 6. Make the route visible

Show the critical path spatially.

Good tools include:

- connector lines
- lane glow
- platform sequencing
- directional markers
- grouped critical-path vs branch zones

### 7. Keep actions real but visually secondary

Real admin actions still matter, but they should live in a compact inspector or drawer.

Avoid a heavy permanent right rail if it turns the scene back into a dashboard.

### 8. Validate the result

Check whether a new viewer can answer these questions in under a few seconds:

- who owns this work now
- where is it blocked
- what is waiting on payment or review
- what should happen next

## File Responsibilities

- `src/app/studio/page.tsx`
  - keep route wiring simple and data loading server-side

- `src/app/studio/studio-surface.tsx`
  - own scene composition, selection model, inspector behavior, and token/station interaction

- `src/app/globals.css`
  - own the visual language for floor, platforms, tokens, glows, motion, and reduced-motion fallbacks

- `src/lib/studio-view.ts`
  - map workflow state into station placement, owner labels, blocker summaries, and display-ready token metadata

- `src/lib/backoffice-snapshot.ts`
  - keep shared data fetches aligned with `/admin` so `/studio` does not drift from the real system

## Completion Checks

The work is not complete until all of these are true:

1. `/studio` no longer reads primarily as a dashboard.
2. The critical path is spatially legible.
3. Ownership is visible on tokens without opening the inspector.
4. Empty stations are visually subordinate to active work.
5. `/admin` fallback remains available.
6. No new workflow states or policy violations were introduced.
7. Reduced-motion behavior remains sane.
8. If workflow-sensitive code changed, run `node scripts/workflow-policy-smoke.mjs`.
9. If UI code changed materially, run `npm run build` and call out anything not verified.

## Anti-Patterns

- adding cute animation on top of a fundamentally dashboard-shaped layout
- using state names as a substitute for human ownership
- permanent glass-card sidebars that compete with the scene
- giant empty placeholders inside every station
- forcing R3F just because the visual reference looks 3D
- moving workflow logic into visual components
- inventing new business states to fit a visual metaphor

## Suggested Output Style

When using this skill, explain the change in three layers:

1. what is wrong with the current representation
2. what visual model should replace it
3. what files need structural vs styling changes

## Related Skills

- `build-fogus-erp`
- `react-three-fiber-game` only when the DOM/CSS path is no longer enough