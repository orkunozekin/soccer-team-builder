# Greptile review rules (Soccerville)

Companion to [`docs/AGENT_CONTEXT.md`](../docs/AGENT_CONTEXT.md), root [`AGENTS.md`](../AGENTS.md), and the lessons log [`docs/AGENT_LESSONS.md`](../docs/AGENT_LESSONS.md). Prefer those docs when this summary conflicts with newer detail.

## Priority

1. AuthZ / club tenancy gaps
2. Secret leakage and unsafe logging
3. Unsanitized client errors
4. Cron / seed endpoints without gates
5. Accidental production Firebase coupling in local/dev paths
6. Logic bugs (RSVP, teams, check-in windows)
7. Style only if it hides a bug (Prettier/ESLint already format)

## Must flag

- Missing or weakened `verify*` usage on mutating API routes
- Cross-club data access without super-user gate
- Raw Firebase/internal errors returned to clients
- New secrets, service accounts, or `.env` files in the diff
- Unauthenticated cron or publicly callable seed/destructive routes
- Broadening Firestore client write rules that should stay Admin SDK / API-only
- New or changed Firestore compound queries (`where` + `orderBy`, multi-field filters) without a matching entry in `firestore.indexes.json`, or without an explicit note that production indexes must be deployed/`Enabled` before traffic uses that query (emulators often skip this check)

## Do not nitpick

- Import sort / quote / semicolon style already enforced by tooling
- Prefer existing patterns over introducing new abstractions
- Large unrelated refactors disguised as the PR’s purpose
