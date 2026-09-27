# Club context navigation (Vercel-style)

Replace the current Soccerville bar + horizontal club sub-nav with a workspace-style shell: pick a club in a context switcher, then use a club-owned navigation that updates with that selection. Inspired by Vercel’s team switcher + team-scoped sidebar.

This plan **revises the chrome** shipped for [white-label clubs v2](./white-label-clubs-v2-feature-plan.md) todo 2. Slug routes, club-admin console pages, and branding from that plan stay; only the shell layout and switcher UX change.

## Status

| Field | Value |
|-------|-------|
| Status | planned |
| Owner session | — |
| Last updated | 2026-09-27 |
| Related PR / branch | none yet (plan on `cursor/club-context-nav-plan-9fca`) |

## Goals (v1)

- **Club is the workspace.** Selecting a club is the primary context switch (like Vercel’s team switcher), not a secondary control buried in a second bar.
- **Club owns its nav.** Matches, and later roster / invites / settings, live in a club-scoped nav region that always reflects the selected club.
- **Searchable switcher.** Membership list in the switcher is filterable when the user has more than a few clubs; empty and no-membership states are explicit.
- **Mobile-first.** Desktop can use a left rail; phone must not permanently sacrifice content width (drawer / sheet, not a fixed sidebar).
- **Platform stays platform.** Profile, Sign out, and super-user Admin stay account / platform scoped, not mixed into club section links.
- **Out of scope for v1:** command palette, custom domain chrome, restyling the whole app with club colors, rewriting slug/route work beyond what the new shell needs, inventing a second admin area, billing.

## Todos

1. [ ] Lock shell information architecture (context switcher + club nav + account menu) and retire the stacked `Navigation` + `ClubSubNav` chrome.
2. [ ] Build `ClubContextSwitcher` (popover: search, memberships + role, checkmark, Join, Create when flagged).
3. [ ] Build club-owned nav: desktop left rail; mobile sheet / drawer opened from the top shell.
4. [ ] Move platform account links (Profile, Admin, Sign out) into an account control; keep Soccerville as platform brand, not the club label.
5. [ ] Wire switch behavior to existing `activeClubId` + `/c/[slug]/…` section preserve (reuse [`clubPaths`](../../lib/utils/clubPaths.ts) / current `ClubSubNav` switch rules).
6. [ ] Update tests and remove / slim the old sub-nav components; cross-link handoff on the v2 plan.

## Current state

| Area | Today |
|------|--------|
| Shell | Sticky [`AppShell`](../../components/layout/AppShell.tsx): red [`Navigation`](../../components/layout/Navigation.tsx) (Soccerville → `/matches` redirect, Profile, Admin, Sign out) + signed-in [`ClubSubNav`](../../components/layout/ClubSubNav.tsx) (club dropdown + Matches → `/c/{slug}/matches`; mobile uses two stacked `Select`s). |
| Switch | Writes `users.activeClubId` via `PATCH /api/users/me` ([`updateProfileAPI`](../../lib/api/client)). Resolver: [`resolveSelectedClubMembership`](../../lib/utils/resolveSelectedClub.ts). |
| Sections | [`clubSubNavSections`](../../lib/utils/resolveSelectedClub.ts): Matches → `/c/{slug}/matches` (`includeClubAdminSections` default false). Roster / invites / settings hrefs ready. |
| Slug routes | `/c/[slug]/matches` (+ match detail) and legacy `/matches` redirects already on `main` (v2 todo 3). Path helpers: [`lib/utils/clubPaths.ts`](../../lib/utils/clubPaths.ts). |
| Pain | Two bars compete. Club context feels secondary. Mobile is two selects + text links. Switcher has no search. v2 deferred sidebar + searchable switcher; product now wants that direction. |
| Related | [white-label-clubs-v2](./white-label-clubs-v2-feature-plan.md) still owns club-admin pages (todo 4) and branding paint (todo 5). |

Reference UX (product intent): Vercel dashboard context switcher — “Find Team…”, current selection with checkmark, empty state for teams you create/join, footer “Create Team”, and a left nav that belongs to the selected team.

## Design

### Information architecture

```mermaid
flowchart TD
  subgraph shell [Signed-in shell]
    switcher[Club context switcher]
    clubNav[Club-owned nav]
    account[Account menu: Profile, Admin, Sign out]
  end
  switcher -->|sets activeClubId / slug| clubNav
  clubNav --> matches[Matches]
  clubNav --> roster[Roster when admin routes exist]
  clubNav --> invites[Invites]
  clubNav --> settings[Settings]
  account --> profile[/profile]
  account --> admin[/admin/*]
```

