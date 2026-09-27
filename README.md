# To get started:

1. Clone the app
2. Run `yarn` to install dependencies
3. **Set up the local database (required for local development)** — You **must** use the Firebase emulators when running the app locally. Do not run against production Firebase. Copy `.env.sample` to `.env.local`, then follow [docs/local-development.md](docs/local-development.md) for prerequisites (Java, Firebase CLI), starting the emulators, and configuring `.env.local` with the emulator settings.
4. Run `yarn dev` to start the local server

**Do not skip step 3.** Running `yarn dev` without the emulator and with production credentials will connect to the **production** database and can affect live data. Local development must use the emulators only.

## LLM agents and AI review

- Start every agent session with **`/start`** (loads [AGENTS.md](AGENTS.md) and [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md)). Skills live under [`.claude/skills/`](.claude/skills/) (Claude Code) with [`.cursor/skills/`](.cursor/skills/) symlinked for Cursor.
- Feature planning/handoff: `/plan-feature`, `/feature-context`, `/handoff`.
- PR review feedback: `/address-pr-feedback` (lessons log: [docs/AGENT_LESSONS.md](docs/AGENT_LESSONS.md)).
- Greptile config: [`.greptile/`](.greptile/).

## RSVP schedule (cron)

RSVP opens automatically at 6:00 AM CT and the match gets deleted at 10:00 PM CT on match day. See [docs/rsvp-cron.md](docs/rsvp-cron.md) for cron setup.

## Some of the libraries used:

1. Zustand (State management)
2. Shadcn/ui (headless UI components)
3. Tailwindcss for styling

## Testing

Unit tests use [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react). Run tests:

- `yarn test` — watch mode
- `yarn test:run` — single run
