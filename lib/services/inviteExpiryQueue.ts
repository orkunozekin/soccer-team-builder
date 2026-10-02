import { Client } from '@upstash/qstash'

const DEFAULT_QSTASH_API_URL = 'https://qstash-us-east-1.upstash.io'

function inviteExpiryEndpointUrl(): string | null {
  const base = process.env.BASE_URL?.trim().replace(/\/$/, '')
  if (!base) return null
  const scheme = base.startsWith('http') ? '' : 'https://'
  return `${scheme}${base}/api/cron/invite-expiry`
}

/**
 * Schedule one QStash delivery to `/api/cron/invite-expiry` at `expiresAt`.
 * Returns the QStash message id, or null when publishing is skipped. Never
 * publishes while emulators are on so local work cannot reach real QStash.
 * Throws on QStash errors; callers must treat publish as best-effort.
 */
export async function scheduleInviteExpiry(input: {
  inviteId: string
  expiresAt: Date
}): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') return null
  const token = process.env.QSTASH_TOKEN?.trim()
  const url = inviteExpiryEndpointUrl()
  if (!token || !url) return null

  const client = new Client({
    token,
    baseUrl: process.env.QSTASH_API_URL?.trim() || DEFAULT_QSTASH_API_URL,
  })
  const res = await client.publishJSON({
    url,
    body: { inviteId: input.inviteId },
    notBefore: Math.floor(input.expiresAt.getTime() / 1000),
    deduplicationId: `invite-expiry-${input.inviteId}`,
  })
  return res.messageId
}
