# Architecture Overview

## API Layer Implementation

We've implemented a **hybrid architecture** that balances security, performance, and maintainability.

### Architecture Pattern

```
UI Components → API Client → Next.js API Routes → Firebase Services → Firebase
```

### What Goes Through API Routes (Server-Side)

**Complex Business Logic:**

- ✅ Team generation algorithm (`/api/teams/generate`)
- ✅ Player transfers with validation (`/api/teams/transfer`)
- ✅ Match creation with validation (`/api/matches`)
- ✅ Admin player ratings, 1–10 (`/api/clubs/[clubId]/skill-ranking`); skills questionnaire API kept but switched off in the UI (`/api/users/me/skill-assessment`); see [Private skill data](#private-skill-data)

**Why:** These operations contain business logic that shouldn't be exposed to clients:

- Team generation algorithm (prioritization rules)
- Validation logic (team size limits, goalkeeper rules)
- Data integrity checks

### What Stays Client-Side (Direct Firebase)

**Simple CRUD Operations:**

- ✅ Reading matches, teams, RSVPs
- ✅ User profile updates
- ✅ RSVP creation/cancellation
- ✅ Real-time data fetching

**Why:** These are simple operations that benefit from:

- Lower latency (direct client-to-Firebase)
- Real-time updates via Firestore listeners
- Reduced server load

### Security

**Current Implementation:**

- ✅ Firebase Admin SDK installed and configured
- ✅ API routes verify authentication tokens using Admin SDK
- ✅ Admin role verification on server-side
- ✅ Firestore security rules enforce authorization
- ✅ Business logic is hidden on the server

**Setup Instructions:**

1. **Get Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Configure for Development:**
   - Option A: Save JSON as `firebase-service-account.json` in project root
     - Set `GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json` in `.env.local`
   - Option B: Paste JSON content into `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY` (minified)

3. **Configure for Production:**
   - Use environment variables in your hosting platform
   - Set `FIREBASE_SERVICE_ACCOUNT_KEY` with the JSON content
   - Or use `GOOGLE_APPLICATION_CREDENTIALS` pointing to the file path

**Note:** The service account file is in `.gitignore` - never commit it!

### API Routes

- `POST /api/teams/generate` - Generate teams for a match
- `POST /api/teams/transfer` - Transfer player between teams/bench
- `POST /api/matches` - Create a new match
- `POST /api/teams/rebalance` - Club admins: rebalance a match's teams. With the `skill-balanced-teams` flag on (evaluated server-side), the response adds `strength: { teams: [{ teamNumber, total, average, size }], unratedCount, playerCount }`
- `GET/PUT /api/users/me/skill-assessment` - Signed-in player: read/save their own skills questionnaire (`verifyAuth`; flag off → 403). Not used by the UI while the questionnaire is off
- `GET/PATCH /api/clubs/[clubId]/skill-ranking` - Club admins (`verifyClubAdmin`): read the club's 1–10 ratings plus active members; save `{ changes: { [uid]: 1–10 | null } }` (only changed players; `null` clears; ratings for active members only), merged in a transaction so the later save wins per player; flag off → 403. Used by the roster page board and the match page Rate players sheet

### Private skill data

Behind the `skill-balanced-teams` flag. Both collections are **API / Admin SDK only**: `firestore.rules` denies all client reads and writes, and skill data never goes on `users` or `clubMemberships` (both are readable by other players). Lookups are by doc id, so no composite indexes.

| Collection / doc             | Contents                                                                                   | Who can reach it (via API)                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `clubSkillRankings/{clubId}` | `ratings` (uid → whole number 1–10; absent = unrated), `version`, `updatedBy`, `updatedAt` | Club admins of that club; saves are version-checked in a transaction     |
| `skillAssessments/{userId}`  | Questionnaire `answers` (four 1–3 values), `updatedAt`                                     | The player; admins of a club the player actively belongs to (as a score) |

Club admins rate players on `/c/[slug]/roster` (`SkillRankingBoard`, "Player ratings"). The rebalance route scores each player by their admin rating, else 5.5; the questionnaire collection is not read while the questionnaire is off.

### Benefits

1. **Security**: Business logic hidden from client
2. **Validation**: Server-side validation prevents tampering
3. **Maintainability**: Logic changes don't require client updates
4. **Performance**: Simple operations stay fast (client-side)
5. **Scalability**: Complex operations can be optimized server-side
