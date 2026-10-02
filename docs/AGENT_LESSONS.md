# Agent lessons (from PR feedback)

Perpetual log of durable lessons captured when PR review comments (Greptile, other review bots, or humans) catch bugs, safety gaps, or improvements that slipped past normal coding.

**Purpose:** bullet-proof future agent code generation. Agents append here via `/address-pr-feedback` when a fix reveals a rule worth remembering.

**Promotion:** a lesson is promoted into [`AGENT_CONTEXT.md`](./AGENT_CONTEXT.md) (and [`.greptile/`](../.greptile/) when it should change review severity) when:

- the same theme appears in **two or more entries** (across PRs or review rounds), or
- it is high severity (AuthZ, data loss, production outage).

Before appending, scan existing entries for the same theme. If one exists, promote the rule in the same change and add a `- **Promoted:** AGENT_CONTEXT.md → <section>` line to each entry it covers. `/start` loads `AGENT_CONTEXT.md`, not this log, so an unpromoted lesson only helps agents that happen to open this file. Keep newest entries at the top.

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

### 2026-10-01 — Pagination animation timing must use page-local positions

- **Source:** PR #109 · Macroscope
- **Gap:** Passing an absolute list offset to MatchCard's animation index hid later pages for seconds because entrance delay grows by 80ms per index.
- **Going forward:** Inspect how child components consume row indexes when adding pagination. Use absolute offsets for semantic ranks and page-local positions for entrance animation timing; test navigation to a later page.
- **Pointers:** `components/matches/ClubMatchesView.tsx`, `components/matches/MatchCard.tsx`


### 2026-09-29 — Summary text inside a button becomes its accessible name

- **Source:** PR #103 · Macroscope
- **Gap:** Moving section descriptions into accordion triggers put every word inside the `<button>`, so screen readers announced a full paragraph (e.g. the RSVP-order explanation) as the control's label. Tests only used substring name regexes, so they still passed. Two of the five changed cards had no collapsed-state assertion.
- **Going forward:** When a trigger shows supporting text, name the button with `aria-labelledby` on the title and link the text with `aria-describedby` (see `SectionAccordionTrigger`). Assert exact `toHaveAccessibleName` and `toHaveAccessibleDescription` for every card the change touches, not just some of them.
- **Pointers:** `components/admin/SectionAccordionTrigger.tsx`

### 2026-09-28 — A taller pinned sidebar footer must still scroll into view

- **Source:** PR #104 · Greptile
- **Gap:** Moving Profile and My clubs into the sidebar's pinned footer made it about 180px tall. Only the nav above it scrolled, so in a short window (around 240px) the nav collapsed to nothing and Sign out was cut off below the `h-dvh` rail and sheet.
- **Going forward:** When adding to a non-scrolling header or footer in a viewport-height panel, check a short window. Put the nav and footer in one `overflow-y-auto` column with the footer on `mt-auto`.
- **Pointers:** `components/layout/AppShell.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (viewport-height panels)

### 2026-09-28 — Transaction callbacks retry; recounts must share the writers' locks

- **Source:** PR #99 · Greptile | Macroscope
- **Gap:** (1) The RSVP cancel set an outer `cancelledInTx` flag inside `runTransaction`; a retried attempt could leave it `true` even when the committed attempt cancelled nothing, so team cleanup ran anyway. (2) Counter seed/resync read confirmed RSVPs with a plain query and then wrote with a batch, so a concurrent RSVP create/cancel between read and write was overwritten.
- **Going forward:** Return the outcome from the transaction callback; never mutate outer state inside it. Recompute denormalized counters inside a transaction that reads the same docs the writers touch (the `_state` doc plus the source query), so conflicts force a retry instead of losing writes.
- **Pointers:** `app/api/rsvp/route.ts` (cancel), `lib/matches/syncMatchRsvpCounts.ts`
- **Promoted:** AGENT_CONTEXT.md → §3 Async state, races, and transactions

### 2026-09-28 — Denormalized counters need bootstrap, transactional cancel, and delete sync

- **Source:** PR #99 · Greptile | Macroscope
- **Gap:** Shipping `rsvpConfirmedCount` for list headcounts left several consistency holes: (1) legacy matches without `_state/rsvp` initialized the counter at 0 on the next RSVP; (2) cancel decremented outside a status re-check so concurrent cancels could double-count down; (3) account deletion deleted confirmed RSVPs without refreshing match counters; (4) match create wrote match + `_state` non-atomically; (5) lazy count loads bumped a shared generation and stranded in-flight upcoming counts.
- **Going forward:** When denormalizing a counter onto a parent doc, seed from source documents before the first increment, mutate the counter in the same transaction that changes source status, recompute (or invalidate) after bulk deletes, write parent + state atomically, and never invalidate in-flight reads just to start a secondary fetch.
- **Pointers:** `lib/matches/syncMatchRsvpCounts.ts`, `app/api/rsvp/route.ts`, `lib/matches/createMatch.ts`, `app/api/users/[userId]/route.ts`, `components/matches/ClubMatchesView.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 Async state, races, and transactions

