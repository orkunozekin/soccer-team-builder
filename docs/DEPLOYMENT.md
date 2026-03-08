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
