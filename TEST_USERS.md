# Test users (fake emails & passwords)

Use these to register accounts via the app’s sign-up flow, or seed them programmatically (see below).

| # | Email | Password |
|---|--------|----------|
| 1 | alex.rivera@test.soccer | testpass123 |
| 2 | jordan.lee@test.soccer | testpass123 |
| 3 | sam.chen@test.soccer | testpass123 |
| 4 | riley.morgan@test.soccer | testpass123 |
| 5 | casey.kim@test.soccer | testpass123 |
| 6 | quinn.taylor@test.soccer | testpass123 |
| 7 | morgan.james@test.soccer | testpass123 |
| 8 | drew.patel@test.soccer | testpass123 |
| 9 | jesse.wright@test.soccer | testpass123 |
| 10 | skyler.brooks@test.soccer | testpass123 |

**Note:** These are fake addresses (e.g. `@test.soccer`). Use the same password for all to make testing easier.

---

## Seeding users programmatically

You can create all 10 users in Firebase Auth and Firestore in one go:

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

The response lists each email as `created`, `exists` (already in Auth), or `error`. Existing users are skipped without failing the request.

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
- Response includes `results` per user and a `summary` (created / exists).
