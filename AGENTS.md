# AGENTS.md

Instructions for LLM coding agents and AI code-review bots working in this repository.

## Always start here

1. Read [`docs/AGENT_CONTEXT.md`](docs/AGENT_CONTEXT.md) (rules, standards, safety).
2. In Cursor, run the **`/start`** skill (`.cursor/skills/start/SKILL.md`) at the beginning of every session so those rules are loaded and acknowledged before coding or reviewing.
3. For feature work, use `/plan-feature` → `/feature-context` → `/handoff` (plans live under `docs/features/`).

## Non-negotiables (summary)

- **Local = emulators only.** Do not hit production Firebase from everyday local/dev work. See `docs/local-development.md` and the README.
- **No secrets in git or chat.** Never commit `.env*`, service accounts, or API keys; never paste full secret values.
- **AuthZ first.** API routes use `lib/api/auth.ts` helpers; keep club tenancy and Firestore rules intact.
- **Sanitize client errors** via `lib/api/sanitizeError.ts`.
- **Small, task-scoped diffs.** Match existing Prettier/ESLint/Tailwind/shadcn patterns.
- **Trusted logic on the server** for team generation, transfers, privileged club/match mutations (`docs/ARCHITECTURE.md`).

Full detail and reviewer focus areas: [`docs/AGENT_CONTEXT.md`](docs/AGENT_CONTEXT.md).

## Greptile / PR review bots

Repo review config lives under [`.greptile/`](.greptile/). It points reviewers at `docs/AGENT_CONTEXT.md` and encodes high-severity safety rules. Prefer updating `docs/AGENT_CONTEXT.md` + `.greptile/` together when standards change.
