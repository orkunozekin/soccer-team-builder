# Local development with Firebase Emulators

To develop against a **local** Auth and Firestore database instead of production:

## 1. Prerequisites

**Java (required for the Firestore emulator)**  
The Firebase emulators need Java on your machine. If you see `Could not spawn java -version`:

- **Windows (PowerShell/CMD):** Install a JDK, then add the JDK’s `bin` folder to your system **PATH** (e.g. `C:\Program Files\Java\jdk-25.0.2\bin`). Restart your terminal and run `java -version` to confirm.
- **Windows (Git Bash):** If `java` works in PowerShell but not in Git Bash, add Java to Bash’s PATH. In your home directory, edit (or create) `~/.bashrc` and add:
  ```bash
  export JAVA_HOME="/c/Program Files/Java/jdk-25.0.2"
  export PATH="$JAVA_HOME/bin:$PATH"
  ```
  Save, then run `source ~/.bashrc` or open a new bash terminal. Run `java -version` to confirm.
- **macOS:** `brew install openjdk@17` (or use a JDK installer), then ensure `java` is on your PATH.
- **Linux:** Install the `openjdk-17-jdk` (or similar) package and ensure `java` is on your PATH.

**Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
```

## 2. Start the emulators

In a terminal, from the project root:

```bash
firebase emulators:start --only auth,firestore
```

**Match the project ID:** The app uses `NEXT_PUBLIC_FIREBASE_PROJECT_ID` from `.env.local`. The Emulator UI shows data for the Firebase CLI project. If they differ, the Data tab stays empty. Run `firebase use YOUR_PROJECT_ID` (same as in `.env.local`) or add `--project YOUR_PROJECT_ID` to the command above, then start the emulators.

Leave this running. You’ll get:

- **Auth emulator** – http://127.0.0.1:9099
- **Firestore emulator** – http://127.0.0.1:8080
- **Emulator UI** – http://127.0.0.1:4000 (inspect data and users)

## 3. Point the app at the emulators

In **`.env.local`** add (or uncomment):

```env
# Use Firebase emulators (local Auth + Firestore). Remove or set to false for production.
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` – makes the **client** (browser) use the Auth and Firestore emulators.
- `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` – make the **server** (API routes / Firebase Admin) use the emulators.

## 4. Run the app

In another terminal:

```bash
yarn dev
```

The app will use the local emulators. Data and users stay on your machine and are wiped when you stop the emulators (unless you export/import; see Firebase docs).

## 5. When you’re done with local-only DB

- Stop the emulators (Ctrl+C in that terminal).
- In `.env.local` set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` or remove the three emulator variables.
- Restart `yarn dev` to use production Firebase again.

## Notes

- Emulator data is in-memory by default. Restarting the emulators clears it.
- You can seed test users and match RSVPs via your app’s seed endpoints; they’ll hit the emulators when the env vars above are set.
- Never set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` or the emulator host vars in production.

## Troubleshooting: User in Auth emulator but not in Firestore

When you sign up locally, the app creates the Auth user first, then creates a Firestore document at `users/{uid}` in the same flow. If you see the user in the **Auth** emulator but not under **Firestore → Data**:

1. **"Received a signed JWT" in emulator logs** – This means the app sent a **production** auth token to the emulator (e.g. from a previous sign-in before the emulator was enabled). The emulator doesn't validate that token, so Firestore treats the request as unauthenticated and rejects the write. **Fix:** The app shows a brief “Preparing local emulator…” screen and clears any old session before loading. Then sign up or sign in again; the new token will be from the Auth emulator and the user document will be created in Firestore. If you still see the JWT message, clear site data for localhost and reload.
2. **Restart the dev server** after changing `.env.local`. `NEXT_PUBLIC_*` is baked in at build time, so set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`, save, then run `yarn dev` again.
3. **Check the browser console** (F12 → Console). If the Firestore write fails, you’ll see an error like “Failed to create user document in Firestore” or “Error fetching user data” with the underlying reason (e.g. permission denied, or network/emulator not reachable).
4. **Confirm emulators are running** – `firebase emulators:start --only auth,firestore` – and that the app’s Firestore port is **8080** (see `lib/firebase/config.ts`).
