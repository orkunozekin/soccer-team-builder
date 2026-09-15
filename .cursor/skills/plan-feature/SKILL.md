---
name: plan-feature
description: Collect feature context from the user and codebase, then write a structured plan under docs/features/. Use when the user runs /plan-feature, asks to plan a feature or project, or wants a new feature markdown plan before implementation.
disable-model-invocation: true
---

# /plan-feature

Plan a feature by gathering context, inspecting the repo, and writing a markdown plan to `docs/features/`.

## When to run

- User invokes `/plan-feature`
- User asks to plan a feature/project before coding
- User wants a durable plan another agent can pick up later via `/feature-context`

## Workflow

Copy and track:

```
Plan progress:
- [ ] 1. Collect requirements
- [ ] 2. Explore current code
- [ ] 3. Draft plan
- [ ] 4. Write docs/features/<slug>-feature-plan.md
- [ ] 5. Confirm path + next skill with the user
```

### 1. Collect requirements

Ask only for missing pieces. Prefer short questions. Capture:

| Field | What to learn |
|-------|----------------|
| Problem | What is broken or missing? |
| Goals (v1) | Must-ship outcomes |
| Out of scope | Explicit non-goals for this plan |
| Constraints | Perf, privacy, flags, backward compat, mobile, etc. |
| Acceptance | How we know v1 is done |
| Related work | Existing docs, PRs, branches, prior attempts |

If the user already pasted a full brief, do not re-ask; fill gaps from the repo.

### 2. Explore current code

Before writing the plan:

1. Search for related routes, components, types, libs, and existing `docs/features/*` plans.
2. Note the **current state** (what exists, what is dead/paused, what must not break).
3. List concrete file paths the implementer will touch.
4. Prefer evidence from code over assumptions.

### 3. Draft the plan

Follow the template in [template.md](template.md). Match the tone of existing plans in `docs/features/` (direct, checklist-driven, file-linked).

Rules:

- One primary doc per feature; do not scatter the plan across chat-only notes.
- Prefer actionable todos over essay prose.
- Link real paths with repo-relative markdown links (e.g. ``[`app/api/rsvp/route.ts`](../../app/api/rsvp/route.ts)`` from `docs/features/`).
- Include data model / API / UX tables when the feature changes them.
- Add mermaid only when a flow or state machine clarifies the design.
- Keep v1 tight; park later phases under **Later** or **Out of scope**.

### 4. Write the file

1. Choose a kebab-case slug from the feature name.
2. Path: `docs/features/<slug>-feature-plan.md`
   - Use `-feature-plan` for product features.
   - Shorter names (e.g. `qstash-rsvp-schedule.md`) are OK for ops/runbook-style docs; still include Status + Handoff sections.
3. Create `docs/features/` if missing.
4. Do not overwrite an existing plan unless the user asks to revise it; if the file exists, propose an update or a new slug.
5. Set Status to `planned` and fill **Handoff** with “not started” next steps.

### 5. Hand off

Tell the user:

- The plan path
- That `/handoff` should be run when work progresses or a session ends
- That another agent should run `/feature-context` (pointing at this doc) to implement

Do **not** start implementation unless the user explicitly asks.

## Naming examples

| Feature | File |
|---------|------|
| Match check-in | `docs/features/check-in-feature-plan.md` |
| Pitch lineup | `docs/features/pitch-lineup-feature-plan.md` |
| RSVP concurrency | `docs/features/rsvp-concurrency-plan.md` |
