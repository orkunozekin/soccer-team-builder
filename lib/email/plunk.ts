const PLUNK_API_URL = 'https://next-api.useplunk.com/v1/send'

type SendPlunkEmailInput = {
  to: string
  subject: string
  body: string
}

export async function sendPlunkEmail({
  to,
  subject,
  body,
}: SendPlunkEmailInput): Promise<void> {
  const apiKey = process.env.PLUNK_API_KEY?.trim()
  const fromEmail = process.env.PLUNK_FROM_EMAIL?.trim()
  const fromName =
    process.env.PLUNK_FROM_NAME?.trim() || 'Soccerville'

  if (!apiKey || !fromEmail) {
    throw new Error('Plunk email is not configured on the server.')
  }

  const response = await fetch(PLUNK_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      subject,
      body,
      from: {
        name: fromName,
        email: fromEmail,
      },
      subscribed: false,
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(
      payload?.error?.message ||
        `Plunk send failed with status ${response.status}`
    )
  }
}
