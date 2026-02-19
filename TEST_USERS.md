# Test users (fake emails & passwords)

Use these to register accounts via the app’s sign-up flow, or seed them programmatically (see below).

| # | Email | Password | Display name | # | Pos |
|---|--------|----------|--------------|---:|-----|
| 1 | alex.rivera@test.soccer | testpass123 | Alex Rivera | 1 | GK |
| 2 | jordan.lee@test.soccer | testpass123 | Jordan Lee | 2 | RB |
| 3 | sam.chen@test.soccer | testpass123 | Sam Chen | 3 | CB |
| 4 | riley.morgan@test.soccer | testpass123 | Riley Morgan | 4 | CB |
| 5 | casey.kim@test.soccer | testpass123 | Casey Kim | 5 | LB |
| 6 | quinn.taylor@test.soccer | testpass123 | Quinn Taylor | 6 | CDM |
| 7 | morgan.james@test.soccer | testpass123 | Morgan James | 7 | CM |
| 8 | drew.patel@test.soccer | testpass123 | Drew Patel | 8 | CM |
| 9 | jesse.wright@test.soccer | testpass123 | Jesse Wright | 9 | CAM |
| 10 | skyler.brooks@test.soccer | testpass123 | Skyler Brooks | 10 | RW |
| 11 | taylor.nguyen@test.soccer | testpass123 | Taylor Nguyen | 11 | LW |
| 12 | cameron.davis@test.soccer | testpass123 | Cameron Davis | 12 | ST |
| 13 | avery.wilson@test.soccer | testpass123 | Avery Wilson | 13 | CF |
| 14 | parker.thomas@test.soccer | testpass123 | Parker Thomas | 14 | RM |
| 15 | reese.martin@test.soccer | testpass123 | Reese Martin | 15 | LM |
| 16 | rowan.jackson@test.soccer | testpass123 | Rowan Jackson | 16 | RWB |
| 17 | logan.white@test.soccer | testpass123 | Logan White | 17 | LWB |
| 18 | hayden.harris@test.soccer | testpass123 | Hayden Harris | 18 | CM |
| 19 | finley.clark@test.soccer | testpass123 | Finley Clark | 19 | CDM |
| 20 | noah.ortiz@test.soccer | testpass123 | Noah Ortiz | 20 | RB |
| 21 | emerson.sanchez@test.soccer | testpass123 | Emerson Sanchez | 21 | LB |
| 22 | micah.bell@test.soccer | testpass123 | Micah Bell | 22 | ST |

**Note:** These are fake addresses (e.g. `@test.soccer`). Use the same password for all to make testing easier.

---

## Seeding users programmatically

You can create all 22 users in Firebase Auth and Firestore in one go:

**Option A – As super admin (from browser or Postman)**  
1. Log in to the app as a super admin.  
2. Send a POST request to `/api/seed-test-users` with your auth token:
   ```bash
   curl -X POST https://your-app.com/api/seed-test-users \
     -H "Authorization: Bearer YOUR_ID_TOKEN"
   ```
   (Get `YOUR_ID_TOKEN` from the browser’s Application tab → Firebase auth token, or from your client after login.)

**Option B – With a secret (for local/scripted use)**  
1. Set `SEED_SECRET` in `.env.local` (e.g. `SEED_SECRET=your-secret-here`).  
2. Call the endpoint with that secret:
   ```bash
   curl -X POST http://localhost:3000/api/seed-test-users \
     -H "X-Seed-Secret: your-secret-here"
   ```

The response lists each email as `created`, `updated` (already in Auth; Firestore doc updated), or `error`.

---

## Seeding RSVPs for a match (fake accounts)

To have all test users RSVP for a specific match in one go:

**Request:** `POST /api/seed-match-rsvps` with JSON body `{ "matchId": "YOUR_MATCH_ID" }`.  
Use the same auth as above (super admin Bearer token **or** `X-Seed-Secret` header).

**Example (with secret):**
```bash
curl -X POST http://localhost:3000/api/seed-match-rsvps \
  -H "Content-Type: application/json" \
  -H "X-Seed-Secret: your-secret-here" \
  -d '{"matchId":"abc123"}'
```

- Requires test users to exist first (run seed-test-users if needed).
- Match must exist. Users that already have a confirmed RSVP for this match are skipped.
- By default, this endpoint **regenerates teams** after seeding so the match reflects the new headcount immediately (e.g. 22 confirmed → 11v11). Disable with `{ "regenerateTeams": false }`.
- Response includes `results` per user and a `summary` (created / exists).
