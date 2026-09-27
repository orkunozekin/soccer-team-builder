# Agent lessons (from PR feedback)

Perpetual log of durable lessons captured when PR review comments (Greptile, other review bots, or humans) catch bugs, safety gaps, or improvements that slipped past normal coding.

**Purpose:** bullet-proof future agent code generation. Agents append here via `/address-pr-feedback` when a fix reveals a rule worth remembering.

**Promotion:** if a lesson repeats or is high severity, move it into [`AGENT_CONTEXT.md`](./AGENT_CONTEXT.md) (and [`.greptile/`](../.greptile/) when it should change review severity). Do not leave critical standing rules only in this log.

## When to add an entry

Add when feedback reveals something that should change how we write or review code later:

- AuthZ / tenancy / sanitize-error misses
- Emulator vs production coupling mistakes
- Logic bugs in RSVP, teams, check-in, transfers
- API/client boundary mistakes
- Missing tests around pure logic that regressed

Skip: one-off typos, formatting already covered by Prettier/ESLint, and PR-specific noise.

## Entry template

```markdown
### YYYY-MM-DD — short title

- **Source:** PR #N · Greptile | Bugbot | human:@login
- **Gap:** what slipped past
- **Going forward:** concrete rule or check
- **Pointers:** `path/` or pattern to remember
```

## Lessons

<!-- Append newest entries at the top of this section. -->

### 2026-09-27 — Club match queries must not require undeployed composite indexes

- **Source:** Production report after PR #82 merge · human
- **Gap:** `getMatchesForClub` used `where('clubId')` + `orderBy('date')`, which needs a composite index. The index was added to `firestore.indexes.json` but not deployed, so regular members saw “Could not load matches” in production. RSVP count failures in the same try/catch could also wipe the list.
- **Going forward:** Prefer equality-only client queries when results can be sorted in memory. If a composite index is required, deploy `firestore.indexes.json` before relying on that query in production (or gate the feature until the index is Ready). Keep secondary fetches (e.g. RSVP counts) from failing the primary list UI.
- **Pointers:** `lib/services/matchService.ts` (`getMatchesForClub`), `components/matches/ClubMatchesView.tsx`, `firestore.indexes.json`

### 2026-09-27 — Club match list: scoped queries, no create without clubId, invalidate on unmount

- **Source:** PR #82 · Macroscope
- **Gap:** (1) Super-user all-clubs view showed CreateMatchCard with `clubId: null` so creates always failed. (2) `where('clubId','==',null)` does not return docs missing the field, so “unscoped” fetches were incomplete. (3) Unmount did not bump `fetchGen`, so a late response could overwrite the shared match store for the next club page.
- **Going forward:** Only show create-match UI when a concrete `clubId` is in context. Club-scoped client lists query `clubId == <id>` only; do not rely on null-equality for absent fields (super users use full-collection `getAllMatches` for legacy/unscoped). Always invalidate in-flight list fetches on effect cleanup when writing a shared store.
- **Pointers:** `components/matches/ClubMatchesView.tsx`, `lib/services/matchService.ts` (`listMatchesForViewer` / `getMatchesForClub`)

### 2026-09-27 — Club-scoped Firestore queries for member match lists

- **Source:** PR #82 · Macroscope
- **Gap:** `ClubMatchesView` called `getAllMatches()` (unqualified `matches` query). Once any other club had a match, Firestore rejected the query for members because rules cannot prove every result is readable.
- **Going forward:** Client match lists for members must query with `where('clubId', '==', clubId)` (plus optional unscoped `clubId == null`). Super users may keep the collection query when viewing all clubs. Add composite indexes when combining `clubId` + `orderBy`.
- **Pointers:** `lib/services/matchService.ts` (`listMatchesForViewer` / `getMatchesForClub`), `components/matches/ClubMatchesView.tsx`, `firestore.indexes.json`, `firestore.rules` matches read

### 2026-09-27 — Club slug routes: no existence leaks; preserve super-user paths

- **Source:** PR #82 · Macroscope | Greptile
- **Gap:** By-slug API returned 401 vs 404 (enumerable). Legacy `/matches` redirects treated membership load failures and super users with no membership as `/join`. Club match detail did not enforce match.`clubId` vs URL club. Sub-nav ignored path club for super users without membership. Transient by-slug errors looked like 404. Follow-ups: mobile switcher fell back to another membership; shared match store showed stale club list on error; legacy match redirect preferred active membership over the match’s club for super users; cancelled `getClubByIdAPI` could still redirect.
- **Going forward:** Auth before club lookup; unauthorized/missing both 404. Never redirect to `/join` on membership `error` (retry UI). Super users without membership keep all-clubs `/matches`. Resolve legacy match detail via the match’s club (membership or by-id API) before any active-club fallback; check `cancelled` after every await. Clear shared match store when starting/failing a club-scoped fetch. Mobile club `Select` must stay unselected when `displayClubId` is not a membership. Club-scoped match detail must check `expectedClubId`. Path slug drives sub-nav display when it differs from memberships.
- **Pointers:** `app/api/clubs/by-slug/[slug]/route.ts`, `app/matches/page.tsx`, `app/matches/[matchId]/page.tsx`, `components/matches/MatchDetailView.tsx`, `components/matches/ClubMatchesView.tsx`, `components/layout/ClubSubNav.tsx`, `lib/hooks/useClubSlugAccess.ts`

### 2026-09-27 — Keep club selection consistent across chrome and pages

- **Source:** PR #80 · Greptile
- **Gap:** ClubSubNav fell back to a stable club when `activeClubId` was missing, but the matches page still listed every membership and create-match gating used a different rule. Load/switch failures also lacked user-facing recovery.
- **Going forward:** Any UI that depends on “current club” (sub-nav, match list, create eligibility, create API `clubId`) must share one resolver (`resolveEffectiveActiveClubId` / `resolveSelectedClubMembership`). Show membership load and switch errors with retry/alert; do not redirect away from platform pages (`/profile`, `/admin`, auth) when switching clubs.
- **Pointers:** `lib/utils/resolveSelectedClub.ts`, `app/matches/page.tsx`, `components/layout/ClubSubNav.tsx`
