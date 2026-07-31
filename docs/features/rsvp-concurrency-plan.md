# RSVP Concurrency Plan

## Context

When multiple users RSVP to the same match at the same time (e.g. up to ~30 people), we need to ensure:

1. **Data consistency** — All RSVPs are reflected in teams; no lost or duplicate assignments.
2. **Smooth UX** — Each user sees their RSVP and team assignment as soon as their request completes, without waiting for everyone else.

---

## Current Behavior

### What’s safe

- **RSVP collection**: Each user writes to a **different document** (`rsvp_${matchId}_${uid}_${Date.now()}`). Firestore handles concurrent writes to different documents without conflict. No change needed here.

### What’s at risk

1. **Team regeneration**  
   After each new RSVP, the API calls `expandTeamsForMatch(matchId)`, which:
   - Reads all confirmed RSVPs for the match
   - Deletes all existing team docs under `matches/{matchId}/teams`
   - Writes new team docs

   This is a read–modify–write on the same logical resource. With concurrent RSVPs:
   - Multiple requests can run `expandTeamsForMatch` in parallel.
   - Each reads RSVPs at a slightly different time (some new RSVPs may not be visible yet).
   - They all delete and rewrite the same teams subcollection → **last write wins**.
   - **Result**: Teams can be missing players or reflect an older snapshot.

2. **GK cap (2 per match)**  
   The “at most 2 goalkeepers” check is: query confirmed RSVPs → count GKs → if &lt; 2, allow and write. Two GK RSVPs can both pass the check before either write commits → small race, possible 3+ GKs.

---

## Planned Fixes

### 1. Serialize team regeneration per match (required)

- **Goal**: Only one `expandTeamsForMatch` run at a time per `matchId`.
- **Options**:
  - **Single instance**: In-memory lock per `matchId` (e.g. `Map` + mutex). Simple and sufficient if the app runs on one server.
  - **Multiple instances (e.g. Vercel)**: Use a **per-match lock in Firestore** (e.g. `matches/{matchId}/_lock` with a short TTL). Acquire lock → run `expandTeamsForMatch` → release lock. Retry or queue if lock is held.
- **UX**: Each user still gets a response only after their RSVP is written and one regeneration that includes them. They do **not** wait for “everyone to finish”; at most they wait for one other regeneration in progress (typically 1–2 seconds).

### 2. Atomic GK cap (recommended)

- **Goal**: Enforce “at most 2 goalkeepers” even under concurrent GK RSVPs.
- **Approach**: Use a **Firestore transaction**: read confirmed RSVPs for the match, count GKs, and create/update the RSVP document in the same transaction. Reject if GK count would exceed 2.
- **UX**: No change; just correct enforcement of the rule.

---

## UX Summary

| Question                                                   | Answer                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Will users see their RSVP reflected in a team immediately? | **Yes** — as soon as their request completes (RSVP written + one serialized regeneration that includes them). |
| Do they have to wait for everyone to finish RSVPing?       | **No** — they only wait for their own request and, if the lock is held, for one other regeneration to finish. |
| Extra delay under load?                                    | In a burst (e.g. 30 at once), some users may wait an extra 1–2 seconds while the per-match lock is held.      |

---

## Implementation checklist

- [x] Add per-match locking (in-memory or Firestore) around `expandTeamsForMatch`.
- [x] Ensure RSVP route acquires lock after writing RSVP, runs `expandTeamsForMatch`, then releases lock.
- [x] (Optional) Move GK count + RSVP write into a Firestore transaction in `app/api/rsvp/route.ts` for atomic GK cap.
- [x] (Optional) Add a short retry/backoff if lock cannot be acquired (e.g. 2–3 retries with 500 ms delay).

---

## Files touched

- `app/api/rsvp/route.ts` — Acquires lock around `expandTeamsForMatch` (existing-RSVP and new-RSVP paths); uses Firestore transaction for atomic GK cap + RSVP create. Returns 503 with `code: 'LOCK_BUSY'` if lock cannot be acquired after retries.
- `lib/teams/expandTeamsForMatch.ts` — Unchanged; lock is applied at call site.
- `lib/locks/matchLock.ts` — Firestore per-match lock: document at `matches/{matchId}/_lock/regeneration` with TTL 30s, 3 retries with 500 ms delay. Works across serverless instances.

---

## Testing

Use **local dev** (emulators + `yarn dev`) so you don’t affect production.

### 1. Lock / serialized regeneration (no lost teams)

**Goal:** Under concurrent RSVPs, every confirmed user appears in the teams and no 503 (or 503 then retry succeeds).