| Region | Responsibility |
|--------|----------------|
| **Club context switcher** | Which club you are in. Memberships only (not every club in the product). Join / Create live here. |
| **Club-owned nav** | Sections for the selected club. Links rebuild when the club changes. |
| **Account / platform** | Profile, Sign out, super-user Admin. Never mixed into Matches / Roster / etc. |
| **Signed-out** | Centered Soccerville brand only (same as today). No switcher, no club nav. |

### Desktop (md+)

1. **Left rail** (~240px): top = club context switcher trigger (club name + chevron / Hobby-style role badge optional); below = club section links; bottom = account control (avatar / name, Profile, Admin if `super_user`, Sign out).
2. **Main column**: page content. No second full-width sub-nav bar under a red header.
3. Platform brand: small “Soccerville” mark above the switcher or in the account footer — not a second competing horizontal bar.

### Mobile (&lt; md)

1. **Top bar**: club switcher trigger (truncated name) + button that opens the club nav sheet; account stays behind a compact menu or the same sheet’s footer.
2. **Club nav sheet / drawer**: section links for the current club; does not stay open as a permanent sidebar.
3. Avoid stacking: no platform hamburger + club select + section select as three separate chrome layers.

No `components/ui/sheet` or sidebar primitive exists yet. Prefer adding a shadcn `Sheet` (or Dialog-based drawer) rather than a full shadcn sidebar kit unless the rail needs collapse/resize.

### Club context switcher (popover)

Match the Vercel pattern with Soccerville nouns:

| Element | Behavior |
|---------|----------|
| Trigger | Current club display name (+ optional role chip). Disabled while switch request in flight. |
| Search | “Find club…” filters memberships by name. Show when `activeMemberships.length >= 5` (always-on search is fine if simpler). Esc closes. |
| List | Active memberships: name, role (`player` / `club_admin`), checkmark on current. |
| Empty memberships | Copy + Join CTA (reuse today’s empty sub-nav intent). |
| Footer | Join a club → `/join`. Create club → `/admin/users` only when `club-creation` is on and user is super user. |
| Super user | Menu lists **their** memberships only, same as today. |

Switch handler: keep [`ClubSubNav`](../../components/layout/ClubSubNav.tsx) behavior — `PATCH` `activeClubId`, update auth store, stay on platform paths, otherwise preserve section when the new role allows it else land on Matches. Once `/c/[slug]` exists, navigate to the same section on the new slug (v2 design §3).

### Club-owned nav items

Reuse [`clubSubNavSections`](../../lib/utils/resolveSelectedClub.ts). Do not invent a parallel link list.

- Today: only Matches at `/c/{slug}/matches`.
- When v2 todo 4 flips `includeClubAdminSections`: Roster / Invites / Settings with the same role gates.

Active state: `aria-current="page"` from pathname (prefer `/c/[slug]/…`; treat legacy `/matches` as Matches only while redirects still exist).

### Relationship to white-label v2

| Stays in v2 | Moves here |
|-------------|------------|
| Roster / invites / settings pages (todo 4) | Shell chrome layout |
| Branding fields on the club chrome (todo 5) | Searchable context switcher |
| QR, invite-only, ownership, attendance, copy | Desktop rail + mobile sheet |
| Already shipped: `/c/[slug]/matches` + redirects | Retiring horizontal `ClubSubNav` bar |

When this ships, update v2 Status / Handoff: todo 2 chrome is superseded; branding paints the **club rail / switcher**, not the old sub-nav bar. v2 “Out of scope: sidebar / searchable switcher” is obsolete for that bullet.

### Visual direction

Keep existing zinc / shadcn patterns and the Soccerville red for **platform** accents only if still needed (account or signed-out header). Do not rebuild marketing visuals. Club branding (v2 todo 5) later applies CSS variables on the club rail / switcher trigger only.

## Critical decisions

1. **Club context ≠ platform Admin.** Super-user `/admin/*` stays platform. Club admin console stays club-scoped sections.
2. **Do not keep both** a full horizontal sub-nav and a left rail. One club-owned nav surface.
3. **Mobile = sheet, not fixed sidebar.** Content width wins on phone.
4. **AuthZ unchanged.** Hiding a link is not authorization; APIs keep `verifyClubMember` / `verifyClubAdmin` / `verifySuperUser`.
5. **Emulators only** for local work. No production Firebase from agent sessions.
6. Prefer smallest diff: rewrite shell components; leave match pages and APIs alone unless a link href must change.

