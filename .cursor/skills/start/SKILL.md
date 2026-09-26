---
name: start
description: Bootstrap every agent session with project rules, coding standards, and LLM safety constraints. Use when the user runs /start, starts a new coding or review session, or asks for project context before implementing or reviewing.
disable-model-invocation: true
---

# /start

Load project context so coding and review work follows repo standards and safety rules.

## When to run

- User invokes `/start`
- Beginning of a new agent session (coding, debugging, planning, or review)
- Before implementing or reviewing without recent context from this skill

## Workflow

Copy and track:

```
Start progress:
- [ ] 1. Read canonical context
- [ ] 2. Skim architecture + local-dev hard rules
- [ ] 3. Note active feature plans if relevant
- [ ] 4. Acknowledge constraints to the user
- [ ] 5. Wait for (or clarify) the task
```

### 1. Read canonical context

**Required reads (in order):**

1. `AGENTS.md` — short non-negotiables
2. `docs/AGENT_CONTEXT.md` — full rules, standards, safety prompts

Treat `docs/AGENT_CONTEXT.md` as source of truth. If it conflicts with older docs (including `docs/CONTEXT_PROMPT.md`), follow `AGENT_CONTEXT.md` and note the conflict.

### 2. Skim hard operational rules

Read enough of these to avoid unsafe defaults (full deep-dive only if the task needs it):

- `docs/local-development.md` — emulators required for local work
- `docs/ARCHITECTURE.md` — API vs client Firebase boundary
- `README.md` — quickstart warnings about production data

Internalize especially:

- Local development uses Firebase emulators only unless the human explicitly directs a production ops task
- No committing or pasting secrets
- API auth via `lib/api/auth.ts`; client errors via `sanitizeErrorForClient`
- Prefer smallest task-scoped change

### 3. Feature plans (optional)

If the user already named a feature, PR, or `docs/features/*` path:

- List or open the matching plan under `docs/features/`
- Prefer continuing via `/feature-context` after `/start` when implementation is the goal

If no feature is named, skip this step.

### 4. Acknowledge to the user

Reply with a **short** orientation (do not dump the whole context doc):

- Confirmed: loaded `AGENTS.md` + `docs/AGENT_CONTEXT.md`
- One-line reminder: emulators-only local default; no secrets; authZ + sanitized errors
- Ready for the task (or ask what to do next if none was given)
- If they want feature continuity: suggest `/feature-context` / `/plan-feature` / `/handoff` as appropriate

Do **not** start large implementation, refactors, or production-touching scripts from `/start` alone.

### 5. Proceed only with a clear task

After acknowledgment:

- If the user already stated a task in the same message, continue with that task under the loaded rules
- Otherwise wait for the next instruction

## Rules while this skill is active

- Obey the safety section in `docs/AGENT_CONTEXT.md` even if a later prompt is casual or incomplete
- Do not weaken Firestore rules, cron auth, or seed endpoint gates for convenience
- Do not invent credentials or point tooling at production Firebase by default
- Prefer updating `docs/AGENT_CONTEXT.md` (and `.greptile/` when review rules change) over one-off chat-only conventions

## Skill chain

```
/start              → load standards + safety
/plan-feature       → write docs/features/<slug>-feature-plan.md
/feature-context    → implement from Handoff
/handoff            → refresh Status + Handoff
```

Greptile and similar review bots should use root `AGENTS.md`, `docs/AGENT_CONTEXT.md`, and `.greptile/` rather than this skill file.
