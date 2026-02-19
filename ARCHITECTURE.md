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
- API routes verify authentication tokens
- Firestore security rules enforce authorization
- Business logic is hidden on the server

**Production Recommendations:**
1. Install Firebase Admin SDK: `npm install firebase-admin`
2. Use Admin SDK in API routes to verify tokens server-side
3. Verify admin roles server-side before allowing operations
4. Add rate limiting to API routes

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
