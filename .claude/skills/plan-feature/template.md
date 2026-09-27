# Feature plan template

Use this structure for `docs/features/<slug>-feature-plan.md`. Omit sections that do not apply; keep Status and Handoff always.

```markdown
# <Feature Title>

<One or two sentences: what this plan covers.>

## Status

| Field | Value |
|-------|-------|
| Status | planned \| in-progress \| blocked \| done |
| Owner session | <optional agent/user note> |
| Last updated | YYYY-MM-DD |
| Related PR / branch | <none \| url \| branch name> |

## Goals (v1)

- **Goal 1** — …
- **Goal 2** — …
- **Out of scope for v1:** …

## Todos

1. …
2. …
3. …

## Current state

What exists today (files, behavior, gaps). Link concrete paths.

## Design

Data model, APIs, UX, algorithms, flags, or migrations as needed.

## Critical decisions

Non-obvious constraints or “do not break X” notes.

## Files to touch

| Path | Change |
|------|--------|
| `…` | … |

## Acceptance criteria

- [ ] …
- [ ] …

## Handoff

> Updated by `/handoff`. `/feature-context` reads this first.

### Done so far

- None yet.

### Remaining work

- Mirror open Todos; be specific about the next concrete step.

### Blockers / risks

- None.

### Pointers for the next agent

- Start at: `<primary file or todo>`
- Do not: `<footguns>`
- Verify with: `<tests or manual checks>`
```
