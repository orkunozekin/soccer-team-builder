#!/usr/bin/env node
/**
 * Create QStash daily schedule for recurring match materialization.
 * Run once after deploying. Requires QSTASH_TOKEN and BASE_URL in env or .env.local.
 *
 *   BASE_URL=https://your-app.vercel.app QSTASH_TOKEN=... node scripts/setup-qstash-materialize-schedules.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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

const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const BASE_URL = (
  process.env.BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
).replace(/\/$/, '')

if (!QSTASH_TOKEN) {
  console.error('Missing QSTASH_TOKEN.')
  console.error(
    '  Set it in .env.local or .env at project root, or pass as env var.'
  )
  process.exit(1)
}
if (!BASE_URL || !BASE_URL.startsWith('http')) {
  console.error(
    'Missing BASE_URL (e.g. https://your-app.vercel.app). Set it in .env.local or pass as env var.'
  )
  process.exit(1)
}

const DESTINATION = `${BASE_URL}/api/cron/materialize-schedules`

const QSTASH_API = (
  process.env.QSTASH_API_URL || 'https://qstash-us-east-1.upstash.io'
).replace(/\/$/, '')

// Daily at 00:15 CT - enough to top up the 3-match lookahead window
const CRON_DAILY = 'CRON_TZ=America/Chicago 15 0 * * *'

async function createSchedule(scheduleId, cron) {
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
  console.log('Creating QStash daily schedule for match materialization...')
  console.log('Destination:', DESTINATION)

  const result = await createSchedule(
    'materialize-schedules-daily',
    CRON_DAILY
  )
  console.log(
    'Created schedule materialize-schedules-daily (00:15 CT daily):',
    result.scheduleId
  )

  console.log(
    'Ensure QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are set in Vercel env for signature verification.'
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
