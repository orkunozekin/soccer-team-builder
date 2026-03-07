import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

type UserSearchRow = {
  uid: string
  email: string
  displayName: string
  role: 'user' | 'admin'
}

function normalizeRole(raw: unknown): UserSearchRow['role'] {
  return typeof raw === 'string' && raw.trim() === 'admin' ? 'admin' : 'user'
}

function uniqByUid(rows: UserSearchRow[]): UserSearchRow[] {
  const seen = new Set<string>()
  const out: UserSearchRow[] = []
  for (const r of rows) {
    if (!r.uid || seen.has(r.uid)) continue
    seen.add(r.uid)
    out.push(r)
  }
  return out
}

export async function GET(request: NextRequest) {
  const { uid, isAdmin, error: authError } = await verifyAdmin(request)
  if (authError || !uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
  }

  const adminDb = getAdminDb()
  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const qRaw = (searchParams.get('q') ?? '').trim()
  const limitRaw = Number(searchParams.get('limit') ?? '25')
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 25

  if (!qRaw) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }

  // Firestore doesn't support substring search; use prefix search on indexed fields.
  // Prefer lowercased fields when present (emailLower/displayNameLower), and also try
  // raw fields as a fallback for older records.
  const qLower = qRaw.toLowerCase()
  const endLower = `${qLower}\uf8ff`
  const endRaw = `${qRaw}\uf8ff`

  const usersCol = adminDb.collection('users')
  const [byEmailLower, byNameLower, byEmailRaw, byNameRaw] = await Promise.all([
    usersCol
      .orderBy('emailLower')
      .startAt(qLower)
      .endAt(endLower)
      .limit(limit)
      .get()
      .catch(() => null),
    usersCol
      .orderBy('displayNameLower')
      .startAt(qLower)
      .endAt(endLower)
      .limit(limit)
      .get()
      .catch(() => null),
    usersCol
      .orderBy('email')
      .startAt(qLower)
      .endAt(`${qLower}\uf8ff`)
      .limit(limit)
      .get()
      .catch(() => null),
    usersCol
      .orderBy('displayName')
      .startAt(qRaw)
      .endAt(endRaw)
      .limit(limit)
      .get()
      .catch(() => null),
  ])

  const rows: UserSearchRow[] = []
  for (const snap of [byEmailLower, byNameLower, byEmailRaw, byNameRaw]) {
    if (!snap) continue
    for (const d of snap.docs) {
      const data = d.data()
      rows.push({
        uid: (data.uid as string) ?? d.id,
        email: (data.email as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        role: normalizeRole(data.role),
      })
    }
  }

  const unique = uniqByUid(rows)

  // Consistent ordering for UI.
  unique.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email))

  return NextResponse.json({
    success: true,
    users: unique.slice(0, limit),
  })
}

