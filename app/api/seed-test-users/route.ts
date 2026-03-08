import { Timestamp } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'
import { TEST_USERS } from '@/lib/testData/testUsers'

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function requireSeedAuth(
  request: Request
): Promise<
  | { ok: true; currentUid?: string }
  | { ok: false; status: number; body: object }
> {
  const seedSecret = request.headers.get('x-seed-secret')
  const useSecret =
    process.env.SEED_SECRET && seedSecret === process.env.SEED_SECRET
  if (useSecret) return { ok: true }
  const { uid, isAdmin, error } = await verifyAdmin(request)
  if (error || !isAdmin) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Admin required or valid X-Seed-Secret' },
    }
  }
  return { ok: true, currentUid: uid ?? undefined }
}

/**
 * POST /api/seed-test-users
 * Creates the test users in Firebase Auth and Firestore.
 * Requires: admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  const auth = await requireSeedAuth(request)
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status })
  }

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  const results: {
    email: string
    status: 'created' | 'updated' | 'error'
    message?: string
  }[] = []

  for (const user of TEST_USERS) {
    try {
      let created = true
      let record = await adminAuth
        .createUser({
          email: user.email,
          password: user.password,
          displayName: user.displayName,
        })
        .catch(async (err: unknown) => {
          const code = (err as { code?: string })?.code
          const message = err instanceof Error ? err.message : String(err)
          if (
            code === 'auth/email-already-exists' ||
            String(message).includes('already exists')
          ) {
            created = false
            return await adminAuth.getUserByEmail(user.email)
          }
          throw err
        })

      // Ensure Auth displayName matches seed data
      if (record.displayName !== user.displayName) {
        record = await adminAuth.updateUser(record.uid, {
          displayName: user.displayName,
        })
      }

      const now = Timestamp.now()
      const userRef = adminDb.collection('users').doc(record.uid)
      const existing = await userRef.get()
      await userRef.set(
        {
          uid: record.uid,
          email: user.email,
          emailLower: user.email.toLowerCase(),
          displayName: user.displayName,
          displayNameLower: user.displayName.toLowerCase(),
          jerseyNumber: user.jerseyNumber,
          position: user.position,
          role: 'user',
          isTestUser: true,
          createdAt: existing.exists
            ? (existing.data()?.createdAt ?? now)
            : now,
          updatedAt: now,
        },
        { merge: true }
      )

      results.push({
        email: user.email,
        status: created ? 'created' : 'updated',
      })
    } catch (err: unknown) {
      results.push({
        email: user.email,
        status: 'error',
        message: sanitizeErrorForClient(err, 'Failed to create or update user'),
      })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      error: results.filter(r => r.status === 'error').length,
    },
  })
}

/**
 * DELETE /api/seed-test-users
 * Deletes all test users (from the TEST_USERS list) and their RSVP records.
 * Also removes them from any match teams and deletes their Firestore user docs.
 * Requires: admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function DELETE(request: Request) {
  const auth = await requireSeedAuth(request)
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status })
  }

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  const results: {
    email: string
    status: 'deleted' | 'skipped' | 'error'
    message?: string
  }[] = []
  const currentUid = auth.currentUid

  for (const user of TEST_USERS) {
    try {
      const record = await adminAuth
        .getUserByEmail(user.email)
        .catch(() => null)
      if (!record) {
        results.push({ email: user.email, status: 'skipped' })
        continue
      }
      const userId = record.uid
      if (currentUid && userId === currentUid) {
        results.push({
          email: user.email,
          status: 'skipped',
          message: 'Cannot delete current user',
        })
        continue
      }

      // 1) Remove from all match teams
      const matchesSnap = await adminDb.collection('matches').get()
      for (const matchDoc of matchesSnap.docs) {
        await removeUserFromMatchTeams(adminDb, matchDoc.id, userId)
      }

      // 2) Delete user doc
      await adminDb
        .collection('users')
        .doc(userId)
        .delete()
        .catch(() => {})

      // 3) Delete all RSVPs for this user
      const rsvpSnap = await adminDb
        .collection('rsvps')
        .where('userId', '==', userId)
        .get()
      for (const batchDocs of chunk(rsvpSnap.docs, 450)) {
        const batch = adminDb.batch()
        batchDocs.forEach(d => batch.delete(d.ref))
        await batch.commit()
      }

      // 4) Delete Firebase Auth user
      await adminAuth.deleteUser(userId).catch(() => {})

      results.push({ email: user.email, status: 'deleted' })
    } catch (err: unknown) {
      results.push({
        email: user.email,
        status: 'error',
        message: sanitizeErrorForClient(err, 'Failed to delete user'),
      })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      deleted: results.filter(r => r.status === 'deleted').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
    },
  })
}
