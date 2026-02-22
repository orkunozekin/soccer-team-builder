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

| Question | Answer |
|----------|--------|
| Will users see their RSVP reflected in a team immediately? | **Yes** — as soon as their request completes (RSVP written + one serialized regeneration that includes them). |
| Do they have to wait for everyone to finish RSVPing? | **No** — they only wait for their own request and, if the lock is held, for one other regeneration to finish. |
| Extra delay under load? | In a burst (e.g. 30 at once), some users may wait an extra 1–2 seconds while the per-match lock is held. |

---

## Implementation checklist

- [ ] Add per-match locking (in-memory or Firestore) around `expandTeamsForMatch`.
- [ ] Ensure RSVP route acquires lock after writing RSVP, runs `expandTeamsForMatch`, then releases lock.
- [ ] (Optional) Move GK count + RSVP write into a Firestore transaction in `app/api/rsvp/route.ts` for atomic GK cap.
- [ ] (Optional) Add a short retry/backoff if lock cannot be acquired (e.g. 2–3 retries with 500 ms delay).

---

## Files to touch

- `app/api/rsvp/route.ts` — Acquire/release lock around `expandTeamsForMatch`; optionally use transaction for GK + RSVP write.
- `lib/teams/expandTeamsForMatch.ts` — Either keep as-is and wrap at call site, or integrate lock inside (if lock lives in a shared util).
- New (if using Firestore lock): e.g. `lib/locks/matchLock.ts` or `lib/teams/matchTeamRegenerationLock.ts` — acquire/release per `matchId`.