### 2026-09-28 — Filtered pages still need their pager

- **Source:** PR #98 · Greptile
- **Gap:** Admin user rows hide the signed-in user. Moving pagination inside the “has visible rows” branch meant a later page that only contained that user rendered “No users found” with no Previous control. The same pass also dropped `flex-wrap`, so at 320px the name shrank to nothing beside the fixed role select and remove button.
- **Going forward:** Render list pagination from the unfiltered total, not from the rows left after hiding the current user. A desktop single-line row still needs `flex-wrap` and a minimum width on the name so phones wrap the action group instead of truncating the person.
- **Pointers:** `components/admin/UserRoleManager.tsx` (`showPagination`, row `min-w-[8rem]`)
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (narrow rows). The pager rule is not a standing rule yet.

### 2026-09-28 — Extra row actions must wrap before overflow clips them

- **Source:** PR #94 · Macroscope
- **Gap:** Matching the roster’s single non-wrapping row on the admin users list kept the role select and remove button on one line. The name used `min-w-0`, so it shrank to nothing and the `overflow-hidden` list clipped the remove button at 320px.
- **Going forward:** When a row copies a layout that has fewer trailing actions, give the text a readable `min-width` and `flex-wrap` the action group. Do not rely on `min-w-0` alone inside `overflow-hidden`; the text will absorb the overflow and the last control gets clipped.
- **Pointers:** `components/admin/UserRoleManager.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (narrow rows)

### 2026-09-27 — Paged lists must keep the edited row, and narrow rows must wrap

- **Source:** PR #94 · Greptile | Macroscope
- **Gap:** (1) Promoting a roster member re-sorted admins to the top but left the page index alone, so the row vanished. (2) Numbered pagination and the admin user row were one non-wrapping flex line inside `overflow-hidden` cards, so Next and the delete control were clipped around 320px. (3) Initials used `string[0]`, which splits a supplementary-plane character into a lone surrogate.
- **Going forward:** After a client-side reorder, move the page to the edited row. On narrow screens, stack row actions under the name and do not put a non-wrapping page-number strip in an `overflow-hidden` card; keep Previous/Next reachable without it. Take initials with `Array.from` (code points), not `[0]` or `slice` on the raw string.
- **Pointers:** `components/club/ClubAdminRoster.tsx`, `components/ui/pagination.tsx`, `components/admin/UserRoleManager.tsx`, `components/ui/initials-avatar.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (narrow rows, paged lists)

### 2026-09-27 — Sign-out tests must cover the overlay that locked the page

