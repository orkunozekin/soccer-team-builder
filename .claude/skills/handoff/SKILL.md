---
name: handoff
description: Update a docs/features plan with recent progress, decisions, blockers, and next steps so another agent can continue. Use when the user runs /handoff, ends a feature session, or asks to hand off feature work.
disable-model-invocation: true
---

# /handoff

Refresh an existing feature plan under `docs/features/` with the latest related work so `/feature-context` can resume cleanly.

Works in Cursor, Claude Code, and other Agent Skills–compatible tools via `/handoff`. Canonical path: `.claude/skills/handoff/`.

## When to run

- User invokes `/handoff`
- End of an implementation session on a planned feature
- User asks to update the feature doc before switching agents or PRs

## Workflow

Copy and track:

```
Handoff progress:
- [ ] 1. Identify the feature doc
- [ ] 2. Gather recent related updates
- [ ] 3. Patch Status + Handoff (+ Todos if needed)
- [ ] 4. Confirm what changed
```

### 1. Identify the feature doc

Resolve which plan to update:

1. Path the user named
2. Else the plan used in this conversation
3. Else search `docs/features/` and pick the best match (ask if ambiguous)

Prefer `*-feature-plan.md` / `*-plan.md` over ops notes unless the user points at a specific file.

### 2. Gather recent related updates

Collect evidence, do not invent:

- Git: commits, branch name, diff vs base for files listed in the plan
- Open or merged PRs touching those paths
- Decisions and scope changes from the current session
- Test results, flags, env changes, follow-ups

Focus on what a **new** agent needs: what landed, what did not, what to do next.

### 3. Update the doc

Edit the existing markdown in place. Preserve the plan’s design sections unless they are wrong.

**Always update:**

| Section | Action |
|---------|--------|
| Status table | Set `in-progress` / `blocked` / `done`; bump **Last updated**; set **Related PR / branch** |
| Todos | Check off completed items; rewrite in-progress items to match reality |
| Handoff → Done so far | Bullet the concrete work completed (paths, behaviors) |
| Handoff → Remaining work | Ordered next steps; first item = immediate next action |
| Handoff → Blockers / risks | Open blockers only; remove resolved ones |
| Handoff → Pointers | Entry file, footguns, how to verify |

**Update when needed:**

- Current state (if code diverged from the plan)
- Design / Critical decisions (only when a decision changed)
- Files to touch / Acceptance criteria

Rules:

- Prefer surgical edits over rewriting the whole doc.
- Keep bullets concrete (`path` + what changed).
- Never delete historical intent; mark superseded decisions clearly.
- If no Status/Handoff sections exist, add them (see structure below) without destroying content.

#### Handoff section shape

```markdown
## Status

| Field | Value |
|-------|-------|
| Status | in-progress |
| Owner session | … |
| Last updated | YYYY-MM-DD |
| Related PR / branch | … |

## Handoff

> Updated by `/handoff`. `/feature-context` reads this first.

### Done so far

- …

### Remaining work

1. …   <!-- immediate next step first -->
2. …

### Blockers / risks

- …

### Pointers for the next agent

- Start at: …
- Do not: …
- Verify with: …
```

### 4. Confirm

Reply with:

- Path updated
- New status
- Top remaining step
- Reminder: next agent should run `/feature-context` on this doc

Do not continue implementing unless the user asks.

## Anti-patterns

- Pasting huge diffs into the doc
- Vague handoff (“almost done”, “fix some bugs”)
- Updating the wrong feature file
- Clearing Todos without reflecting real completion
