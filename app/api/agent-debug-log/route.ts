import { appendFileSync, mkdirSync } from 'fs'
import { NextResponse } from 'next/server'

/**
 * Temporary debug ingest for hypothesis-driven instrumentation.
 * Writes NDJSON lines to /opt/cursor/logs/debug.log
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    mkdirSync('/opt/cursor/logs', { recursive: true })
    appendFileSync(
      '/opt/cursor/logs/debug.log',
      JSON.stringify({ ...body, timestamp: body?.timestamp ?? Date.now() }) + '\n'
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