- **Source:** PR #93 · Greptile
- **Gap:** The sign-out regression test exercised `releasePageInteractionLock` on `AccountMenu` alone. The bug came from signing out inside the open mobile `Sheet`, which is a Radix dialog that sets `pointer-events: none` on `document.body` and can leave that lock after the sheet closes.
- **Going forward:** When a control lives inside a dialog, sheet, or dropdown that locks the page, the regression test must open that overlay, trigger the action from inside it, and assert both that the overlay closed and that body pointer / scroll locks are gone.
- **Pointers:** `components/layout/AppShell.tsx` (mobile `Sheet` + `AccountMenu`), `components/layout/AppShell.test.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (overlays)

### 2026-09-27 — Stale auth callbacks must not publish a profile

- **Source:** PR #88 · Macroscope
- **Gap:** `onAuthStateChanged` does not await the observer. An in-flight sign-in for user A could finish after user B signed in and set `profileReady` plus A’s `userData`, so the admin guard treated B as a confirmed non-admin.
- **Going forward:** Give each auth callback a generation. After every await, skip store writes (`setUserData`, `setProfileReady`, `setLoading`) unless that generation is still current. Resetting `profileReady` at the start of a uid change is not enough on its own.
- **Pointers:** `components/auth/AuthProvider.tsx` (`authGenRef`)
- **Promoted:** AGENT_CONTEXT.md → §3 Async state, races, and transactions (generation guards)

### 2026-09-27 — Profile ready must follow the user; delete follows the match

- **Source:** PR #88 · Macroscope | Greptile
- **Gap:** (1) `profileReady` stayed true after sign-out, so the next sign-in looked role-settled while `userData` was still null and a super user was sent to `/matches`. (2) The club-admin match list rendered `AdminMatchCard` (with Delete) for every row, including unstamped matches `canManageMatchClub` already treats as super-user-only.
- **Going forward:** Reset `profileReady` and clear `userData` when the auth uid changes. Do not reset them on a same-uid token refresh. Choose `AdminMatchCard` per match from `manageFlags`, not from the page-level admin list.
- **Pointers:** `components/auth/AuthProvider.tsx`, `lib/hooks/useAdmin.ts` (`rolePending`), `components/matches/ClubMatchesView.tsx`, `lib/utils/clubMatches.ts` (`canManageMatchClub`)
- **Promoted:** AGENT_CONTEXT.md → §3 Auth, roles, and club context

### 2026-09-27 — Admin role race and all-clubs match links

- **Source:** PR #88 · Macroscope | Greptile
- **Gap:** (1) Admin pages treated `loading === false` as “role known.” The 8-second auth timeout clears `loading` while the user doc is still in flight, so `isAdmin` is briefly false and a super user is sent to `/matches`. (2) All-clubs cards linked to `/matches/[id]`, which redirects to the club detail page, so Back returned to one club instead of All matches.
- **Going forward:** Gate admin redirects on `rolePending` (`user` set and `profileReady` still false), not on `loading` alone. Set `profileReady` only when the user-doc fetch finishes. All-clubs cards (`clubId` null) must link to `/admin/matches/[id]`. Keep create-match off that list: a null club id cannot create, and creating for `activeClubId` while showing every club misstates the target.
- **Pointers:** `components/auth/AuthProvider.tsx`, `components/admin/AdminRouteGuard.tsx`, `lib/hooks/useAdmin.ts` (`rolePending`), `components/matches/ClubMatchesView.tsx` (`matchHref`)
- **Promoted:** AGENT_CONTEXT.md → §3 Auth, roles, and club context

### 2026-09-27 — Super-user all-clubs matches, sheet close, absolute invite links

- **Source:** PR #88 · Greptile | Macroscope
- **Gap:** (1) Redirecting `/admin/matches` through `/matches` sent member super users to their club list, so the all-clubs match view was unreachable. (2) The empty-state “Join a club” link inside the persistent `AppShell` sheet did not clear `sheetOpen`, so the overlay stayed on `/join`. (3) Invite list links can be a relative `/join?code=…` path when the request has no Origin and `NEXT_PUBLIC_APP_URL` is unset; copying that path is not a shareable URL.
- **Going forward:** Keep a distinct all-clubs route (`/admin/matches`, labeled “All matches”) for super users even when they have a membership. Do not send that route through the club redirect. Every control inside a layout sheet that navigates must call the sheet’s close callback. When copying an invite link in the browser, prefix relative paths with `window.location.origin`.
- **Pointers:** `app/admin/matches/page.tsx`, `lib/utils/adminNavLinks.ts`, `components/layout/ClubWorkspaceStatus.tsx`, `components/club/ClubInvitesPanel.tsx` (`shareableInviteLink`)
- **Promoted:** AGENT_CONTEXT.md → §3 Auth, roles, and club context; §3 React / Next.js (overlays)

### 2026-09-27 — Controlled popover close does not clear local filter state

- **Source:** PR #87 · Greptile
- **Gap:** `ClubContextSwitcher` cleared the search only in `onOpenChange`. Selecting a club called `setOpen(false)` directly, which does not fire `onOpenChange`, so reopening the popover kept the filter (visible when a switch does not remount the shell, such as a platform page).
- **Going forward:** When a controlled Radix popover/dialog is closed from an in-content handler, reset local query/form state in that handler. Do not rely on `onOpenChange` for programmatic `setOpen(false)`.
- **Pointers:** `components/layout/ClubContextSwitcher.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 React / Next.js (overlays)

