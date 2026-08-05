import { NextRequest, NextResponse } from 'next/server'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function getAllowedRedirectUri(): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    'https://www.soccerville.club/auth/mobile-callback'
  )
}

/**
 * POST /api/auth/google/mobile-token
 * Exchanges a Google authorization code (PKCE) for an ID token.
 * Used by the Expo app; client_secret must stay on the server.
 *
 * Body: { code, codeVerifier, redirectUri }
 * Returns: { idToken }
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured on the server.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const code = typeof body?.code === 'string' ? body.code : ''
    const codeVerifier =
      typeof body?.codeVerifier === 'string' ? body.codeVerifier : ''
    const redirectUri =
      typeof body?.redirectUri === 'string' ? body.redirectUri : ''

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json(
        { error: 'code, codeVerifier, and redirectUri are required.' },
        { status: 400 }
      )
    }

    const allowedRedirectUri = getAllowedRedirectUri()
    if (redirectUri !== allowedRedirectUri) {
      return NextResponse.json(
        { error: 'Invalid redirect URI.' },
        { status: 400 }
      )
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    })

    const tokenJson = (await tokenResponse.json()) as {
      id_token?: string
      error?: string
      error_description?: string
    }

    if (!tokenResponse.ok || !tokenJson.id_token) {
      return NextResponse.json(
        {
          error:
            tokenJson.error_description ||
            tokenJson.error ||
            'Failed to exchange Google authorization code.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ idToken: tokenJson.id_token })
  } catch (error) {
    console.error('Google mobile token exchange failed:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Internal server error') },
      { status: 500 }
    )
  }
}
