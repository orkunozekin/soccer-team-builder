# Player Skill Ranking + Skill-Balanced Teams

Plan to give each club a private, admin-maintained skill ranking of its players, seeded for new players by a short skills questionnaire, and to make the existing **Rebalance teams** action use it so matchups are even in strength, not just in size.

## Status

| Field               | Value                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Status              | done (v1 shipped in #137–#141); changed to admin 1–10 ratings, questionnaire off (see below)           |
| Owner session       | —                                                                                                      |
| Last updated        | 2026-11-07                                                                                             |
| Related PR / branch | #137–#141 (v1), #142 (required questionnaire), #143 (yards wording), `orkun/confident-franklin-t55hwy` |

## Change (2026-11-07): admins rate players 1–10; questionnaire off

Owner decision after v1: club admins rate every player themselves on a **1–10** scale, replacing the four-tier ranking, and the skills questionnaire is **switched off for now**.

- **Data:** `clubSkillRankings/{clubId}` now stores `ratings: { [uid]: 1–10 }` (absent = unrated) plus the same `version`, `updatedBy`, `updatedAt`. A doc saved by the old tier ranking reads as unrated (its `version` still counts for the conflict check).
- **Score:** `effective = admin rating ?? 5.5` (the middle of the scale). The questionnaire is not read for balancing.
- **API:** `PUT /api/clubs/[clubId]/skill-ranking` takes `{ ratings, version }`; each value must be a whole number 1–10 for an active member. 409 on a stale version, as before.
- **UI:** the roster page board is now "Player ratings": every active member alphabetically with a "Not rated / 1–10" picker. The RSVP questionnaire step and the profile questionnaire section are removed; the questionnaire API, store and components stay in the codebase (tested, unused) so it can come back.
- **Verified** with `lib/skill/skillRatings.emulator.test.ts` against the Firestore emulator: save, 409 on a stale save, 400 on out-of-range, and rebalance splitting 10/9/8/7 + 4/3/2/1 into 22–22.

The sections below describe v1 (tiers + questionnaire) and are kept for history.

## Why not a 1–5 self-rating

The first draft of this plan asked players to rate themselves 1–5. Rejected after owner feedback:

- **Self-ratings bunch in the middle.** In a pickup group almost everyone picks 3 or 4; nobody picks 1 or 5. Two buckets can't balance teams.
- **Experience-based anchors don't measure skill.** "Played for years" or "played in high school" says nothing about whether someone can control a pass today.
- **Balancing only needs an order.** The balancer needs to know who is stronger than whom, not an absolute number. One organizer who watches everyone play gives a far more consistent order than each player judging themselves.

So v1's source of truth is a **club ranking maintained by admins**. Players fill in a **skills questionnaire** about what they can actually do on the ball; it only places players the admins haven't ranked yet and gives admins a hint when ranking newcomers.

## Goals (v1)

- **Admin skill ranking** — club admins place members into tiers (Top, Strong, Average, Developing) and order them within each tier. One shared ranking per club; any club admin can edit it. Concurrent edits are detected (version check), not silently overwritten.
- **Skills questionnaire** — four questions about observable ability (first touch, passing, fitness, game sense), three concrete answers each. Answered once per player (not per club); required once in the RSVP flow (owner decision after v1: no skipping) and editable from the profile.
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

| Key          | Question                                                        | 1                                  | 2                                     | 3                                                         |
| ------------ | --------------------------------------------------------------- | ---------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `firstTouch` | A firm pass comes to you. Usually…                              | It often gets away from me         | I control it, but need a second touch | It's under control and I'm already turning or passing     |
| `passing`    | Passing to a teammate about 20 yards (18 m) away on the ground… | I often miss the target            | I usually reach them                  | I hit them at the right pace, either foot                 |
| `fitness`    | Over a 60-minute game…                                          | I need regular breaks              | I keep going with a few breaks        | I'm running hard until the end                            |
| `gameSense`  | Before the ball reaches you…                                    | I decide what to do once I have it | I sometimes know my next pass         | I've already checked where the space and my next pass are |

`assessmentScore = 1 + (mean(answers) − 1) × 1.5` → range 1–4, the same scale as tiers.

### Ranking and effective score

Tiers (value): **Top 4, Strong 3, Average 2, Developing 1**. Within a tier with `n > 1` players, position `i` (0 = strongest) adds `0.4 − 0.8 × i / (n − 1)`, so order inside a tier matters without crossing into the next tier.

```
effective = rankingScore ?? assessmentScore ?? DEFAULT_SKILL (2.5)
```

The rebalance response reports how many players fell back to the default (`unratedCount`).

### Data model

| Collection / doc             | Fields                                                                                                                                                     | Access                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `clubSkillRankings/{clubId}` | `clubId`, `tiers: { top: uid[], strong: uid[], average: uid[], developing: uid[] }` (ordered strongest first), `version: number`, `updatedBy`, `updatedAt` | Club admins via API                                                  |
| `skillAssessments/{userId}`  | `userId`, `answers: { firstTouch, passing, fitness, gameSense }` (1–3 each), `updatedAt`                                                                   | Owner via API; admins of a club the user actively belongs to via API |

One doc per club keeps the ranking atomic and small (a club has tens of players). Rules deny all client reads/writes for both collections; everything goes through API routes with the Admin SDK. Lookups are by doc id only, so **no composite index**.

**Concurrency:** `PUT` carries the `version` it was loaded with; the route updates in a transaction and returns `409` if the stored version differs, so two admins can't silently overwrite each other. The UI then reloads.

### API

| Route                                   | Auth              | Behavior                                                                                                                                                                 |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/users/me/skill-assessment`    | `verifyAuth`      | `{ assessment: { answers, updatedAt } \| null }`                                                                                                                         |
| `PUT /api/users/me/skill-assessment`    | `verifyAuth`      | body `{ answers }` (each 1–3; validate with Zod or a parse helper) → upsert                                                                                              |
| `GET /api/clubs/[clubId]/skill-ranking` | `verifyClubAdmin` | `{ ranking: { tiers, version }, members: [{ userId, displayName, position, assessmentScore }] }`. Ranked uids no longer active members are dropped from the response.    |
| `PUT /api/clubs/[clubId]/skill-ranking` | `verifyClubAdmin` | body `{ tiers, version }`; uids must be active members, no duplicates; transaction + version check (`409` on conflict); audit `club.skill_ranking_updated` (counts only) |
| `POST /api/teams/rebalance`             | unchanged         | flag on → response adds `strength: { teams: [{ teamNumber, total, average, size }], unratedCount }`                                                                      |

### Balancer

`balanceTeamsBySkill(teams, scoreByUserId, locked)` — pure, in `lib/teams/`:

1. Group teams into pairs by `teamNumber` (1&2, 3&4, …); an unpaired last team is left alone.
2. Movable pool per pair = players not in `locked` (pinned players + goalkeepers). Each team keeps its number of movable slots, so sizes, GK coverage and pins can't change.
3. Seed: pool sorted by score desc (stable on input order); each player goes to the side with the lower running total that still has a free slot (locked players count toward starting totals).
4. Improve: apply the best pairwise swap that strictly reduces `|totalA − totalB|` until none does.

Runs **last** in the rebalance route, after GK shift and pin application. Pair membership stays RSVP-ordered (pairs are separate games).

### UX

- **RSVP:** when the flag is on and the player has no assessment, `RSVPPositionModal` adds a required "Your game" step after position (no Skip). The answers are saved first and the RSVP is sent only after the save succeeds; a failed save keeps the modal open with the answers and an error so the player can retry. While we don't yet know whether the player answered (loading, or an earlier save in flight) Next is disabled; after a load error the questionnaire is asked again rather than let the RSVP through. _(Changed after v1 at the owner's request; v1 shipped it optional and fire-and-forget.)_
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

| Path                                                         | Change                                    |
| ------------------------------------------------------------ | ----------------------------------------- |
| `lib/flags/featureFlags.ts`, `.env.sample`                   | new flag                                  |
| `types/skill.ts`                                             | types                                     |
| `lib/skill/scoring.ts` (+ test)                              | questionnaire, tiers, scoring, validation |
| `lib/teams/balanceTeamsBySkill.ts` (+ test)                  | balancer                                  |
| `firestore.rules`                                            | deny client access to the two collections |
| `app/api/users/me/skill-assessment/route.ts` (+ test)        | self questionnaire                        |
| `app/api/clubs/[clubId]/skill-ranking/route.ts` (+ test)     | admin ranking                             |
| `app/api/teams/rebalance/route.ts` (+ test)                  | flag, balancer, `strength`                |
| `lib/api/client.ts`                                          | client helpers                            |
| `types/auditLog.ts`                                          | `club.skill_ranking_updated`              |
| `components/skill/SkillQuestionnaire.tsx` (+ test)           | form                                      |
| `components/skill/SkillRankingBoard.tsx` (+ test)            | admin board                               |
| `components/skill/SkillStrengthCard.tsx`                     | admins-only card                          |
| `components/matches/RSVPPositionModal.tsx`, `RSVPButton.tsx` | optional step                             |
| `app/profile/page.tsx`                                       | profile section                           |
| `app/c/[slug]/roster/page.tsx`                               | mount board                               |
| `components/admin/RebalanceTeamsButton.tsx`                  | show card                                 |
| `docs/ARCHITECTURE.md`                                       | collections + routes                      |

## Acceptance criteria

- [x] Flag off: rebalance output unchanged (existing route tests pass); no new UI visible. _(Route tests; flag-off tests for profile, RSVP modal and roster page.)_
- [x] Player answers the questionnaire before their first RSVP (required, no Skip) and can edit it from the profile. _(Component tests; not checked manually against emulators.)_
- [x] Club admins can tier and order members, save, and see a conflict message when another admin saved first; non-admins get 403; other clubs unreachable. _(Route tests for 401/403/409 and club scoping; `SkillRankingBoard` tests for tiering, ordering, save and the conflict UI. Not checked manually against emulators.)_
- [ ] Client Firestore cannot read either collection. _(`firestore.rules` has `allow read, write: if false` for both; not exercised against the rules emulator here, and production needs the `firestore.rules` deploy.)_
- [x] Flag on: rebalance keeps roster membership, sizes, GK coverage and pins; only the outfield split within each pair changes. _(Route + balancer tests; emulator run on a seeded match not done here.)_
- [x] Balancer tests: optimal gap on small cases, locked players never move, odd team untouched, deterministic.
- [x] Admins-only strength card shows after a skill rebalance; players never see it. _(`SkillStrengthCard` + `MatchDetailView` tests.)_
- [ ] `yarn lint`, `yarn test:run`, `yarn build` pass. _(Lint and tests pass. `yarn build` compiles, lints and type-checks, but in the Step 5 container static prerender failed with `auth/invalid-api-key` because there was no Firebase env; needs a run with real env, e.g. the Vercel preview.)_

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
- **Step 1 (merged, [#137](https://github.com/orkunozekin/soccer-team-builder/pull/137), `b87260b`):** flag `skill-balanced-teams` (default false, `NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS` override, `.env.sample`); `types/skill.ts`; `lib/skill/scoring.ts` (`SKILL_QUESTIONNAIRE`, `SKILL_TIER_LABELS`/`SKILL_TIER_VALUES`, `parseSkillAnswers`, `validateSkillTiers` for saves, `normalizeStoredSkillTiers` for reads, `assessmentScore`, `rankingScores`, `computeEffectiveSkillScores` → `{ scoreByUserId, unratedUserIds }`); `lib/teams/balanceTeamsBySkill.ts` (`balanceTeamsBySkill`, `summarizeTeamStrength` → `{ teams: [{ teamNumber, total, average, size }], unratedCount }`, rounded to 2 decimals). Colocated Vitest tests.
- Balancer note: greedy seed + best-improvement pairwise swaps (per Design) is a local search, not exhaustive; on random small pairs it occasionally lands up to ~1 point above the brute-force optimum. Accepted for v1 per the plan.
- **Step 2 (merged, [#138](https://github.com/orkunozekin/soccer-team-builder/pull/138), `19285be`):**
  - `firestore.rules`: `allow read, write: if false` for `clubSkillRankings/{clubId}` and `skillAssessments/{userId}`.
  - [`lib/skill/skillStoreAdmin.ts`](../../lib/skill/skillStoreAdmin.ts) (Admin SDK, takes `adminDb`): `getSkillAssessment`, `saveSkillAssessment`, `getSkillAnswersForUsers` (chunked `getAll`, malformed answers skipped), `getClubSkillRanking(adminDb, clubId, allowedUids?)` → `{ tiers, version }` (0 when missing), `saveClubSkillRanking` (transaction; returns `{ ok: true, version }` or `{ ok: false, conflict: true, currentVersion }`), `getEffectiveSkillScoresForClub(adminDb, clubId, uids)` → `EffectiveSkillScores`.
  - `GET/PUT /api/users/me/skill-assessment` (`verifyAuth`, `'fallback'` → 401, flag off → 403, invalid answers → 400).
  - `GET/PUT /api/clubs/[clubId]/skill-ranking` (`verifyClubAdmin`: no uid → 401, membership lookup error → 503 retryable, non-admin → 403, flag off → 403). GET returns the ranking with former members dropped plus active members (`displayName`, `position`, `assessmentScore` or null). PUT validates `{ tiers, version }` against active members (400), 409 `{ error: 'Another admin changed the ranking. Reload to see their changes.', code: 'version_conflict' }`, audit `club.skill_ranking_updated` (metadata: `rankedCount`, `tierCounts`, `version`).
  - DTO types in `types/skill.ts` (`SkillAssessmentDTO`, `ClubSkillRankingDTO`, `SkillRankingMemberDTO`). Client helpers in `lib/api/client.ts`: `getMySkillAssessmentAPI`, `saveMySkillAssessmentAPI`, `getClubSkillRankingAPI`, `saveClubSkillRankingAPI` (errors carry `status`, e.g. 409, and `code`).
  - Tests: store unit tests (version check, chunking, normalization) and route tests for both routes.

- **Step 3 (merged, [#139](https://github.com/orkunozekin/soccer-team-builder/pull/139), `6703c7f`):**
  - `POST /api/teams/rebalance`: unchanged pipeline, then for a match with `clubId`, `balanceBySkillIfEnabled` evaluates `skill-balanced-teams` server-side (`{ key: uid, email }`; `verifyClubAdminForMatch` now also returns the verified token `email`), loads `getEffectiveSkillScoresForClub` for the uids on the size-balanced teams, and runs `balanceTeamsBySkill` last with locked = goalkeeper candidates + uids in `manualTeamAssignments`. Response adds `strength: { teams, unratedCount, playerCount }`; audit `team.rebalanced` metadata adds `skillBalanced`. Flag off, no `clubId`, or any skill load/flag error (logged) → size-balanced result, no `strength`. Skill moves are never written to `manualTeamAssignments`.
  - `RebalanceStrengthSummary` type (`types/skill.ts`); `rebalanceTeamsAPI` return type gains optional `strength`.
  - `RebalanceTeamsButton`: optional `onSkillBalanced(summary | null)`, called before `onDone`.
  - `components/skill/SkillStrengthCard.tsx`: "Balanced by skill" + "Admins only" + dismiss; per-team bar (relative to the largest total) + total (1 decimal); unrated note with "Rank players" → `clubRosterPath(slug)` when the route has a `slug`.
  - `MatchDetailView`: summary in component state keyed by `matchId`, rendered above `TeamsDisplay` only when `canManageMatch`; cleared on dismiss, on a size-only rebalance, and before any other roster-changing refetch (transfers, drag-and-drop, RSVP changes, match edits, Restore RSVP order) so it never shows stale totals.
  - Tests: route (flag off unchanged, no `clubId` skip, flag on even split + `strength`, pins/GK never move, no new pins, load failure fallback), card, button callback, `MatchDetailView` admin-only card.

- **Step 4 (merged, [#140](https://github.com/orkunozekin/soccer-team-builder/pull/140), `94a5d27`):**
  - [`components/skill/SkillQuestionnaire.tsx`](../../components/skill/SkillQuestionnaire.tsx): controlled form over `SKILL_QUESTIONNAIRE` (fieldset/legend per question, native radios inside ≥44px labels, `useId` names so instances never share selection, theme tokens) + `isSkillQuestionnaireComplete`.
  - [`store/skillAssessmentStore.ts`](../../store/skillAssessmentStore.ts): uid-scoped Zustand store shared by RSVP and profile. `loadSkillAssessment(uid, { force? })` loads once per uid (re-fetches after an error); `saveSkillAssessment(uid, answers)` never throws, returns whether it landed. Separate load/save generations; a uid switch drops everything and bumps both; writes re-check the store uid and the auth uid. A landed save becomes the loaded state and supersedes any load in flight; a failed save leaves the load state alone (no stuck "loading"). A result dropped because the uid signed out resets status to idle so a later sign-in reloads. `useSkillAssessment(uid)` reads as idle/empty for any other uid.
  - Profile: flag on → "Skill questionnaire" `ProfileSection` with [`ProfileSkillQuestionnaire`](../../components/skill/ProfileSkillQuestionnaire.tsx) (keyed by uid): "Only club admins see your answers.", Save enabled only when complete, saved/error status, Retry on load error; syncs answers saved elsewhere until the player edits.
  - RSVP: `RSVPButton` loads the store when the flag is on; `RSVPPositionModal` gets `showSkillStep` (flag on, loaded, no assessment) → Next → "Your game" (Back, Skip, Confirm RSVP enabled when complete). Step and answers reset on open. Answers are saved fire-and-forget alongside `confirmRSVPAPI` (never awaited, never surfaced as an RSVP error); Skip saves nothing. Loading or load error → modal behaves as before. Dialog is capped at `100dvh - 2rem` and scrolls.
  - Tests: questionnaire form, store guards (uid switch, sign-out, superseded load/save, stale failure), profile page (flag off/on, save, completeness, error, retry), modal (flag-off path unchanged, step 2, Skip, Back, reset on reopen), RSVPButton with the real modal + store (flag off, answered, load error, Skip, failed save doesn't block RSVP).

- **Step 5 (done when [#141](https://github.com/orkunozekin/soccer-team-builder/pull/141) merges, branch `orkun/skill-step-5-ranking-board`):**
  - [`components/skill/SkillRankingBoard.tsx`](../../components/skill/SkillRankingBoard.tsx) on `/c/[slug]/roster` below `ClubAdminRoster` when `skill-balanced-teams` is on: Top/Strong/Average/Developing (numbered, strongest first) + Unranked (active members in no tier). Row: name, position · "Questionnaire 2.8 / 4" or "No questionnaire", tier `Select` (incl. Unranked; appends to the end of the target tier), move up/down (`aria-label`s, disabled at the ends). Save ranking / Discard changes, "Unsaved changes" indicator, "Ranking saved." status; 409 → conflict message + Reload, Save disabled until reloaded; other errors show the server's sanitized message. Loading skeleton, retryable load error, generation ref drops stale load/save responses (club change, reload, unmount), state resets per `clubId`, one save in flight (rows disabled while saving). Rows wrap at 320px.
  - [`lib/skill/tierMoves.ts`](../../lib/skill/tierMoves.ts): pure tier-move helpers + unit tests.
  - Tests: board (groups, tier change + reorder + save `{ tiers, version }`, in-flight save, discard, 409 + reload, other errors, load retry, stale club, in-flight save after a club change) and roster page (flag off → no board, no API call).
  - `docs/ARCHITECTURE.md`: skill routes and a "Private skill data" section for both collections.
  - Visual check: an isolated render (esbuild bundle of the real component with a stubbed API client, repo Tailwind/globals.css) in Playwright at 320/390px, dark and light: no horizontal overflow, no clipped controls. No in-app or emulator capture.

### Remaining work

- Merge [#141](https://github.com/orkunozekin/soccer-team-builder/pull/141) after review (coordinator). Then the feature is code-complete.
- Production rollout (manual, not done by agents): create the `skill-balanced-teams` LaunchDarkly flag (default off) and deploy `firestore.rules` (deny blocks; no new indexes, lookups are by doc id).
- Manual checks not done here: emulator run of the board, questionnaire and rebalance with the flag on vs off; rules-emulator check that clients can't read either collection; `yarn build` with real env.

### Run ledger

| Step | Session             | PR                                                                  | Status             |
| ---- | ------------------- | ------------------------------------------------------------------- | ------------------ |
| 1    | Claude Code (cloud) | [#137](https://github.com/orkunozekin/soccer-team-builder/pull/137) | merged (`b87260b`) |
| 2    | Claude Code (cloud) | [#138](https://github.com/orkunozekin/soccer-team-builder/pull/138) | merged (`19285be`) |
| 3    | Claude Code (cloud) | [#139](https://github.com/orkunozekin/soccer-team-builder/pull/139) | merged (`6703c7f`) |
| 4    | Claude Code (cloud) | [#140](https://github.com/orkunozekin/soccer-team-builder/pull/140) | merged (`94a5d27`) |
| 5    | Claude Code (cloud) | [#141](https://github.com/orkunozekin/soccer-team-builder/pull/141) | merged (`86caf60`) |

### Blockers / risks

- New RSVPs after a rebalance erode balance (appended without reshuffle). Accepted for v1.
- Production needs the `skill-balanced-teams` flag created in LaunchDarkly and `firestore.rules` deployed.

### Pointers for the next agent

- Start at: the first step in the Run ledger that is not merged; after #141 merges, only the rollout items in Remaining work are left (see Later for v2 ideas).
- Do not: store skill data on `users`/`clubMemberships`; write skill moves into `manualTeamAssignments`; change `expandTeamsForMatch`; let skill affect roster membership; work beyond your step.
- Verify with: `yarn test:run`, `yarn lint`, `npx tsc --noEmit`; emulator rebalance on a seeded match with the flag on vs off (Step 3+).
