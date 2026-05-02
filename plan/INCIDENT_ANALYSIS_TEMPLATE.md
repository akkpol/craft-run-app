---
title: Incident Analysis Template
version: 1.0
date: 2026-05-02
owner: Operator + AI Agents
status: Active
---

# Incident Analysis Template

Use this template before and during any fix.
Do not patch first and analyze later.

## A) Incident Header

- Incident ID:
- Date/Time (ICT):
- Environment: local | preview | production
- Packet:
- Operator:
- Active AI agent:

## B) Symptom Capture

- What failed:
- Where it failed (route/page/job):
- First observed at:
- User-visible impact:

## C) Evidence Capture

- Repro command:
- Output excerpt:
- Log reference (file/table/request id):
- Related file paths:
- Related commit(s):

## D) Root-Cause Analysis

- Immediate cause:
- Systemic cause:
- Why guard rails did not stop it:
- Scope affected:

## E) Fix Design

- Minimal fix scope:
- Out-of-scope explicitly excluded:
- Rollback reference (branch/tag/commit):
- Risk level: low | medium | high

## F) Validation Plan

- Tier A (touched helpers/tests):
- Tier B (impacted route/UI checks):
- Tier C (full regression if release gate requires):
- Stop criteria:

## G) Execution Record

- Changes applied:
- Files changed:
- Commands executed:
- Test results:

## H) Closure

- Final status: resolved | partial | blocked
- Remaining risks:
- Next actor (operator or AI agent):
- Follow-up packet (if needed):
