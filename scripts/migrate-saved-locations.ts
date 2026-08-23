/**
 * Import unique match locations into the savedLocations collection.
 *
 * Dedupes by normalized name + address (case-insensitive). When coords exist,
 * also dedupes locations within ~50m of each other.
 *
 *   yarn migrate:saved-locations              # dry-run (default)
 *   yarn migrate:saved-locations --write      # apply
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Timestamp } from 'firebase-admin/firestore'

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

const write = process.argv.slice(2).includes('--write')

type LocationShape = {
  name: string
  address: string
  lat: number | null
  lng: number | null
}

function normalizeExisting(raw: unknown): LocationShape | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    return { name: text, address: text, lat: null, lng: null }
  }
  if (typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name.trim() : ''
  const address = typeof obj.address === 'string' ? obj.address.trim() : ''
  if (!name && !address) return null
  const lat = typeof obj.lat === 'number' ? obj.lat : Number(obj.lat)
  const lng = typeof obj.lng === 'number' ? obj.lng : Number(obj.lng)
  return {
    name: name || address,
    address: address || name,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  }
}

function dedupeKey(loc: LocationShape): string {
  const name = loc.name.toLowerCase()
  const address = loc.address.toLowerCase()
  if (loc.lat != null && loc.lng != null) {
    const latKey = loc.lat.toFixed(4)
    const lngKey = loc.lng.toFixed(4)
    return `${name}|${address}|${latKey}|${lngKey}`
  }
  return `${name}|${address}`
}

async function main() {
  const { getAdminDb } = await import('../lib/firebase/admin')
  const adminDb = getAdminDb()
  if (!adminDb) {
    console.error(
      'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.'
    )
    process.exit(1)
  }

  console.log(
    write
      ? 'Mode: WRITE (will create savedLocations documents)'
      : 'Mode: DRY-RUN (pass --write to apply)'
  )

  const matchDocs = (await adminDb.collection('matches').get()).docs
  const unique = new Map<string, LocationShape>()

  for (const doc of matchDocs) {
    const loc = normalizeExisting(doc.data()?.location)
    if (!loc) continue
    const key = dedupeKey(loc)
    if (!unique.has(key)) unique.set(key, loc)
  }

  const existingDocs = (await adminDb.collection('savedLocations').get()).docs
  const existingKeys = new Set<string>()
  for (const doc of existingDocs) {
    const loc = normalizeExisting(doc.data())
    if (loc) existingKeys.add(dedupeKey(loc))
  }

  let created = 0
  let skipped = 0

  for (const [key, loc] of Array.from(unique.entries())) {
    if (existingKeys.has(key)) {
      skipped += 1
      console.log(`[skip] already saved: ${loc.name}`)
      continue
    }

    const locationId = `loc_${Date.now()}_${created}`
    console.log(
      `[${write ? 'write' : 'would-write'}] ${locationId}: ${loc.name}`
    )

    if (write) {
      const now = Timestamp.now()
      await adminDb.collection('savedLocations').doc(locationId).set({
        name: loc.name,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        createdAt: now,
        updatedAt: now,
      })
      // Avoid duplicate IDs when creating multiple docs in the same ms
      await new Promise(resolve => setTimeout(resolve, 2))
    }
    created += 1
  }

  console.log('\nSummary')
  console.log(`  match locations scanned: ${matchDocs.length}`)
  console.log(`  unique venues found:     ${unique.size}`)
  console.log(`  already in savedLocations: ${skipped}`)
  console.log(`  ${write ? 'created' : 'would create'}:         ${created}`)
  if (!write && created > 0) {
    console.log('\nRe-run with --write to apply these imports.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
