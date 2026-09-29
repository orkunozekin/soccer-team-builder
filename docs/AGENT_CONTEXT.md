# Agent context: rules, standards, and safety

Canonical instructions for LLM coding agents (Cursor, Greptile, and similar). Keep this file accurate; prefer updating it over scattering one-off rules in chat.

**Session bootstrap:** run `/start` (see [`.claude/skills/start/SKILL.md`](../.claude/skills/start/SKILL.md); Cursor resolves the same skill via `.cursor/skills/start`).  
**Root pointer:** [`AGENTS.md`](../AGENTS.md).

---

## 1. Product and stack (short)

Soccerville is a soccer pickup / club match team-builder: auth, club memberships, matches, RSVPs, team generation, check-in, pitch lineup (LaunchDarkly), admin tools.

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router (`app/`), TypeScript, Yarn |
| UI | Tailwind + shadcn/ui (`components/ui/`), Lucide |
| State | Zustand (`store/`) |
| Data | Firebase Auth + Firestore (client Lite SDK; Admin SDK on server) |
| Jobs | Upstash QStash → cron API routes |
| Flags | LaunchDarkly (`lib/flags/`) |
| Tests | Vitest + Testing Library (`yarn test` / `yarn test:run`) |
| Hosting | Vercel |

Details: [`TECH_STACK.md`](./TECH_STACK.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`local-development.md`](./local-development.md).

---

## 2. Repository layout

| Path | Purpose |
|------|---------|
| `app/` | App Router pages, layouts, `app/api/*/route.ts` handlers |
| `components/` | Feature UI; shared primitives in `components/ui/` |
| `lib/` | Services, hooks, utils, Firebase, API helpers, domain logic |
| `store/` | Zustand stores |
| `types/` | Shared TypeScript types |
| `interfaces/` | Legacy/shared interfaces (prefer `types/` for new work) |
| `docs/` | Architecture, setup, feature plans |
| `docs/features/` | Durable feature plans + handoff (skills: `/plan-feature`, `/handoff`, `/feature-context`) |
| `scripts/` | Ops/migration/seed scripts (treat as privileged) |
| `firestore.rules` / `firestore.indexes.json` | Security rules and indexes |

Path alias: `@/*` → project root (`tsconfig.json`).

---

## 3. Coding standards

### TypeScript and style

- TypeScript everywhere for app code; keep `strict` happy.
- Match Prettier: single quotes, no semicolons, trailing commas `es5`, 2-space indent, Tailwind class sorting via plugin.
- Prefer `import` order already enforced by ESLint (`import/order`, React first).
- Use `cn()` from `lib/utils` for className merging; do not invent parallel helpers.
- Prefer named exports for shared lib modules; follow neighbors in the same folder.
- Avoid drive-by refactors and unrelated file churn. Change only what the task needs.
- Do not add comments that only narrate obvious code; comment non-obvious invariants and safety constraints.

### React / Next.js

- Use App Router only (no Pages Router).
- Mark interactive trees with `'use client'`; keep server components as the default where possible.
- Mobile-first layouts; UI must work on phone, tablet, and desktop.
- Reuse existing `components/` and `components/ui/` patterns. Do **not** treat “build everything from scratch” as a current rule (that applied only to early greenfield phases).
- Forms: Zod schemas + `react-hook-form` + `@hookform/resolvers` when adding or changing form flows.
- **Narrow rows must wrap (check 320px).** Inside an `overflow-hidden` card or list, a single non-wrapping flex row clips its trailing controls. Give row text a readable `min-width`, `flex-wrap` (or stack) the action group, and keep Previous/Next reachable without a non-wrapping page-number strip. `min-w-0` alone lets the text absorb the overflow while the last button gets clipped.
- **Overlays: close and reset from inside.** Radix `onOpenChange` does not fire for a programmatic `setOpen(false)`, so a handler inside a popover, dialog, or sheet that closes it must also reset that overlay's local query or form state. Every control inside a layout sheet that navigates must call the sheet's close callback. Regression tests for these controls must open the overlay, act from inside it, and assert the overlay closed and body pointer/scroll locks are gone.
- **Paged lists keep the edited row.** After a client-side reorder (e.g. promote to admin), move the page to the edited row so it does not vanish.

