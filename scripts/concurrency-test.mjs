#!/usr/bin/env node
/**
 * Automated concurrency test: sign in test users (Auth emulator), then fire
 * concurrent POST /api/rsvp so you can verify lock + GK cap without manual tabs.
 *
 * Prerequisites:
 *   - Emulators running: firebase emulators:start --only auth,firestore
 *   - App running: yarn dev
 *   - Test users exist: run with --seed first, or POST /api/seed-test-users
 *
 * Usage:
 *   node scripts/concurrency-test.mjs <matchId> [--seed] [--count=N] [--offset=N] [--indices=0,5,19] [--position=GK]
 *
 * Examples:
 *   node scripts/concurrency-test.mjs abc123 --seed --count 10
 *   node scripts/concurrency-test.mjs abc123 --offset 10 --count 5
 *   node scripts/concurrency-test.mjs abc123 --indices 0,19,20
 *   node scripts/concurrency-test.mjs abc123 --position GK --seed
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Load .env.local into process.env (simple parser)
try {
  const envPath = join(rootDir, '.env.local')
  const content = readFileSync(envPath, 'utf8')
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line
      .replace(/^export\s+/i, '')
      .match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) {
      const val = m[2].replace(/^["']|["']$/g, '').trim()
      process.env[m[1]] = val
    }
  }
} catch {
  // .env.local optional
}

const AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const AUTH_EMULATOR_URL = `http://${AUTH_EMULATOR_HOST}`
const API_BASE =
  process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL}`
    : process.env.CONCURRENCY_TEST_APP_URL || 'http://localhost:3001'
const SEED_SECRET = process.env.SEED_SECRET

async function signInWithPassword(email, password) {
  const url = `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${t}`)
  }
  const data = await res.json()
  return data.idToken
}

async function seedTestUsers() {
  if (!SEED_SECRET) {
    const envPath = join(rootDir, '.env.local')
    console.error('--seed requires SEED_SECRET in .env.local.')
    console.error('  Add a line: SEED_SECRET=your-secret')
    console.error(
      '  (no spaces around =, file must be at project root: ' + envPath + ')'
    )
    console.error('Or seed manually:')
    console.error(
      `  curl -X POST ${API_BASE}/api/seed-test-users -H "X-Seed-Secret: your-secret"`
    )
    process.exit(1)
  }
  const res = await fetch(`${API_BASE}/api/seed-test-users`, {
    method: 'POST',
    headers: { 'X-Seed-Secret': SEED_SECRET },
  })
  if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`)
  console.log('Seeded test users.')
}

function parseArg(args, name, defaultValue) {
  const a = args.find(x => x.startsWith('--' + name + '='))
  return a ? a.split('=')[1] : defaultValue
}

async function main() {
  const args = process.argv.slice(2)
  const matchId = args.find(a => !a.startsWith('--'))
  const doSeed = args.includes('--seed')
  const count = parseInt(parseArg(args, 'count', '10'), 10)
  const offset = parseInt(parseArg(args, 'offset', '0'), 10)
  const indicesStr = parseArg(args, 'indices', null)
  const positionFilter = parseArg(args, 'position', null)

  if (!matchId) {
    console.error(
      'Usage: node scripts/concurrency-test.mjs <matchId> [--seed] [--count=N] [--offset=N] [--indices=0,5,19] [--position=GK]'
    )
    process.exit(1)
  }

  const usersPath = join(__dirname, 'test-users.json')
  const users = JSON.parse(readFileSync(usersPath, 'utf8'))

  let subset
  if (indicesStr) {
    const indices = indicesStr.split(',').map(s => parseInt(s.trim(), 10))
    subset = indices.map(i => users[i]).filter(Boolean)
    if (subset.length !== indices.length) {
      console.error(
        'Invalid --indices: some indices out of range (max ' +
          (users.length - 1) +
          ')'
      )
      process.exit(1)
    }
  } else if (positionFilter) {
    const pos = positionFilter.toUpperCase().trim()
    subset = users.filter(u => (u.position || '').toUpperCase().trim() === pos)
    if (subset.length === 0) {
      console.error(
        'No users with position "' + positionFilter + '" in test-users.json'
      )
      process.exit(1)
    }
  } else {
    subset = users.slice(offset, offset + count)
  }

  console.log(`Auth emulator: ${AUTH_EMULATOR_URL}`)
  console.log(`API base: ${API_BASE}`)
  console.log(`Match ID: ${matchId}, users: ${subset.length}`)
  if (doSeed) await seedTestUsers()

  // Get id tokens (sequential so we don't hammer the emulator)
  console.log('Signing in test users...')
  const tokens = []
  for (const u of subset) {
    try {
      const token = await signInWithPassword(u.email, u.password)
      tokens.push({ email: u.email, position: u.position, token })
    } catch (e) {
      console.error(e.message)
      console.error(
        'Ensure test users exist (run with --seed or POST /api/seed-test-users).'
      )
      process.exit(1)
    }
  }

  // Fire concurrent RSVPs
  console.log(`Sending ${tokens.length} concurrent POST /api/rsvp...`)
  const start = Date.now()
  const results = await Promise.all(
    tokens.map(async ({ email, token }) => {
      const res = await fetch(`${API_BASE}/api/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId }),
      })
      const body = await res.json().catch(() => ({}))
      return { email, status: res.status, body }
    })
  )
  const elapsed = Date.now() - start

  // Summary
  const ok = results.filter(r => r.status === 200).length
  const busy = results.filter(r => r.status === 503).length
  const tooManyGks = results.filter(
    r => r.status === 400 && r.body?.code === 'TOO_MANY_GKS'
  ).length
  const other = results.filter(
    r =>
      r.status !== 200 &&
      r.status !== 503 &&
      (r.status !== 400 || r.body?.code !== 'TOO_MANY_GKS')
  )

  console.log(`\nDone in ${elapsed}ms`)
  console.log(
    `  200: ${ok}, 503 (lock busy): ${busy}, 400 (TOO_MANY_GKS): ${tooManyGks}, other: ${other.length}`
  )
  if (other.length) {
    other.forEach(r =>
      console.log(`  ${r.email}: ${r.status}`, r.body?.error || r.body)
    )
  }
  if (busy)
    console.log(
      '\nTip: 503 means lock was held; retrying those requests would succeed.'
    )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
