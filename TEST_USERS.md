# Test users (fake emails & passwords)

Use the users at lib\testData\testUsers.ts\ to register accounts via the app’s sign-up flow, or seed them programmatically (see below).

**Note:** These are fake addresses (e.g. `@test.soccer`). Use the same password for all to make testing easier.

---

## Seeding users programmatically

You can create all 22 users in Firebase Auth and Firestore in one go:

**Option A – As admin (from browser or Postman)**  
1. Log in to the app as an admin.  
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
   curl -X POST http://localhost:3001/api/seed-test-users \
     -H "X-Seed-Secret: your-secret-here"
   ```

The response lists each email as `created`, `updated` (already in Auth; Firestore doc updated), or `error`.

---

## Seeding RSVPs for a match (fake accounts)

To have all test users RSVP for a specific match in one go:

**Request:** `POST /api/seed-match-rsvps` with JSON body `{ "matchId": "YOUR_MATCH_ID" }`.  
Use the same auth as above (admin Bearer token **or** `X-Seed-Secret` header).

**Example (with secret):**
```bash
curl -X POST http://localhost:3001/api/seed-match-rsvps \
  -H "Content-Type: application/json" \
  -H "X-Seed-Secret: your-secret-here" \
  -d '{"matchId":"abc123"}'
```

- Requires test users to exist first (run seed-test-users if needed).
- Match must exist. Users that already have a confirmed RSVP for this match are skipped.
- By default, this endpoint **regenerates teams** after seeding so the match reflects the new headcount immediately (e.g. 22 confirmed → 11v11). Disable with `{ "regenerateTeams": false }`.
- Response includes `results` per user and a `summary` (created / exists).

---

## Deleting test users and their RSVP records

To remove all test users (from the table above) and their data in one go:

**Request:** `DELETE /api/seed-test-users` with the same auth as seeding (admin Bearer token **or** `X-Seed-Secret` header).

**Example (with secret):**
```bash
curl -X DELETE http://localhost:3001/api/seed-test-users \
  -H "X-Seed-Secret: your-secret-here"
```

**Example (as admin with Bearer token):**
```bash
curl -X DELETE https://your-app.com/api/seed-test-users \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

- Deletes each test user from **Firebase Auth** (by email lookup).
- Removes them from **all match teams** (and backfills where applicable).
- Deletes their **Firestore user** document.
- Deletes **all RSVP records** for that user.
- If you call as an admin (Bearer token), the current admin user is never deleted (skipped).
- Users that don’t exist in Auth are skipped (`skipped` in results).
- Response includes `results` per email (`deleted` / `skipped` / `error`) and a `summary`.
