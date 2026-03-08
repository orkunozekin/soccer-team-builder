/**
 * Regenerate teams for a match from scratch by RSVP order and goalkeeper logic.
 * Uses the same logic as the app (expandTeamsForMatch with forceRegenerate).
 * Requires Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS).
 *
 *   npx tsx scripts/regenerate-teams.ts <matchId>
 *   yarn regenerate-teams <matchId>
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function loadEnvFile(filename: string, dir: string = rootDir): void {
  const filePath = join(dir, filename)
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf8')
  content = content.replace(/^\uFEFF/, '')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      let val = m[2]!.replace(/^["']|["']$/g, '').trim()
      val = val.replace(/\s*#.*$/, '').trim()
      process.env[m[1]!] = val
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
  console.error('Usage: npx tsx scripts/regenerate-teams.ts <matchId>')
  console.error('   or: yarn regenerate-teams <matchId>')
  process.exit(1)
}

async function main() {
  const { getAdminDb } = await import('../lib/firebase/admin')
  const { expandTeamsForMatch } =
    await import('../lib/teams/expandTeamsForMatch')

  const adminDb = getAdminDb()
  if (!adminDb) {
    console.error(
      'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.'
    )
    process.exit(1)
  }

  const matchRef = adminDb.collection('matches').doc(matchId)
  const matchSnap = await matchRef.get()
  if (!matchSnap.exists) {
    console.error(`Match ${matchId} not found.`)
    process.exit(1)
  }

  console.log(`Regenerating teams for match ${matchId}...`)
  const result = await expandTeamsForMatch(adminDb, matchId, {
    forceRegenerate: true,
  })
  if (result.regenerated) {
    console.log(
      'Done. Teams have been refilled by RSVP order and goalkeeper rules.'
    )
  } else {
    console.log('No teams to regenerate (no confirmed RSVPs or error).')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
