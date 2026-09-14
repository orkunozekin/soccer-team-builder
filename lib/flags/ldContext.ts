import type { LDContext } from 'launchdarkly-js-client-sdk'

export function anonymousContext(): LDContext {
  return {
    kind: 'user',
    key: 'anonymous',
    anonymous: true,
  }
}

export function contextFromAuth(uid: string, email: string | null): LDContext {
  return {
    kind: 'user',
    key: uid,
    email: email ?? undefined,
  }
}