### 2026-09-27 — Club console: membership errors, stale clubId, mutation vs refresh

- **Source:** PR #83 · Macroscope | Greptile
- **Gap:** (1) Membership fetch failure with an empty list made `useClubSlugAccess` / section pages look like 404. (2) Roster/invites applied responses after `clubId` changed. (3) Settings/invite create rolled back or reported failure when only the follow-up refresh failed; revoke stayed enabled during create refresh. (4) Follow-up: invite refresh cleared the list on error; initial list race overwrote post-create refresh; settings checkbox did not reset when `clubId` changed.
- **Going forward:** Propagate membership/`my-clubs` errors as retryable `error` (never forbidden/join/404). Club-scoped panels cancel/ignore stale `clubId` responses and use a request generation for concurrent list fetches. Separate mutation success from refresh failure; on refresh failure keep prior list / optimistic setting. Reset local form state when the club prop changes. Disable conflicting actions while a list refresh is in flight. When clearing a per-row busy id in `finally`, only clear if it still matches the completing row (`setBusyX(prev => prev === id ? null : prev)`).
- **Pointers:** `lib/hooks/useClubSlugAccess.ts`, `components/club/ClubAdminRoster.tsx`, `components/club/ClubInvitesPanel.tsx`, `components/club/ClubSettingsPanel.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 Async state, races, and transactions; §4 safety 15–17

### 2026-09-27 — Club match queries must not require undeployed composite indexes

- **Source:** Production report after PR #82 merge · human (confirmed via Network `runQuery` `FAILED_PRECONDITION`)
- **Gap:** `getMatchesForClub` used `where('clubId')` + `orderBy('date')`. The matching composite index was added to `firestore.indexes.json` in the PR but **not deployed** to production, so members saw “Could not load matches.” Emulators did not catch this (indexes often unenforced locally). Having the composite index itself is fine and desirable; the mistake was query-before-Enabled. RSVP count failures in the same try/catch could also wipe the list.
- **Going forward:** (1) Update `firestore.indexes.json` with any new compound query. (2) Deploy indexes (`firebase deploy --only firestore:indexes` or Console) and wait until **Enabled** before/at cutover. (3) Prefer equality-only + in-memory sort for small lists so missing/Building indexes do not blank the UI. (4) Keep useful indexes; do not “avoid” them. (5) Isolate secondary fetches (RSVP counts) from primary list success.
- **Pointers:** `lib/services/matchService.ts` (`getMatchesForClub`), `components/matches/ClubMatchesView.tsx`, `firestore.indexes.json`, `docs/DEPLOYMENT.md` (indexes), `docs/AGENT_CONTEXT.md` (Client Firebase)
- **Promoted:** AGENT_CONTEXT.md → §3 Client Firebase (composite indexes, isolate secondary fetches)

### 2026-09-27 — Club match list: scoped queries, no create without clubId, invalidate on unmount

- **Source:** PR #82 · Macroscope
- **Gap:** (1) Super-user all-clubs view showed CreateMatchCard with `clubId: null` so creates always failed. (2) `where('clubId','==',null)` does not return docs missing the field, so “unscoped” fetches were incomplete. (3) Unmount did not bump `fetchGen`, so a late response could overwrite the shared match store for the next club page.
- **Going forward:** Only show create-match UI when a concrete `clubId` is in context. Club-scoped client lists query `clubId == <id>` only; do not rely on null-equality for absent fields (super users use full-collection `getAllMatches` for legacy/unscoped). Always invalidate in-flight list fetches on effect cleanup when writing a shared store.
- **Pointers:** `components/matches/ClubMatchesView.tsx`, `lib/services/matchService.ts` (`listMatchesForViewer` / `getMatchesForClub`)
- **Promoted:** AGENT_CONTEXT.md → §3 Client Firebase; §3 Async state (invalidate on cleanup); §3 Auth, roles, and club context

### 2026-09-27 — Club-scoped Firestore queries for member match lists

- **Source:** PR #82 · Macroscope
- **Gap:** `ClubMatchesView` called `getAllMatches()` (unqualified `matches` query). Once any other club had a match, Firestore rejected the query for members because rules cannot prove every result is readable.
- **Going forward:** Client match lists for members must query with `where('clubId', '==', clubId)` (plus optional unscoped `clubId == null`). Super users may keep the collection query when viewing all clubs. Add composite indexes when combining `clubId` + `orderBy`.
- **Pointers:** `lib/services/matchService.ts` (`listMatchesForViewer` / `getMatchesForClub`), `components/matches/ClubMatchesView.tsx`, `firestore.indexes.json`, `firestore.rules` matches read
- **Promoted:** AGENT_CONTEXT.md → §3 Client Firebase (club-tenant queries)

### 2026-09-27 — Club slug routes: no existence leaks; preserve super-user paths

- **Source:** PR #82 · Macroscope | Greptile
- **Gap:** By-slug API returned 401 vs 404 (enumerable). Legacy `/matches` redirects treated membership load failures and super users with no membership as `/join`. Club match detail did not enforce match.`clubId` vs URL club. Sub-nav ignored path club for super users without membership. Transient by-slug errors looked like 404. Follow-ups: mobile switcher fell back to another membership; shared match store showed stale club list on error; legacy match redirect preferred active membership over the match’s club for super users; cancelled `getClubByIdAPI` could still redirect.
- **Going forward:** Auth before club lookup; unauthorized/missing both 404. Never redirect to `/join` on membership `error` (retry UI). Super users without membership keep all-clubs `/matches`. Resolve legacy match detail via the match’s club (membership or by-id API) before any active-club fallback; check `cancelled` after every await. Clear shared match store when starting/failing a club-scoped fetch. Mobile club `Select` must stay unselected when `displayClubId` is not a membership. Club-scoped match detail must check `expectedClubId`. Path slug drives sub-nav display when it differs from memberships.
- **Pointers:** `app/api/clubs/by-slug/[slug]/route.ts`, `app/matches/page.tsx`, `app/matches/[matchId]/page.tsx`, `components/matches/MatchDetailView.tsx`, `components/matches/ClubMatchesView.tsx`, `components/layout/ClubSubNav.tsx`, `lib/hooks/useClubSlugAccess.ts`
- **Promoted:** AGENT_CONTEXT.md → §3 Auth, roles, and club context; §4 safety 15

### 2026-09-27 — Keep club selection consistent across chrome and pages

- **Source:** PR #80 · Greptile
- **Gap:** ClubSubNav fell back to a stable club when `activeClubId` was missing, but the matches page still listed every membership and create-match gating used a different rule. Load/switch failures also lacked user-facing recovery.
- **Going forward:** Any UI that depends on “current club” (sub-nav, match list, create eligibility, create API `clubId`) must share one resolver (`resolveEffectiveActiveClubId` / `resolveSelectedClubMembership`). Show membership load and switch errors with retry/alert; do not redirect away from platform pages (`/profile`, `/admin`, auth) when switching clubs.
- **Pointers:** `lib/utils/resolveSelectedClub.ts`, `app/matches/page.tsx`, `components/layout/ClubSubNav.tsx`
- **Promoted:** AGENT_CONTEXT.md → §3 Auth, roles, and club context (one resolver)