## Files to touch

| Path | Change |
|------|--------|
| [`components/layout/AppShell.tsx`](../../components/layout/AppShell.tsx) | New shell: rail + main (desktop), top bar + sheet (mobile). |
| [`components/layout/Navigation.tsx`](../../components/layout/Navigation.tsx) | Shrink to signed-out header and/or fold account links into account menu; stop being the primary club entry. |
| [`components/layout/ClubSubNav.tsx`](../../components/layout/ClubSubNav.tsx) | Replace with switcher + club nav pieces, or delete after extraction. |
| New `components/layout/ClubContextSwitcher.tsx` | Searchable membership popover. |
| New `components/layout/ClubNav.tsx` (name flexible) | Section links for rail + sheet. |
| New `components/ui/sheet.tsx` (if added) | Mobile club nav container. |
| [`lib/utils/resolveSelectedClub.ts`](../../lib/utils/resolveSelectedClub.ts) | Keep resolver + `clubSubNavSections`; only change if hrefs need `/c/[slug]` early. |
| [`components/layout/ClubSubNav.test.tsx`](../../components/layout/ClubSubNav.test.tsx) / new tests | Cover switcher search, empty state, section active state, mobile trigger. |
| [`docs/features/white-label-clubs-v2-feature-plan.md`](./white-label-clubs-v2-feature-plan.md) | Note chrome supersession in Status / Handoff when implementation lands. |
| [`app/layout.tsx`](../../app/layout.tsx) | Only if shell mount / body layout classes change. |

## Acceptance criteria

- [ ] Signed-in users pick a club from a context switcher (name + role + current checkmark). Switching updates `activeClubId` and club nav labels/links.
- [ ] Club section links live in a club-owned nav (desktop rail, mobile sheet), not a second full-width bar under the old red header.
- [ ] Switcher supports filtering memberships when the user has many clubs; no-membership state offers Join.
- [ ] Profile, Sign out, and super-user Admin are reachable from an account control, not mixed into club section links.
- [ ] Signed-out header unchanged in spirit (centered Soccerville, no club chrome).
- [ ] Create club still gated by `club-creation` + super user.
- [ ] Existing unit tests updated; new switcher / shell tests pass via `yarn test:run` for the touched files.
- [ ] Mobile: club nav does not permanently shrink the content column.

## Later

- Keyboard command palette to jump clubs / sections.
- Collapse / icon-only desktop rail.
- Club avatar / logo in the switcher trigger (pairs with v2 branding).
- Persist last-opened club nav sheet state (not needed for v1).

## Handoff

> Updated by `/handoff`. `/feature-context` reads this first.

### Done so far

- Plan drafted from current `ClubSubNav` / `AppShell` and Vercel-style product direction.
- No implementation yet.

### Remaining work

1. Confirm desktop rail + mobile sheet with the human if anything in Design conflicts with taste; otherwise implement todo 1–4 on a feature branch.
2. Reuse switch + `clubSubNavSections` logic; do not fork membership resolution.
3. Point Matches (and switch navigation) at `/c/{slug}/matches`; do not revive bare `/matches` as the canonical club link.
4. Run `/handoff` when status moves past `planned`.

### Blockers / risks

- Product previously rejected a sidebar for mobile; this plan uses a **conditional** rail (desktop only). If the human wants a permanent phone sidebar, revisit before coding.
- Branding todo in v2 assumed a horizontal club bar; paint target becomes the rail / switcher.
- Double chrome during migration: delete the old sub-nav in the same PR that ships the rail so users never see both.

### Pointers for the next agent

- Start at: Design (IA) → implement `ClubContextSwitcher` + `AppShell` layout split; extract section list from `ClubSubNav`.
- Do not: weaken auth helpers; list all clubs for super users; put Admin under club sections; point local Firebase at production; keep the horizontal `ClubSubNav` bar alongside the new rail.
- Verify with: `yarn vitest run` on layout + `resolveSelectedClub` tests; manual check signed-out, no-membership, single club, multi-club switch, super-user Admin still reachable.
- Next skills: `/feature-context` on this file to implement; `/handoff` when a session ends; keep [white-label-clubs-v2](./white-label-clubs-v2-feature-plan.md) handoff updated when chrome lands.
