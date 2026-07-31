/**
 * Backfill structured match locations from legacy string (or incomplete) locations.
 *
 * For each match:
 * - string location → { name, address } from that string, then Mapbox-geocode for lat/lng
 * - object missing coords → geocode address (or name) and fill lat/lng
 * - already has name + address + valid coords → skip
 *
 * Requires Firebase Admin credentials and a Mapbox token.
 *
 *   yarn backfill:match-locations              # dry-run (default)
 *   yarn backfill:match-locations --write      # apply updates
 *   npx tsx scripts/backfill-match-locations.ts --write --matchId=match_123
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

const args = process.argv.slice(2)
const write = args.includes('--write')
const matchIdArg = args.find(a => a.startsWith('--matchId='))
const onlyMatchId = matchIdArg ? matchIdArg.slice('--matchId='.length) : null

type LocationShape = {
  name: string
  address: string
  lat: number | null
  lng: number | null
}

function hasValidCoords(loc: LocationShape): boolean {
  return (
    loc.lat != null &&
    loc.lng != null &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    Math.abs(loc.lat) <= 90 &&
    Math.abs(loc.lng) <= 180
  )
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

async function geocodeAddress(
  query: string,
  token: string
): Promise<{ lat: number; lng: number; placeName: string } | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  )
  url.searchParams.set('access_token', token)
  url.searchParams.set('limit', '1')
  url.searchParams.set('types', 'address,poi,place')

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mapbox geocode ${res.status}: ${text}`)
  }
  const data = (await res.json()) as {
    features?: Array<{
      place_name?: string
      center?: [number, number]
    }>
  }
  const feature = data.features?.[0]
  const center = feature?.center
  if (!center || center.length < 2) return null
  return {
    lng: center[0]!,
    lat: center[1]!,
    placeName: feature?.place_name || query,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const mapboxToken = (
    process.env.MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    ''
  ).trim()
  if (!mapboxToken) {
    console.error(
      'Missing Mapbox token. Set MAPBOX_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN.'
    )
    process.exit(1)
  }

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
      ? 'Mode: WRITE (will update Firestore)'
      : 'Mode: DRY-RUN (pass --write to apply)'
  )

  const docs = onlyMatchId
    ? await (async () => {
        const doc = await adminDb.collection('matches').doc(onlyMatchId).get()
        return doc.exists ? [doc] : []
      })()
    : (await adminDb.collection('matches').get()).docs

  if (docs.length === 0) {
    console.log(
      onlyMatchId ? `Match ${onlyMatchId} not found.` : 'No matches found.'
    )
    return
  }

  let skipped = 0
  let updated = 0
  let failed = 0
  let noLocation = 0

  for (const doc of docs) {
    const data = doc.data()
    if (!data) {
      noLocation += 1
      console.log(`[skip] ${doc.id}: empty document`)
      continue
    }
    const existing = normalizeExisting(data.location)

    if (!existing) {
      noLocation += 1
      console.log(`[skip] ${doc.id}: no location set`)
      continue
    }

    if (hasValidCoords(existing) && existing.name && existing.address) {
      skipped += 1
      console.log(
        `[ok] ${doc.id}: already structured (${existing.name} @ ${existing.lat},${existing.lng})`
      )
      continue
    }

    const query = existing.address || existing.name
    try {
      const geo = await geocodeAddress(query, mapboxToken)
      if (!geo) {
        failed += 1
        console.warn(`[fail] ${doc.id}: no geocode result for "${query}"`)
        continue
      }

      const next: LocationShape = {
        name: existing.name || geo.placeName,
        address: existing.address || geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
      }

      console.log(
        `[${write ? 'write' : 'would-write'}] ${doc.id}:`,
        JSON.stringify(next)
      )

      if (write) {
        await doc.ref.update({
          location: next,
          updatedAt: Timestamp.now(),
        })
      }
      updated += 1
      // Gentle rate limit for Mapbox free tier
      await sleep(200)
    } catch (err) {
      failed += 1
      console.error(`[fail] ${doc.id}:`, err)
    }
  }

  console.log('\nSummary')
  console.log(`  checked:     ${docs.length}`)
  console.log(`  no location: ${noLocation}`)
  console.log(`  already ok:  ${skipped}`)
  console.log(`  ${write ? 'updated' : 'would update'}: ${updated}`)
  console.log(`  failed:      ${failed}`)
  if (!write && updated > 0) {
    console.log('\nRe-run with --write to apply these updates.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