### API routes and auth

- Business logic that must stay trusted lives in Route Handlers under `app/api/` and/or `lib/` called from those handlers (team generate/transfer, match create with validation, club admin mutations, etc.). See [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- Authenticate with helpers in `lib/api/auth.ts`: `verifyAuth`, `verifySuperUser`, `verifyClubAdmin`, `verifyClubAdminForMatch`, membership helpers. Do not roll custom token parsing.
- Roles: platform operator is `super_user` (legacy `admin` may still appear in rules); club scope uses `club_admin` / membership. Prefer club-scoped checks over global admin when the resource has a `clubId`.
- Return appropriate HTTP status codes (`401` / `403` / `404` / `400` / `500`). Do not leak whether a resource exists when authorization requires secrecy.
- Client-facing errors: always pass through `sanitizeErrorForClient` from `lib/api/sanitizeError.ts` (or equivalent safe fallback strings). Never return raw Firebase/Firestore/stack traces to the client.
- Prefer `getAdminDb()` / Admin SDK for privileged writes; keep Firestore rules aligned when allowing client writes.

### Client Firebase

- Client Firestore uses the **Lite** SDK on purpose (no `onSnapshot` Listen streams). Do not switch to the full Firestore client SDK without an explicit product decision and mobile regression plan.
- Emulator wiring: `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` plus `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`. See [`local-development.md`](./local-development.md).
- **Club-tenant queries must be constrained.** Collection queries on `matches` (and similar tenant-scoped collections) must include a `clubId` filter that matches what Firestore rules allow the caller to read. Unqualified `getAllMatches()`-style queries fail for members once other clubs have documents. Super users may query the full collection. Prefer helpers like `listMatchesForViewer` / `getMatchesForClub`. Do not use `where('clubId','==',null)` as a stand-in for “field missing”; that only matches explicit null.
- **Composite indexes: keep them; deploy before the query ships.** Indexes in `firestore.indexes.json` are good and expected for compound queries (e.g. `clubId` + `orderBy('date')`). The failure mode is shipping client/Admin query shapes that need a composite index while production still lacks it (`FAILED_PRECONDITION` → blank UI such as “Could not load matches”). Rules for agents:
  1. When adding `where` + `orderBy` (or multi-field equality) on a collection, update `firestore.indexes.json` in the same PR.
  2. Call out in the PR that **`firebase deploy --only firestore:indexes`** (or Console create) must reach **Enabled** before/at production traffic for that query — merging the JSON alone does nothing.
  3. Prefer equality-only client queries + in-memory sort when list sizes are small, so the app stays up even if an index is still Building or missing.
  4. Emulators often do **not** enforce composite indexes; green local runs are not proof the index exists in production.
  5. Do not delete useful composite indexes just to avoid deploy discipline; keep indexes and ship the deploy.
- **Isolate secondary fetches.** A failure in a follow-up read (RSVP counts, enrichment) must not wipe or error the primary list.

### Async state, races, and transactions

Repeated review findings; treat these as defaults.

- **Generation-guard every async write to shared state.** Give each fetch or auth callback a generation (`fetchGen`, `authGenRef`). After every `await`, skip store/state writes unless that generation is still current, and bump it in effect cleanup so an unmounted page cannot overwrite the shared store for the next one.
- **Do not invalidate in-flight work to start a secondary fetch.** Bumping a shared generation for a lazy load (e.g. another tab) discards results the UI still needs.
- **Separate mutation success from refresh failure.** If the write succeeded and only the follow-up refresh failed, keep the prior list or optimistic value and report the refresh error. Disable conflicting actions while a refresh is in flight. When clearing a per-row busy id in `finally`, only clear it if it still matches (`setBusy(prev => (prev === id ? null : prev))`).
- **Reset local form state when the club (or other scoping prop) changes.**
- **Transaction callbacks can run more than once.** Return the outcome from `runTransaction` and act on the returned value; never set outer variables inside the callback. Re-check source status (e.g. RSVP still `confirmed`) inside the transaction before changing counters.
- **Denormalized counters** (e.g. `rsvpConfirmedCount`, `_state/rsvp`): seed from the source documents before the first increment, change the counter in the same transaction that changes the source doc, write parent + state atomically on create, and recompute after bulk deletes. Recounts must run in a transaction that reads the same docs the writers touch so concurrent writes retry instead of being lost.

### Auth, roles, and club context

- **Role is not known until the profile loads.** `loading === false` is not “role settled” (the auth timeout clears it while the user doc is in flight). Gate admin redirects on `rolePending` (user set, `profileReady` false). Reset `profileReady` and clear `userData` when the auth uid changes, not on a same-uid token refresh.
- **One resolver for “current club.”** Sub-nav, match list, create eligibility, and create API `clubId` must share `resolveEffectiveActiveClubId` / `resolveSelectedClubMembership`; do not re-derive it per surface.
- **Club-scoped detail pages check the resource's club.** Match detail under `/c/[slug]` must verify match `clubId` against the URL club; legacy redirects resolve via the match's club before any active-club fallback. By-slug/by-id lookups: authenticate first, and return 404 for both unauthorized and missing.
- **Super users keep the all-clubs view.** `/admin/matches` (“All matches”) is distinct from the club redirect even when the super user has a membership; all-clubs cards link to `/admin/matches/[id]`. Show create-match UI only when a concrete `clubId` is in context.
- **Choose admin controls per row**, from per-resource permission (`manageFlags` / `canManageMatchClub`), not from a page-level admin flag.

### Feature flags

- Gate incomplete or risky UX behind LaunchDarkly (`lib/flags/`). Do not ship half-finished pitch/lineup or similar surfaces without the existing flag pattern.
- Local overrides via `NEXT_PUBLIC_FF_*` are for dev/demo only; do not rely on them in production design.

### Testing

- Colocate unit tests as `*.test.ts` / `*.test.tsx` next to the code (existing pattern under `lib/`).
- Add or update tests when changing pure logic (team generation, geo/check-in windows, schedulers, auth helpers, sanitization).
- Run `yarn test:run` for changed logic before considering work done when feasible.
- CI runs unit tests on PRs to `main` (`.github/workflows/test.yml`).

### Docs and feature work

- Non-trivial features: plan in `docs/features/` via `/plan-feature`, implement via `/feature-context`, close sessions with `/handoff`.
- Update env samples (`.env.sample`) when adding new configuration knobs.
- Prefer updating this file and `AGENTS.md` when introducing a lasting convention.

---

## 4. Safety prompts for LLM agents

These are hard constraints. If a user request conflicts with them, refuse or propose a safe alternative.

### Production data and credentials

1. **Never** point local/dev work at production Firebase unless the human explicitly requests a production ops task and you confirm the environment. Default is emulators only (`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`).
2. **Never** commit secrets: `.env`, `.env.local`, service account JSON, API keys, QStash/Plunk/OAuth secrets, `SEED_SECRET`, `CRON_SECRET`.
3. **Never** print full secret values in chat, PRs, logs, or screenshots. Redact.
4. Do not invent or hardcode production project credentials. Use `.env.sample` as the contract for variable names only.
5. Treat `firebase-service-account.json` and `FIREBASE_SERVICE_ACCOUNT_KEY` as highly sensitive.

### AuthZ and tenancy

6. Do not weaken Firestore rules or API auth “to make it work.” Fix callers or add properly scoped checks.
7. Club data is tenant-scoped. Do not add cross-club reads/writes without explicit super-user gates.
8. Seed / debug / destructive admin endpoints must remain gated (`verifySuperUser` and/or `SEED_SECRET`) and must not become publicly callable.
9. Cron routes must verify QStash signatures and/or `CRON_SECRET` (match existing handlers). Do not leave cron handlers unauthenticated.

### Safe coding behavior

10. Prefer the smallest change that solves the task. No unrelated reformatting or mass renames.
11. Do not delete matches, users, clubs, or RSVPs in bulk from agent-driven scripts against shared environments without explicit human confirmation.
12. Do not disable `sanitizeErrorForClient`, broaden CORS, or bypass token verification for convenience.
13. Do not introduce `eval`, shelling out with user input, or arbitrary file reads in API routes.
14. When reviewing or writing auth/payment/PII paths, call out missing checks explicitly rather than assuming they exist.
15. Membership / club-list fetch failures must surface as retryable errors — never as “not a member”, `/join`, or `notFound()`.
16. Club-scoped async UI (`clubId` in props) must ignore stale responses after the club changes or the effect cleans up.
17. After a successful mutation, do not roll back optimistic UI when a follow-up refresh fails; report the refresh failure separately.

### Review / Greptile focus

When acting as a reviewer (including Greptile), prioritize:

- AuthZ gaps (missing `verify*`, wrong role, clubId confusion)
- Secret leakage and unsafe logging
- Client exposure of internal errors
- Breakage of emulator-only local-dev assumptions
- Race/concurrency around RSVP, team generation, and club-scoped fetches (stale `clubId`)
- Membership fetch errors mistaken for 404 / empty membership
- Firestore rule / Admin SDK inconsistency (client write allowed that should be API-only)

Deprioritize pure style nits already covered by Prettier/ESLint unless they hide a real bug.

---

## 5. Local commands (cheat sheet)

```bash
# Emulators (required for local app use)
firebase emulators:start --only auth,firestore

# App
yarn            # install
yarn dev        # Next.js (see package.json for port)
yarn lint
yarn format:check
yarn test:run
yarn build
```

Never run `yarn dev` against production credentials by accident. See README and [`local-development.md`](./local-development.md).

---

## 6. Related skills

| Skill | Role |
|-------|------|
| `/start` | Load this context at session start |
| `/plan-feature` | Write `docs/features/<slug>-feature-plan.md` |
| `/handoff` | Refresh Status + Handoff on a plan |
| `/feature-context` | Resume implementation from a plan’s Handoff |
| `/address-pr-feedback` | Fix PR review threads (bots first); append durable lessons |

### Skill locations (Cursor + Claude Code + personal mirrors)

Project skills follow the [Agent Skills](https://agentskills.io) `SKILL.md` format so Cursor, Claude Code, and similar clients share one workflow:

| Location | Role |
|----------|------|
| [`.claude/skills/`](../.claude/skills/) | **Canonical** project skills (Claude Code discovers these natively) |
| [`.cursor/skills/`](../.cursor/skills/) | Symlinks → `.claude/skills/` (Cursor) |
| Personal Cursor Agent Store `skills/` | Operator-wide Cursor mirror |
| `~/.claude/skills/` | Operator-wide Claude Code mirror |

Edit the `.claude/skills/` copy in git, then refresh personal mirrors when a skill changes.

```
/start → (optional) /plan-feature → /feature-context → … → /handoff
                 ↘ /address-pr-feedback → docs/AGENT_LESSONS.md
```

**Lessons log:** [`AGENT_LESSONS.md`](./AGENT_LESSONS.md) — append when review feedback reveals a lasting gap. When a theme repeats (two or more entries) or is high severity, promote it into this file (and `.greptile/rules.md`) and mark the entries `Promoted`. `/start` reads this file, not the log.
