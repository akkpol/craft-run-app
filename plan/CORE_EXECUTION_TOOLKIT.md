---
title: Core Execution Toolkit
version: 1.0
date: 2026-05-02
owner: Operator + AI Agents
status: Active
---

# Core Execution Toolkit

Purpose: define the minimum mandatory toolkit to execute work safely without loop, drift, or scope bleed.

Operating mode:
- No multi-person team is assumed.
- One human operator controls execution.
- AI agents perform implementation and validation tasks under this contract.

## 1) Main Plan

Primary source:
- plan/process-go-live-waves-1.md

Rule:
- Use this as the single execution order.
- If another note conflicts, reconcile back to this plan.

## 2) Main Rules

Canonical policy source:
- docs/workflow-policy.json

Rule:
- No custom workflow states.
- No shortcut transitions.
- Payment gate and conversation states must follow policy exactly.

## 3) Anti-Loop Protocol

Mandatory protocol:
- plan/process-anti-loop-execution-1.md
- docs/START_HERE_CONTEXT_RECOVERY.md

Rule:
- One active packet only.
- Run worktree drift check before coding.
- Run impacted-surface tests first.
- Do not reopen completed packet unless explicitly requested.

## 4) Problem Analysis And Fix Flow

Use this flow on every issue before patching:

1. Symptom capture
- What failed
- Where it failed
- Exact timestamp or run context

2. Evidence capture
- Command output
- Relevant log line
- Target file and function

3. Root-cause analysis
- Immediate cause
- Systemic cause
- Why previous guard did not stop it

4. Fix design
- Minimal patch scope
- Risk assessment
- Rollback point

5. Validation
- Tier A: touched helper/unit tests
- Tier B: impacted route/UI checks
- Tier C: full regression only when release gate requires it

6. Closure record
- Changed files
- Commands executed
- Remaining risks
- Next actor (operator or specific AI agent)

## 5) Conflict Priority

If documents conflict, use this strict order:
1. docs/workflow-policy.json
2. plan/process-go-live-waves-1.md
3. plan/process-anti-loop-execution-1.md
4. active packet file
5. supporting notes

## 6) Mandatory Start Checklist

Before coding starts, all must be true:
- worktree checked and classified
- active packet selected
- in-scope and out-of-scope listed
- acceptance evidence defined
- rollback point identified

If any item is missing, stop and complete the checklist first.
