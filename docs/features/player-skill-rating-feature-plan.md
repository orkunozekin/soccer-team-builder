# Player Skill Ranking + Skill-Balanced Teams

Plan to give each club a private, admin-maintained skill ranking of its players, seeded for new players by a short skills questionnaire, and to make the existing **Rebalance teams** action use it so matchups are even in strength, not just in size.

## Status

| Field | Value |
|-------|-------|
| Status | in-progress |
| Owner session | — |
| Last updated | 2026-11-05 |
| Related PR / branch | `orkun/confident-franklin-t55hwy` |

## Why not a 1–5 self-rating

The first draft of this plan asked players to rate themselves 1–5. Rejected after owner feedback:

- **Self-ratings bunch in the middle.** In a pickup group almost everyone picks 3 or 4; nobody picks 1 or 5. Two buckets can't balance teams.
- **Experience-based anchors don't measure skill.** "Played for years" or "played in high school" says nothing about whether someone can control a pass today.
- **Balancing only needs an order.** The balancer needs to know who is stronger than whom, not an absolute number. One organizer who watches everyone play gives a far more consistent order than each player judging themselves.

So v1's source of truth is a **club ranking maintained by admins**. Players fill in a **skills questionnaire** about what they can actually do on the ball; it only places players the admins haven't ranked yet and gives admins a hint when ranking newcomers.

## Goals (v1)

- **Admin skill ranking** — club admins place members into tiers (Top, Strong, Average, Developing) and order them within each tier. One shared ranking per club; any club admin can edit it. Concurrent edits are detected (version check), not silently overwritten.
- **Skills questionnaire** — four questions about observable ability (first touch, passing, fitness, game sense), three concrete answers each. Answered once per player (not per club); prompted as an optional step in the RSVP flow and editable from the profile.
- **Private** — the ranking is visible only to club admins (and super users). Questionnaire answers are visible to the player and to admins of clubs they belong to. Nothing appears on rosters, team cards or match pages for players.
- **Skill-aware rebalance** — with the flag on, **Rebalance teams** keeps everything it does today (RSVP-order roster selection, even pair sizes, one GK per team where available, admin pins) and then swaps outfield players within each matchup pair (Team 1 vs 2, 3 vs 4, …) to minimize the difference in total skill.
- **Admins-only strength card** on the match page after a skill rebalance: per-team strength, how many players had no ranking or questionnaire, a link to the ranking. No other match page changes.
- **Feature flag** — everything ships behind the LaunchDarkly flag `skill-balanced-teams` (default off).
- **Out of scope for v1:**
  - Separate per-admin rankings averaged together (v1: one shared ranking).
  - Post-match peer comparisons ("who was stronger today, A or B?").
  - Ratings learned from match scores (Elo / TrueSkill). Needs score capture first.
  - Position-aware balancing (spreading DEF/MID/FWD).
  - Changing the auto-generation that runs on every RSVP (`expandTeamsForMatch`).

## Todos

Implemented as five sequential steps, one PR each. Each step merges before the next starts.

1. **Step 1: Foundation (pure logic).** Flag `skill-balanced-teams` in [`lib/flags/featureFlags.ts`](../../lib/flags/featureFlags.ts) (+ `NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS` local override, test, `.env.sample`). [`types/skill.ts`](../../types/skill.ts). [`lib/skill/scoring.ts`](../../lib/skill/scoring.ts): questionnaire definition, answer/tier validation, tier values, effective score. [`lib/teams/balanceTeamsBySkill.ts`](../../lib/teams/balanceTeamsBySkill.ts) + team strength summary. Unit tests for all of it. No routes or UI.
2. **Step 2: Storage + APIs.** `firestore.rules` deny blocks for `clubSkillRankings` and `skillAssessments`. Admin-SDK store helpers (`lib/skill/skillStoreAdmin.ts`, version-checked ranking save in a transaction). `GET/PUT /api/users/me/skill-assessment`, `GET/PUT /api/clubs/[clubId]/skill-ranking` (flag-gated, auth helpers, `sanitizeErrorForClient`, audit `club.skill_ranking_updated`). Client helpers in `lib/api/client.ts`. Route tests (auth, 403, 400, 409, happy path).
3. **Step 3: Skill-aware rebalance.** Rebalance route evaluates the flag server-side, loads effective scores for the match's club, runs the balancer last (locked = goalkeepers + pinned), returns `strength`. Route tests: flag off unchanged, flag on swaps within pair, pins never move, no new `manualTeamAssignments`. `RebalanceTeamsButton` passes the summary up; admins-only `SkillStrengthCard` in `MatchDetailView` (no other match page changes).
4. **Step 4: Questionnaire UI.** Shared `SkillQuestionnaire` form, a uid-scoped store shared by RSVP and profile, profile section (flag on), optional "Your game" step in `RSVPPositionModal` (skippable; saving never blocks or fails the RSVP). Component tests.
5. **Step 5: Admin ranking board + docs.** `SkillRankingBoard` on `/c/[slug]/roster` (flag on): tiers + Unranked, tier select, move up/down, Save/Discard, 409 conflict message, 320px wrapping. Component tests. `docs/ARCHITECTURE.md` (collections + routes). Close the handoff.

