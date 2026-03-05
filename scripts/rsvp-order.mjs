#!/usr/bin/env node
/**
 * Print RSVP order for a match (who RSVP'd when).
 * Requires Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS).
 *
 *   node scripts/rsvp-order.mjs <matchId>
 *   npm run rsvp-order -- <matchId>
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import admin from 'firebase-admin'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function loadEnvFile(filename, dir = rootDir) {
  const filePath = join(dir, filename)
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf8')
  content = content.replace(/^\uFEFF/, '')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      let val = m[2].replace(/^["']|["']$/g, '').trim()
      val = val.replace(/\s*#.*$/, '').trim()
      process.env[m[1]] = val
    }
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')
const cwd = process.cwd()
if (cwd !== rootDir) {
  loadEnvFile('.env.local', cwd)
  loadEnvFile('.env', cwd)
}

const matchId = process.argv[2]
if (!matchId) {
  console.error('Usage: node scripts/rsvp-order.mjs <matchId>')
  console.error('   or: npm run rsvp-order -- <matchId>')
  process.exit(1)
}

function timestampToDate(v) {
  if (!v) return null
  if (v.toDate && typeof v.toDate === 'function') return v.toDate()
  if (v instanceof Date) return v
  if (typeof v?.toMillis === 'function') return new Date(v.toMillis())
  return null
}

async function main() {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      admin.initializeApp({ credential: admin.credential.cert(key) })
    } else {
      admin.initializeApp()
    }
  }

  const db = admin.firestore()

  const rsvpsSnap = await db
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  const rows = rsvpsSnap.docs.map((d) => {
    const data = d.data()
    const rsvpAt = timestampToDate(data.rsvpAt)
    return {
      id: d.id,
      userId: data.userId,
      position: data.position ?? null,
      rsvpAt: rsvpAt ? rsvpAt.getTime() : 0,
      rsvpAtDate: rsvpAt,
    }
  })

  rows.sort((a, b) => a.rsvpAt - b.rsvpAt)

  if (rows.length === 0) {
    console.log(`No confirmed RSVPs found for match ${matchId}.`)
    return
  }

  const userIds = [...new Set(rows.map((r) => r.userId))]
  const usersSnap = await db.collection('users').get()
  const displayNameByUid = new Map()
  usersSnap.docs.forEach((d) => {
    const data = d.data()
    const uid = data.uid ?? d.id
    displayNameByUid.set(uid, data.displayName || data.email || uid)
  })

  console.log(`\nRSVP order for match: ${matchId}\n`)
  console.log("#   RSVP'd at (local)     Position   Display name")
  console.log('-'.repeat(65))

  rows.forEach((r, i) => {
    const at = r.rsvpAtDate
      ? r.rsvpAtDate.toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'medium',
        })
      : '—'
    const position = (r.position || '—').slice(0, 10)
    const name = (displayNameByUid.get(r.userId) || r.userId).slice(0, 28)
    console.log(
      `${String(i + 1).padStart(2)}   ${at.padEnd(22)}   ${position.padEnd(10)}   ${name}`
    )
  })

  console.log('-'.repeat(70))
  console.log(`Total: ${rows.length} confirmed RSVP(s)\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
