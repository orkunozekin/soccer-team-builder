# Deployment Guide

## Firestore Security Rules Deployment

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):

   ```bash
   npm install -g firebase-tools
   # or
   yarn global add firebase-tools
   ```

2. **Login to Firebase**:

   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not already done):

   ```bash
   firebase init firestore
   ```

   - Select your Firebase project
   - Use existing `firestore.rules` file (yes)
   - The `firebase.json` config file is already created

4. **Deploy the rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 2: Using Firebase Console (Web Interface)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

### Verify Rules Are Deployed

After deploying, you can verify in Firebase Console:

- Go to Firestore Database → Rules
- You should see your deployed rules
- The timestamp will show when they were last updated

## Firestore Composite Indexes Deployment

**Why this matters:** Client/Admin queries that combine filters and `orderBy` (e.g. `matches` where `clubId == …` orderBy `date`) need a composite index. Adding the definition to `firestore.indexes.json` does **not** create it in production. Shipping the query first yields `FAILED_PRECONDITION` in the browser and broken UX (example: “Could not load matches” after club-scoped matches). Emulators often do not enforce composite indexes, so local success is not enough.

### Deploy indexes (CLI)

```bash
firebase deploy --only firestore:indexes
```

Wait until each new index shows **Enabled** in Firebase Console → Firestore → Indexes before relying on the matching query in production.

### Or create from the error link

If production already failed, the `FAILED_PRECONDITION` response includes a Console URL (`create_composite=…`). Opening it creates the exact index; wait for **Enabled**, then reload.

### PR checklist when changing query shapes

1. Update `firestore.indexes.json` in the same PR as the compound query.
2. Call out the required index deploy / Enabled gate in the PR body.
3. Prefer equality-only + in-memory sort for small lists when resilience matters more than server-side ordering.
4. Keep useful composite indexes; do not remove them solely to avoid deploy steps.

See also [`AGENT_CONTEXT.md`](./AGENT_CONTEXT.md) (Client Firebase) and [`AGENT_LESSONS.md`](./AGENT_LESSONS.md).

## Vercel Deployment

### Environment Variables Setup

When deploying to Vercel, add these environment variables in Vercel Dashboard:

**Firebase Client Config:**

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

**Firebase Admin SDK:**

- `FIREBASE_SERVICE_ACCOUNT_KEY` - Paste the entire JSON content (minified) from your service account file
- OR `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account file (if using file-based approach)

**LaunchDarkly (optional):**

- `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID` - Client-side ID for feature flags (e.g. `pitch-lineup-view`, `club-creation`)
- `LAUNCHDARKLY_SDK_KEY` - Server SDK key for API flag checks (e.g. `POST /api/clubs`); missing key fails closed
- Create boolean flags `pitch-lineup-view` and `club-creation` (default off) in the LD dashboard for production

### Deploy Steps

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically:

- Build your Next.js app
- Deploy it
- Set up automatic deployments on git push

## Important Notes

- **Security Rules**: Must be deployed before your app goes live
- **Environment Variables**: Never commit `.env.local` or service account files
- **Service Account**: Keep it secure - it has admin access to your Firebase project