## Current state

- **Rebalance today balances size, not strength.** [`app/api/teams/rebalance/route.ts`](../../app/api/teams/rebalance/route.ts) (club admin via `verifyClubAdminForMatch`): RSVP-ordered roster → GK priority → pair split with even sizes → `shiftGoalkeepersOntoTeamsWithoutGk` → `applyPersistedTransfersKeepingBalance` (admin pins from `matches/{id}.manualTeamAssignments`) → batch write → audit `team.rebalanced`.
- **Button:** [`components/admin/RebalanceTeamsButton.tsx`](../../components/admin/RebalanceTeamsButton.tsx) in [`components/matches/MatchDetailView.tsx`](../../components/matches/MatchDetailView.tsx) (`canManageMatch && teams.length >= 2`).
- **Undo path:** [`components/admin/RestoreRsvpOrderButton.tsx`](../../components/admin/RestoreRsvpOrderButton.tsx) (`restoreRsvpOrder: true`) re-applies pins only, so it also undoes a skill rebalance.
- **Auto-generation on RSVP** ([`lib/teams/expandTeamsForMatch.ts`](../../lib/teams/expandTeamsForMatch.ts)) appends new players without reshuffling; a plain force-regenerate keeps current-vs-baseline diffs, so a skill-balanced roster survives it. New RSVPs after a rebalance erode balance; admin re-presses Rebalance.
- **RSVP confirm:** [`components/matches/RSVPPositionModal.tsx`](../../components/matches/RSVPPositionModal.tsx) from [`components/matches/RSVPButton.tsx`](../../components/matches/RSVPButton.tsx).
- **Club admin roster:** `/c/[slug]/roster` → [`components/club/ClubAdminRoster.tsx`](../../components/club/ClubAdminRoster.tsx) (club admins only).
- **Privacy constraint:** `users/{uid}` is readable by any signed-in user and `clubMemberships` by any club member ([`firestore.rules`](../../firestore.rules)), so skill data must not live on either.

## Design

### Questionnaire

Each answer scores 1–3. Copy describes what happens, not how long someone has played.

| Key | Question | 1 | 2 | 3 |
|-----|----------|---|---|---|
| `firstTouch` | A firm pass comes to you. Usually… | It often gets away from me | I control it, but need a second touch | It's under control and I'm already turning or passing |
| `passing` | Passing to a teammate about 20 m away on the ground… | I often miss the target | I usually reach them | I hit them at the right pace, either foot |
| `fitness` | Over a 60-minute game… | I need regular breaks | I keep going with a few breaks | I'm running hard until the end |
| `gameSense` | Before the ball reaches you… | I decide what to do once I have it | I sometimes know my next pass | I've already checked where the space and my next pass are |

`assessmentScore = 1 + (mean(answers) − 1) × 1.5` → range 1–4, the same scale as tiers.

### Ranking and effective score

Tiers (value): **Top 4, Strong 3, Average 2, Developing 1**. Within a tier with `n > 1` players, position `i` (0 = strongest) adds `0.4 − 0.8 × i / (n − 1)`, so order inside a tier matters without crossing into the next tier.

