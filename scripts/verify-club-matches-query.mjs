/**
 * Emulator check for the club match list hotfix.
 *
 * Proves a signed-in club member can run the equality-only `clubId` query
 * (what `getMatchesForClub` uses after the hotfix) and cannot read another
 * club's match by id under Firestore rules.
 *
 * Usage (emulators must be running from repo root):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   node scripts/verify-club-matches-query.mjs
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'
import { initializeApp as initClient } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth as getClientAuth,
  signInWithCustomToken,
} from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore as getClientFirestore,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore/lite'

const PROJECT = 'soccerville'
const CLUB_A = 'club-a'
const CLUB_B = 'club-b'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

initializeApp({ projectId: PROJECT })
const adminAuth = getAdminAuth()
const adminDb = getAdminFirestore()

const clientApp = initClient({
  apiKey: 'demo',
  projectId: PROJECT,
  appId: 'demo',
})
const clientAuth = getClientAuth(clientApp)
const clientDb = getClientFirestore(clientApp)
connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', {
  disableWarnings: true,
})
connectFirestoreEmulator(clientDb, '127.0.0.1', 8080)

async function seed() {
  // Idempotent-ish: overwrite known docs.
  const uid = 'player-1'
  try {
    await adminAuth.createUser({
      uid,
      email: 'player1@example.com',
      password: 'password123',
    })
  } catch {
    // already exists from a prior run
  }

  await adminDb.collection('users').doc(uid).set({
    email: 'player1@example.com',
    role: 'user',
    activeClubId: CLUB_A,
  })

  await adminDb
    .collection('clubMemberships')
    .doc(`${CLUB_A}_${uid}`)
    .set({
      clubId: CLUB_A,
      userId: uid,
      role: 'player',
      status: 'active',
    })

  const now = Date.now()
  await adminDb.collection('matches').doc('m-a-1').set({
    clubId: CLUB_A,
    date: new Date(now + 86400000),
    time: '19:00',
    deletedAt: null,
  })
  await adminDb.collection('matches').doc('m-a-2').set({
    clubId: CLUB_A,
    date: new Date(now + 2 * 86400000),
    time: '18:00',
    deletedAt: null,
  })
  await adminDb.collection('matches').doc('m-b-1').set({
    clubId: CLUB_B,
    date: new Date(now + 86400000),
    time: '20:00',
    deletedAt: null,
  })

  return uid
}

async function asMember(uid) {
  const token = await adminAuth.createCustomToken(uid)
  await signInWithCustomToken(clientAuth, token)
}

function logResult(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

async function main() {
  console.log('Seeding emulator data…')
  const uid = await seed()
  await asMember(uid)

  let passed = true

  // Hotfix query shape: equality-only clubId (no orderBy / no composite index).
  try {
    const snap = await getDocs(
      query(collection(clientDb, 'matches'), where('clubId', '==', CLUB_A))
    )
    const ids = snap.docs.map(d => d.id).sort()
    passed =
      logResult(
        'equality-only clubId query returns only club A matches',
        ids.join(',') === 'm-a-1,m-a-2',
        `got [${ids.join(', ')}]`
      ) && passed
  } catch (err) {
    passed =
      logResult('equality-only clubId query', false, String(err?.code || err)) &&
      passed
  }

  // Same club + orderBy works in the emulator (indexes not enforced). In
  // production this shape needs the clubId+date composite index — which is why
  // the hotfix dropped orderBy.
  try {
    const snap = await getDocs(
      query(
        collection(clientDb, 'matches'),
        where('clubId', '==', CLUB_A),
        orderBy('date', 'asc')
      )
    )
    logResult(
      'clubId+orderBy(date) runs in emulator (prod needs composite index)',
      true,
      `${snap.size} docs`
    )
  } catch (err) {
    logResult(
      'clubId+orderBy(date) unexpected emulator failure',
      false,
      String(err?.code || err)
    )
    passed = false
  }

  // Rules: member can read own club match.
  try {
    const snap = await getDoc(doc(clientDb, 'matches', 'm-a-1'))
    passed =
      logResult('member can getDoc own-club match', snap.exists()) && passed
  } catch (err) {
    passed =
      logResult('member can getDoc own-club match', false, String(err?.code || err)) &&
      passed
  }

  // Rules: member cannot read another club's match by id.
  try {
    await getDoc(doc(clientDb, 'matches', 'm-b-1'))
    passed =
      logResult(
        'member getDoc other-club match should be denied',
        false,
        'unexpectedly succeeded'
      ) && passed
  } catch (err) {
    const denied = String(err?.code || '').includes('permission-denied')
    passed =
      logResult(
        'member getDoc other-club match denied',
        denied,
        String(err?.code || err)
      ) && passed
  }

  if (!passed) {
    console.error('\nVerification failed.')
    process.exit(1)
  }
  console.log(
    '\nVerification passed: equality-only club query is rules-safe for members.'
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
