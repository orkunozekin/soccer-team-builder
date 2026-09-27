# AGENTS.md

Instructions for LLM coding agents and AI code-review bots working in this repository.

## Always start here

1. Read [`docs/AGENT_CONTEXT.md`](docs/AGENT_CONTEXT.md) (rules, standards, safety).
2. Run the **`/start`** skill at the beginning of every session (Cursor, Claude Code, or any Agent Skills–compatible client) so those rules are loaded and acknowledged before coding or reviewing. Canonical path: [`.claude/skills/start/SKILL.md`](.claude/skills/start/SKILL.md) (`.cursor/skills/` is a symlink mirror for Cursor).
3. For feature work, use `/plan-feature` → `/feature-context` → `/handoff` (plans live under `docs/features/`).
4. To address PR review comments (bots first, then humans), use `/address-pr-feedback`.

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

Durable lessons from review feedback live in [`docs/AGENT_LESSONS.md`](docs/AGENT_LESSONS.md). Agents append there via `/address-pr-feedback` when a comment catches a gap worth preventing next time; promote repeated or high-severity lessons into `docs/AGENT_CONTEXT.md`.
