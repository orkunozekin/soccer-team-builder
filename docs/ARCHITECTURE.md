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

### Benefits

1. **Security**: Business logic hidden from client
2. **Validation**: Server-side validation prevents tampering
3. **Maintainability**: Logic changes don't require client updates
4. **Performance**: Simple operations stay fast (client-side)
5. **Scalability**: Complex operations can be optimized server-side