```
effective = rankingScore ?? assessmentScore ?? DEFAULT_SKILL (2.5)
```

The rebalance response reports how many players fell back to the default (`unratedCount`).

### Data model

| Collection / doc | Fields | Access |
|------------------|--------|--------|
| `clubSkillRankings/{clubId}` | `clubId`, `tiers: { top: uid[], strong: uid[], average: uid[], developing: uid[] }` (ordered strongest first), `version: number`, `updatedBy`, `updatedAt` | Club admins via API |
| `skillAssessments/{userId}` | `userId`, `answers: { firstTouch, passing, fitness, gameSense }` (1–3 each), `updatedAt` | Owner via API; admins of a club the user actively belongs to via API |

One doc per club keeps the ranking atomic and small (a club has tens of players). Rules deny all client reads/writes for both collections; everything goes through API routes with the Admin SDK. Lookups are by doc id only, so **no composite index**.

**Concurrency:** `PUT` carries the `version` it was loaded with; the route updates in a transaction and returns `409` if the stored version differs, so two admins can't silently overwrite each other. The UI then reloads.

### API

| Route | Auth | Behavior |
|-------|------|----------|
| `GET /api/users/me/skill-assessment` | `verifyAuth` | `{ assessment: { answers, updatedAt } \| null }` |
| `PUT /api/users/me/skill-assessment` | `verifyAuth` | body `{ answers }` (each 1–3; validate with Zod or a parse helper) → upsert |
| `GET /api/clubs/[clubId]/skill-ranking` | `verifyClubAdmin` | `{ ranking: { tiers, version }, members: [{ userId, displayName, position, assessmentScore }] }`. Ranked uids no longer active members are dropped from the response. |
| `PUT /api/clubs/[clubId]/skill-ranking` | `verifyClubAdmin` | body `{ tiers, version }`; uids must be active members, no duplicates; transaction + version check (`409` on conflict); audit `club.skill_ranking_updated` (counts only) |
| `POST /api/teams/rebalance` | unchanged | flag on → response adds `strength: { teams: [{ teamNumber, total, average, size }], unratedCount }` |

### Balancer

`balanceTeamsBySkill(teams, scoreByUserId, locked)` — pure, in `lib/teams/`:

1. Group teams into pairs by `teamNumber` (1&2, 3&4, …); an unpaired last team is left alone.
2. Movable pool per pair = players not in `locked` (pinned players + goalkeepers). Each team keeps its number of movable slots, so sizes, GK coverage and pins can't change.
3. Seed: pool sorted by score desc (stable on input order); each player goes to the side with the lower running total that still has a free slot (locked players count toward starting totals).
4. Improve: apply the best pairwise swap that strictly reduces `|totalA − totalB|` until none does.

Runs **last** in the rebalance route, after GK shift and pin application. Pair membership stays RSVP-ordered (pairs are separate games).

### UX

- **RSVP:** when the flag is on and the player has no assessment, `RSVPPositionModal` adds an optional "Your game" step after position. "Skip" never blocks the RSVP; the assessment saves independently of the RSVP call, and a failed save doesn't fail the RSVP.
- **Profile:** "Skill questionnaire" section (flag on) with the same form. Note: "Only club admins see your answers."
- **Club roster page (admins):** a "Skill ranking" card below the member list (flag on). Four tier groups plus an "Unranked" group. Each row: name, position, questionnaire hint (e.g. "Questionnaire 2.8" or "No questionnaire"), a tier `Select`, and move up / move down buttons. Save / Discard; dirty-state indicator; 409 shows "Another admin changed the ranking. Reload to see their changes." Rows wrap at 320px.
- **Match page:** after a successful skill rebalance, an admins-only card under the button: "Balanced by skill", per-team bar + total, "N of M players unrated, counted as average · Rank players" (link to roster). Held in component state only (not persisted, never shown to players).

## Critical decisions