- **Manual:** Open 3–5 browser tabs (or a mix of normal + incognito), each logged in as a **different** user. Create or pick a match with RSVP open. In quick succession click **RSVP to Match** in each tab.
  - **Expect:** All tabs eventually show “RSVP’d” and teams; roster total = number of RSVPs. If any tab shows “Team update is busy”, click RSVP again and it should succeed.
  - **Check:** In Emulator UI → Firestore → `matches/{matchId}/teams`, each team doc’s `playerIds` should account for all confirmed RSVPs (no duplicates, no missing UIDs).

- **Concurrent requests from browser:** While logged in on the match page, open DevTools → Console and run (replace `MATCH_ID` with the match id):

```js
const matchId = 'MATCH_ID'
const n = 8
const res = await Promise.all(Array(n).fill(0).map(() =>
  fetch('/api/rsvp', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId }) }
))
console.log(res.map(r => r.status))  // expect mostly 200, maybe one 503
res.filter(r => r.status === 503).forEach(r => r.json().then(d => console.log('503:', d)))
```

Same user RSVPing 8 times: first is 200 (new RSVP), rest are 200 (existing RSVP, regeneration runs each time). You’re stressing the lock; all should succeed (or one 503 and retry).

### 2. Atomic GK cap (at most 2 GKs)

**Goal:** With 3+ users trying to RSVP as GK at once, exactly 2 succeed and the rest get “already 2 goalkeepers”.

- **Manual:** Use 3 different users whose **profile position is GK** (or use the position picker when RSVPing). Open 3 tabs, one per user, same match. Click **RSVP to Match** in all 3 at roughly the same time (e.g. count down and click in each).
  - **Expect:** Two tabs get success; one gets the “There are already 2 goalkeepers” message (and can pick another position).
  - **Check:** In Firestore, count confirmed RSVPs for that match with effective position = GK; should be 2.

### 3. 503 and retry

**Goal:** When the lock is busy, API returns 503 and the UI message is clear; retrying works.

- Trigger many concurrent RSVPs (e.g. script below or 5+ tabs with different users). You may see one or two 503 responses.
- **Expect:** Response body has `code: 'LOCK_BUSY'` and a message like “Team update is busy. Please try again in a moment.” In the app, the user sees that message; clicking RSVP again succeeds.

### 4. Automated script (create users + concurrent RSVPs)

A Node script signs test users into the **Auth emulator**, then sends **concurrent** `POST /api/rsvp` requests so you can stress the lock and see 200 vs 503 vs TOO_MANY_GKS without opening multiple tabs.

**Prerequisites:** Emulators running, app running (`yarn dev`), and either run with `--seed` once or have already called `POST /api/seed-test-users`.

**Usage:**

```bash
# Seed test users, then 10 concurrent RSVPs (first 10 users)
node scripts/concurrency-test.mjs <matchId> --seed --count 10

# Users 10–19 (offset 10, count 10)
node scripts/concurrency-test.mjs <matchId> --offset=10 --count 10

# Only specific user indices (e.g. 3 GKs: indices 0, 19, 20 → expect 2× 200, 1× 400 TOO_MANY_GKS)
node scripts/concurrency-test.mjs <matchId> --indices=0,19,20 --seed

# Only users with position GK (all 3 GKs from test-users.json)
node scripts/concurrency-test.mjs <matchId> --position=GK --seed
```

**Options:**

| Option             | Meaning                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `--seed`           | Call `POST /api/seed-test-users` first (requires `SEED_SECRET` in `.env.local`). |
| `--count=N`        | Use first N users (default 10). Ignored if `--indices` or `--position` is set.   |
| `--offset=N`       | Start from user index N, then take `count` users (default offset 0).             |
| `--indices=0,5,19` | Use only these comma-separated indices from `test-users.json`.                   |
| `--position=GK`    | Use only users whose `position` equals this (e.g. GK for 2-GK cap test).         |

**Env (from `.env.local`):** `SEED_SECRET` (for `--seed`), `FIREBASE_AUTH_EMULATOR_HOST` (default `127.0.0.1:9099`). App URL defaults to `http://localhost:3001`; override with `CONCURRENCY_TEST_APP_URL` if your app runs elsewhere.

**Output:** Prints how many 200, 503, and 400 (TOO_MANY_GKS) responses, and any other errors. Test users are in `scripts/test-users.json` (same emails/passwords as `lib/testData/testUsers.ts`). There are 21 users including 3 GKs (indices 0, 19, 20) for the GK cap test.
