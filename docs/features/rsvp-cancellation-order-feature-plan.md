# RSVP cancellation order

Fill vacancies on earlier teams from eligible existing RSVPs before assigning a newly arriving player. Continue promotions through later teams instead of leaving a hole after one promotion.

## Status

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Status              | in-progress                                                                                                     |
| Last updated        | 2026-10-14                                                                                                      |
| Verified base       | main at `706550781b7d729d1d019f85a119a5b832c9ce3c`                                                              |
| Related PR / branch | [PR #114](https://github.com/orkunozekin/soccer-team-builder/pull/114) / `codex/rsvp-cancellation-order`        |
| Execution           | Step 1 implemented; implementation head passed review, final handoff verification and coordinator merge pending |

## Goals

- Immediately backfill an earlier team's cancellation from eligible players on higher-numbered teams in RSVP order, continuing until no eligible promotion remains.
- Prevent a later RSVP from taking an earlier vacancy ahead of eligible existing players.
- Preserve goalkeeper constraints, explicit admin team assignments, team capacity, club authorization, counter consistency, and retained cancelled RSVP records.

## Out of scope

- Rewriting all team generation or globally sorting established rosters.
- Removing intentional admin transfers or overriding goalkeeper placement with strict timestamp order.
- Production repairs, migrations, deployment commands, new assignment-history storage, or changing RSVP deletion policy.
- Unrelated match-lock infrastructure changes unless necessary to make this flow correct.

## Current state

- [`removeUserFromMatchTeams`](../../lib/teams/removeUserFromMatchTeams.ts) removes a player and promotes only one earliest RSVP from higher-numbered teams. It leaves the donor team's vacancy unfilled.
- [`assignUnassignedPlayersToTeams`](../../lib/utils/teamGenerator.ts) fills available slots for unassigned RSVPs while retaining existing rosters, then adjusts goalkeeper placement.
- [`expandTeamsForMatch`](../../lib/teams/expandTeamsForMatch.ts) reapplies persisted manual assignments. Latest main also reapplies saved formation positions, which must remain supported.
- [`POST /api/rsvp`](../../app/api/rsvp/route.ts) uses a match lock for team updates. Cancellation updates RSVP status/counters transactionally, then updates teams without that lock.
- Production Firestore confirmed Vance's cancellations and Lance's later RSVP/cancellation for `match_1791436503072_dvndys`. Lance's record is retained as cancelled. His Team 1 placement is firsthand feedback, not independently recovered roster history. Do not describe that placement as proven by stored data.
- Latest main still contains the one-promotion cancellation logic. No matching open PR was found during preparation.

## Todos

1. [ ] Implement cancellation vacancy cascading and protect the cancel/new-RSVP sequence, with regression coverage, in one isolated worktree chat and one PR.

### Step 1: Cascade cancellation vacancies safely

Implement the smallest cohesive change to cancellation backfill and the assignment boundary. Read current main and the related tests before choosing shared helpers.

- Build the post-cancellation roster from confirmed RSVPs. Select the earliest eligible RSVP from later teams for each vacancy; do not promote stale or cancelled team members. Define a stable tie-break for equal timestamps and an explicit policy for missing timestamps.
- Follow the vacancy left on the donor team until no eligible later player remains. Handle empty teams and renumbering without missing or duplicate players. Avoid regenerating unaffected rosters merely to compact a vacancy.
- Respect goalkeeper constraints and persisted manual assignments when selecting and applying promotions. Test intentional exceptions separately from ordinary RSVP priority; stop for a material product decision rather than inventing a new exception policy.
- Coordinate cancellation with the existing per-match lock used by new RSVP team assignment. Choose the lock boundary so lock contention cannot silently commit cancellation without arranging roster cleanup. Preserve transactional counters and safe retry behavior when a cancellation was already committed or cleanup fails. Release locks on every exit path.
- Verify the new-RSVP path cannot fill an earlier vacancy ahead of eligible assigned players, including holes left by prior interrupted cleanup. If a small shared vacancy-compaction helper is necessary at assignment time, include it in this step.
- Keep cancellation as a status update retaining the original RSVP timestamp. Do not use the unused hard-delete helper.

## Files to touch

| Path                                    | Expected change                                                       |
| --------------------------------------- | --------------------------------------------------------------------- |
| `lib/teams/removeUserFromMatchTeams.ts` | Cascading, eligibility, and consistent roster persistence             |
| `lib/utils/teamGenerator.ts`            | Shared pure vacancy logic only if needed                              |
| `lib/teams/expandTeamsForMatch.ts`      | Prevent incoming RSVPs bypassing eligible existing players, if needed |
| `app/api/rsvp/route.ts`                 | Cancellation coordination and retry handling                          |
| Colocated tests for the above           | Behavioral cancellation/arrival and concurrency regression coverage   |
| This plan                               | Validation, review status, PR, and handoff                            |

## Acceptance criteria

- [x] With full Teams 1 and 2 and existing Team 3 players, cancelling from Team 1 promotes the earliest eligible later RSVP and continues filling the donor vacancy. A later arrival cannot enter Teams 1 or 2 ahead of eligible existing Team 3 players.
- [x] The equivalent Team 2 cancellation and a four-team cascade pass.
- [x] A direct Team 1 vacancy followed by a later arrival is tested, matching Lance's reported symptom without claiming a historical reconstruction.
- [x] Empty source/destination teams, last-player cancellation, last-team cancellation, no eligible donor, equal timestamps, missing timestamps, and stale/cancelled roster members have deterministic safe outcomes.
- [x] Goalkeeper placement and intentional manual assignments remain valid; unaffected player assignments remain stable.
- [x] Concurrent cancellation/arrival, duplicate cancellation, lock contention, and cleanup failure/retry tests prove no lost/duplicate players, no double counter decrement, and no permanently skipped cleanup.
- [x] Cancelled RSVP documents and their original RSVP timestamps remain intact.
- [ ] Focused tests, `yarn test:run`, and appropriate type/lint checks pass. Emulator-backed flow validation uses local Auth/Firestore only. Any environment limitation is recorded accurately.
- [x] Capture and inspect the changed roster behavior in the Codex in-app browser using emulator data, and attach evidence to the PR as required by `/implement-feature`. Preserve evidence provenance after review fixes according to current repository rules.
- [ ] A regular PR against main has fresh Greptile 5/5 attributable to its current head, relevant passing CI, addressed actionable bot feedback, and required human approvals before coordinator squash merge.

## Handoff

### Done so far

- Ran `/start` and read current implementation/review/handoff skills. Verified remote main at `706550781b7d729d1d019f85a119a5b832c9ce3c`; copied only this plan from the coordinator checkout.
- Implemented shared deterministic vacancy cascading, confirmed-only roster cleanup, transactional cancellation roster persistence, and atomic incremental arrival writes. Cancellation fills only removed-player/donor vacancies; arrival compacts earlier vacancies before assigning unassigned RSVPs.
- Preserved pinned team assignments, first-two-team goalkeeper limits, roster order, retained cancelled RSVP timestamps, and cancellation counters. Renumbered pin targets atomically with emptied teams. Existing team fields remain untouched.
- Moved POST lock acquisition before duplicate lookup and RSVP creation, and cancellation lock acquisition before mutation. Already-cancelled retries repair cleanup; old cancellation retries preserve a current confirmed rejoin and do not create cancellation audit events. Lock release checks ownership transactionally.
- Validation: final complete emulator-enabled suite passed 536 tests across 108 files; 12 emulator integration tests passed on local Firestore, including cancellation/arrival races, duplicate cancellation, busy lock, cleanup failure/retry, atomic roster-write failure, old cancellation after rejoin, cancelled manual pins not resurrected on arrival, manual pins, goalkeeper limits, last-player removal and renumbering. Six pure vacancy tests include four-team cascading, equal/missing timestamps, empty teams and stale/duplicate members. Changed-file ESLint passes; repository lint passes with pre-existing warnings. TypeScript has 20 existing test-fixture errors, independently reproduced on verified main with identical normalized diagnostics.
- Used the Codex in-app browser against this checkout's Next dev server on port 3107 and demo project `demo-rsvp-cascade`, with Auth 9099 and Firestore 8080 only. Cancelled Player 01 through the UI, inspected Player 12 on Team 1 and Player 23 on Team 2, then added Player 25 through admin RSVP and inspected Player 24/25 on Team 3. Review fixes narrow query reads and exclude inactive pins; they do not change the ordinary confirmed-roster states captured. Three inspected captures are attached in PR #114 description under UI evidence, from dirty implementation state that became `1a249d552d09ba8c67e1ae803e95e5ac4df34fea`. Originals and SHA-256 hashes are preserved in the chat visualization artifact folder.

### Remaining work

1. Verify the final handoff documentation commit receives fresh current-head Greptile 5/5 and relevant passing CI before coordinator merge. Implementation head `f03c3a89f1aa8ea0f058713e46dd4366b90d71cf` received 5/5 with zero new comments and passing unit-test CI/preview. The addressed bot thread is resolved; the fresh re-review request is recorded at PR comment `6183602653`. Evidence is attached and GitHub UI confirms subscription through repository watching.
2. Coordinator independently verifies current head, unresolved threads, evidence and review gates, then squash merges if all gates pass. Worker must not merge or enable auto-merge.
3. Confirm remote merge and record the resulting merge commit through normal plan updates. No further implementation step is authorized here.

### Blockers / risks

- TypeScript is not green on main: 20 existing test-fixture errors remain unchanged. Do not report a successful repository typecheck.
- Implementation head `f03c3a89f1aa8ea0f058713e46dd4366b90d71cf` passed fresh Greptile 5/5 with zero new comments, unit-test CI and preview. Initial 4/5 query feedback is fixed, replied to, resolved and logged in `docs/AGENT_LESSONS.md`. This final handoff documentation commit requires its own current-head verification. Macroscope was skipped for exhausted credits and is not approval.
- Local emulator route tests mock authentication identity and audit sink but exercise real Firestore transactions, lock and roster logic. Browser validation uses actual Auth emulator tokens and the real API route.

### Run ledger

| Step | Chat / host                                      | Branch / PR                               | Reviewed head | State                                   | Merge commit |
| ---- | ------------------------------------------------ | ----------------------------------------- | ------------- | --------------------------------------- | ------------ |
| 1    | `01a13d75-4019-7e81-8f40-b83977a6efef` / `local` | `codex/rsvp-cancellation-order` / pending | Pending       | Implemented, publication/review pending | None         |

### Pointers

- Start at `lib/teams/removeUserFromMatchTeams.ts`, then cancellation in `app/api/rsvp/route.ts` and incremental assignment in `lib/teams/expandTeamsForMatch.ts`.
- Read current `AGENTS.md`, `docs/AGENT_CONTEXT.md`, and skills in the worker checkout. The coordinator checkout is older than main; never copy its implementation files over newer main.
- Local app work uses emulators only. No secrets in chat/git; preserve authZ and sanitized errors.
- PR titles/descriptions stay short and simple, with no em dashes or hard-wrapped paragraphs.
