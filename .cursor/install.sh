#!/usr/bin/env bash
# Idempotent install script for the Soccerville Cloud Agent environment.
# Prepares JS dependencies, the Firebase CLI, emulator binaries, and a local
# emulator-only env file. Safe to run repeatedly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> Ensuring a Java runtime is available (required by the Firestore emulator)"
if ! command -v java >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends openjdk-21-jre-headless
fi

echo "==> Installing JS dependencies (yarn, frozen lockfile)"
yarn install --frozen-lockfile

echo "==> Ensuring the Firebase CLI is installed"
if ! command -v firebase >/dev/null 2>&1; then
  sudo env "PATH=$PATH" npm install -g firebase-tools
fi

echo "==> Pre-downloading Firebase emulator binaries"
firebase setup:emulators:firestore || true
firebase setup:emulators:ui || true

echo "==> Creating .env.local for emulator-based local development (only if absent)"
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Local development config — uses Firebase emulators only (no production access).
# Values below are placeholders; the Auth/Firestore emulators do not validate them.

NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soccerville.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soccerville
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soccerville.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demolocal

NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
EOF
fi

echo "==> Install complete"
