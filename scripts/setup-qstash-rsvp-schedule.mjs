#!/usr/bin/env node
/**
 * Create QStash schedules for RSVP open (9am CT) and close (10pm CT).
 * Run once after deploying. Requires QSTASH_TOKEN and BASE_URL in env or .env.local.
 *
 *   BASE_URL=https://your-app.vercel.app QSTASH_TOKEN=... node scripts/setup-qstash-rsvp-schedule.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Load .env.local or .env into process.env from the given directory
function loadEnvFile(filename, dir = rootDir) {
  const filePath = join(dir, filename)
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf8')
  content = content.replace(/^\uFEFF/, '') // strip BOM
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      let val = m[2].replace(/^["']|["']$/g, '').trim()
      val = val.replace(/\s*#.*$/, '').trim() // strip inline comment
      process.env[m[1]] = val
    }
  }
}
// Load from project root (relative to script) then from cwd (where npm run was executed)
loadEnvFile('.env.local')
loadEnvFile('.env')
const cwd = process.cwd()
if (cwd !== rootDir) {
  loadEnvFile('.env.local', cwd)
  loadEnvFile('.env', cwd)
}

const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const BASE_URL = (process.env.BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  process.env.NEXT_PUBLIC_APP_URL ||
  '').replace(/\/$/, '')

if (!QSTASH_TOKEN) {
  const envLocal = join(rootDir, '.env.local')
  const env = join(rootDir, '.env')
  console.error('Missing QSTASH_TOKEN.')
  console.error('  Set it in .env.local or .env at project root, or pass as env var:')
  console.error('  QSTASH_TOKEN=your_token npm run setup:qstash-rsvp')
  console.error('  Files checked:', existsSync(envLocal) ? envLocal : '(no .env.local)', existsSync(env) ? env : '(no .env)')
  process.exit(1)
}
if (!BASE_URL || !BASE_URL.startsWith('http')) {
  const envLocalPath = join(rootDir, '.env.local')
  console.error('Missing BASE_URL (e.g. https://your-app.vercel.app). Set it in .env.local or pass as env var.')
  console.error('  .env.local path:', envLocalPath)
  console.error('  If that path is wrong, run from project root or set BASE_URL=... in the shell.')
  process.exit(1)
}

const DESTINATION = `${BASE_URL}/api/cron/rsvp-schedule`

// QStash region: we use US East 1. Override with QSTASH_API_URL if needed (e.g. https://qstash.upstash.io for EU).
const QSTASH_API = (process.env.QSTASH_API_URL || 'https://qstash-us-east-1.upstash.io').replace(/\/$/, '')

// 9am CT and 10pm CT in America/Chicago (handles DST)
const CRON_OPEN = 'CRON_TZ=America/Chicago 0 9 * * *'
const CRON_CLOSE = 'CRON_TZ=America/Chicago 0 22 * * *'

async function createSchedule(scheduleId, cron) {
  // Destination in path unencoded, per Upstash docs: .../v2/schedules/https://example.com
  const url = `${QSTASH_API}/v2/schedules/${DESTINATION}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Cron': cron,
      ...(scheduleId ? { 'Upstash-Schedule-Id': scheduleId } : {}),
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QStash API ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  console.log('Creating QStash schedules for RSVP open/close...')
  console.log('Destination:', DESTINATION)

  const openResult = await createSchedule('rsvp-schedule-open', CRON_OPEN)
  console.log('Created schedule rsvp-schedule-open (9am CT):', openResult.scheduleId)

  const closeResult = await createSchedule('rsvp-schedule-close', CRON_CLOSE)
  console.log('Created schedule rsvp-schedule-close (10pm CT):', closeResult.scheduleId)

  console.log('Done. Ensure QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are set in Vercel env for signature verification.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
