---
name: feature-context
description: Load a docs/features plan and resume implementation from its Handoff section. Use when the user runs /feature-context, asks to continue a planned feature, or picks up work after /plan-feature or /handoff.
disable-model-invocation: true
---

# /feature-context

Load feature context from `docs/features/` and continue implementation from the latest handoff.

Works in Cursor, Claude Code, and other Agent Skills–compatible tools via `/feature-context`. Canonical path: `.claude/skills/feature-context/`.

## When to run

- User invokes `/feature-context`
- User asks to implement or continue a planned feature
- Starting a new session after `/plan-feature` or `/handoff`

## Workflow

Copy and track:

```
Feature context:
- [ ] 1. Resolve the feature doc
- [ ] 2. Read plan + handoff
- [ ] 3. Re-verify against the codebase
- [ ] 4. Summarize the working context
- [ ] 5. Implement the next remaining work item
```

### 1. Resolve the feature doc

1. Use the path the user gave
2. Else use the plan from this conversation
3. Else list `docs/features/` and choose the best match (ask if more than one fits)

### 2. Read for context (priority order)

Read the full doc, but prioritize:

1. **Status**
2. **Handoff** (Done / Remaining / Blockers / Pointers)
3. **Todos** and **Acceptance criteria**
4. **Goals**, **Out of scope**, **Critical decisions**
5. **Design** / **Current state** / **Files to touch** as needed for the next step

Treat Handoff as the source of truth for “what now.” If Handoff conflicts with older Design text, follow Handoff and note the conflict before coding.

### 3. Re-verify against the codebase

Before coding:

1. Open the “Start at” paths from Pointers / Files to touch
2. Confirm Done-so-far claims still match the code
3. Skim related tests or docs linked by the plan
4. If the doc is stale (landed work missing from Handoff), run `/handoff` first or update Handoff briefly, then continue

### 4. Summarize working context

Give a short orientation (keep it tight):

- Feature + status
- Immediate next step
- Constraints / out of scope that affect this step
- Blockers (stop if blocked)

Then proceed to implement unless the user only asked for context.

### 5. Implement

1. Work the **first** Remaining work item (or next unchecked Todo)
2. Stay inside Goals (v1) and Out of scope
3. Follow repo patterns; touch the listed files unless discovery proves otherwise
4. Verify with the plan’s “Verify with” guidance plus appropriate tests
5. When the session ends or a milestone lands, run `/handoff` (or ask the user to) so the doc stays current

## Rules

- Do not invent requirements absent from the plan; ask if the next step is underspecified.
- Do not expand into Out of scope work.
- Do not start a different feature doc’s work.
- Prefer updating the existing plan via `/handoff` over creating duplicate plans.

## Skill chain

```
/plan-feature  →  writes docs/features/<slug>-feature-plan.md
/handoff       →  refreshes Status + Handoff from recent work
/feature-context → reads that doc and implements next steps
```