- **RSVP order still decides who plays.** Skill only decides which team you're on.
- **Do not write skill moves into `manualTeamAssignments`** (they'd become pins and break Restore RSVP order).
- **Server evaluates the flag** in the rebalance route; the client never chooses the mode.
- **Questionnaire is global, ranking is per club.** Ability doesn't change between clubs; a club's relative order does.
- **Skill data never goes on `users` or `clubMemberships`.**
- **Async UI rules apply** (stale club responses ignored, refresh failures don't roll back saves).

## Files to touch

| Path | Change |
|------|--------|
| `lib/flags/featureFlags.ts`, `.env.sample` | new flag |
| `types/skill.ts` | types |
| `lib/skill/scoring.ts` (+ test) | questionnaire, tiers, scoring, validation |
| `lib/teams/balanceTeamsBySkill.ts` (+ test) | balancer |
| `firestore.rules` | deny client access to the two collections |
| `app/api/users/me/skill-assessment/route.ts` (+ test) | self questionnaire |
| `app/api/clubs/[clubId]/skill-ranking/route.ts` (+ test) | admin ranking |
| `app/api/teams/rebalance/route.ts` (+ test) | flag, balancer, `strength` |
| `lib/api/client.ts` | client helpers |
| `types/auditLog.ts` | `club.skill_ranking_updated` |
| `components/skill/SkillQuestionnaire.tsx` (+ test) | form |
| `components/skill/SkillRankingBoard.tsx` (+ test) | admin board |
| `components/skill/SkillStrengthCard.tsx` | admins-only card |
| `components/matches/RSVPPositionModal.tsx`, `RSVPButton.tsx` | optional step |
| `app/profile/page.tsx` | profile section |
| `app/c/[slug]/roster/page.tsx` | mount board |
| `components/admin/RebalanceTeamsButton.tsx` | show card |
| `docs/ARCHITECTURE.md` | collections + routes |

## Acceptance criteria

- [ ] Flag off: rebalance output unchanged (existing route tests pass); no new UI visible.
- [ ] Player can answer/edit the questionnaire from RSVP (skippable) and profile.
- [ ] Club admins can tier and order members, save, and see a conflict message when another admin saved first; non-admins get 403; other clubs unreachable.
- [ ] Client Firestore cannot read either collection.
- [ ] Flag on: rebalance keeps roster membership, sizes, GK coverage and pins; only the outfield split within each pair changes.
- [ ] Balancer tests: optimal gap on small cases, locked players never move, odd team untouched, deterministic.
- [ ] Admins-only strength card shows after a skill rebalance; players never see it.
- [ ] `yarn lint`, `yarn test:run`, `yarn build` pass.

## Later

- Per-admin rankings averaged into one.
- Post-match peer comparisons (pairwise "who was stronger?") → Bradley-Terry / Elo.
- Score capture → results-based rating blended with the ranking.
- Position-aware balancing; auto skill-balance when RSVPs close.

## Handoff

> Updated by `/handoff`. `/feature-context` reads this first.

### Done so far

- Plan revised after owner feedback (admin ranking + questionnaire instead of 1–5 self-rating).
- Owner decisions: one shared ranking per club; questionnaire in v1; match page gets only the admins-only strength card.
- Workflow: one PR per step (Todos 1–5), each squash-merged after a passing AI review on its head (Greptile 5/5, or a clean Codex review when Greptile is unavailable; see `docs/AGENT_CONTEXT.md` § Code review on every PR) and green CI, before the next step starts.

### Remaining work

- Step 1 (Foundation), then Steps 2–5 in order.

### Run ledger

| Step | Session | PR | Status |
|------|---------|----|--------|
| 1 | — | — | not started |
| 2 | — | — | not started |
| 3 | — | — | not started |
| 4 | — | — | not started |
| 5 | — | — | not started |

### Blockers / risks

- New RSVPs after a rebalance erode balance (appended without reshuffle). Accepted for v1.
- Production needs the `skill-balanced-teams` flag created in LaunchDarkly and `firestore.rules` deployed.

### Pointers for the next agent

- Start at: the first step in the Run ledger that is not merged.
- Do not: store skill data on `users`/`clubMemberships`; write skill moves into `manualTeamAssignments`; change `expandTeamsForMatch`; let skill affect roster membership; work beyond your step.
- Verify with: `yarn test:run`, `yarn lint`, `npx tsc --noEmit`; emulator rebalance on a seeded match with the flag on vs off (Step 3+).
