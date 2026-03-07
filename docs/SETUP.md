# Setup Instructions

## Environment Variables

You need to create a `.env.local` file in the project root with your Firebase configuration.

### Step 1: Create `.env.local` file

Create a new file named `.env.local` in the project root (same directory as `package.json`).

### Step 2: Add Firebase Client Configuration

Get these values from Firebase Console → Project Settings → General → Your apps:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 3: Add Firebase Admin SDK Configuration

You already have `firebase-service-account.json` in your project root. Add this line to `.env.local`:

```env
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

### Complete `.env.local` Example

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soccerville.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soccerville
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soccerville.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK Configuration
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

**Note:** Replace the placeholder values with your actual Firebase project values.

## Quick Start

1. Copy `.env.local.example` to `.env.local` (or create it manually)
2. Fill in your Firebase client configuration values
3. The Admin SDK is already configured since you have `firebase-service-account.json`
4. Run `yarn dev` to start the development server

## Security Notes

- `.env.local` is in `.gitignore` - it will never be committed to git
- `firebase-service-account.json` is also in `.gitignore` - keep it secure!
- Never share these files or commit them to version control
