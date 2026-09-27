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
