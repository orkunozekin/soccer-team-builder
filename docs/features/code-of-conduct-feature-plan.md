# Club Code of Conduct

Let a club require its members to agree to a code of conduct before they can RSVP. Each member agrees once.

## Status

| Field               | Value                       |
| ------------------- | --------------------------- |
| Status              | done (v1)                   |
| Owner session       | —                           |
| Last updated        | 2026-11-14                  |
| Related PR / branch | `orkun/awesome-cray-ieqxbh` |

## Goals (v1)

- **Club opt-in.** A club admin turns on "Require the code of conduct" on `/c/[slug]/settings`. Off by default, so nothing changes for existing clubs.
- **One code of conduct.** The text lives in [`lib/conduct/codeOfConduct.ts`](../../lib/conduct/codeOfConduct.ts) and is shown at `/code-of-conduct` and inside the RSVP modal.
- **Agree once.** In a club that requires it, a member who hasn't agreed sees a "Code of conduct" step at the end of the RSVP modal: the full text, an "I agree" checkbox, then Confirm RSVP. After that they're never asked again, in this club or any other.
- **Enforced on the server.** `POST /api/rsvp` refuses the RSVP (403, `CODE_OF_CONDUCT_REQUIRED`) until the member has agreed. The client step is UX only.
- **Out of scope for v1:**
  - Per-club custom text.
  - Asking members to agree again when the text changes.
  - An admin view of who has agreed.
  - Asking members who are already RSVPed to a match when the setting is turned on (it applies from their next RSVP).

## Design

### Data

| Where                                              | Fields                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `clubs/{clubId}.settings.requireCodeOfConduct`     | boolean, default false                                                     |
| `codeOfConductAgreements/{userId}` (new, API only) | `userId`, `version`, `agreedAt`, and the `clubId` / `matchId` it came from |

Agreements are per user, not per club: one agreement covers every club. They are kept off `users/{uid}` because users can write their own profile doc, and the agreement should only be written by the server. `firestore.rules` denies all client access. Lookups are by doc id: no composite index.

### Version

`CODE_OF_CONDUCT_VERSION` (an ISO date) is stored with each agreement. The RSVP route only records an agreement when the client sends the current version, so an old cached page can't agree to text it didn't show. Any stored version counts as agreed; to ask everyone again after a big change, compare the stored version in `checkCodeOfConductForRsvp`.

### API

| Route                                       | Behavior                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PATCH /api/clubs/[clubId]`                 | Accepts `settings.requireCodeOfConduct` (club admin). Audited in `club.updated`.                                                                                                                                                           |
| `GET /api/users/me/code-of-conduct?clubId=` | `{ required, agreement }`. Members and super users only (404 otherwise; 500 when the membership lookup fails).                                                                                                                             |
| `POST /api/rsvp`                            | Before the match lock: if the club requires it and the member hasn't agreed, 403 `CODE_OF_CONDUCT_REQUIRED` unless `acceptCodeOfConductVersion` is the current version, which records the agreement (audit `user.code_of_conduct_agreed`). |

### UX

- **Settings:** a second checkbox under "Players can invite", linking to `/code-of-conduct`.
- **RSVP modal:** steps are Position → (skill questionnaire, currently off) → Code of conduct. While the status is loading, the position step shows a disabled Next. If the status lookup fails, no step is shown and the server's 403 brings it up with "Agree to the code of conduct to RSVP."
- **`/code-of-conduct`:** public page with the full text.

## Critical decisions

- **Admins RSVPing someone else skip the check.** It's the admin's decision to add a walk-in. An admin RSVPing themselves is asked like anyone else.
- **The agreement is recorded even if the RSVP then fails** (e.g. goalkeeper cap). The member did agree; the retry from the goalkeeper picker resends the version anyway.
- **No LaunchDarkly flag.** The per-club setting is already off by default.

## Files

| Path                                                                                                 | Change                            |
| ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| [`lib/conduct/codeOfConduct.ts`](../../lib/conduct/codeOfConduct.ts)                                 | Text, version, error code         |
| [`lib/conduct/conductStoreAdmin.ts`](../../lib/conduct/conductStoreAdmin.ts)                         | Admin SDK reads/writes, RSVP gate |
| [`lib/conduct/useCodeOfConductStatus.ts`](../../lib/conduct/useCodeOfConductStatus.ts)               | Client status hook                |
| [`app/api/users/me/code-of-conduct/route.ts`](../../app/api/users/me/code-of-conduct/route.ts)       | Status route                      |
| [`app/api/rsvp/route.ts`](../../app/api/rsvp/route.ts)                                               | Gate                              |
| [`components/matches/RSVPPositionModal.tsx`](../../components/matches/RSVPPositionModal.tsx)         | Code of conduct step              |
| [`components/matches/RSVPButton.tsx`](../../components/matches/RSVPButton.tsx)                       | Wires status + 403 handling       |
| [`components/club/ClubSettingsPanel.tsx`](../../components/club/ClubSettingsPanel.tsx)               | Toggle                            |
| [`app/code-of-conduct/page.tsx`](../../app/code-of-conduct/page.tsx)                                 | Public page                       |
| `types/club.ts`, `lib/services/clubService.ts`, `app/api/clubs/[clubId]/route.ts`, `firestore.rules` | Setting + rules                   |

## Acceptance criteria

- [x] Clubs that haven't opted in see no change.
- [x] In an opted-in club, a member can't RSVP (UI or API) until they agree.
- [x] After agreeing once, the member RSVPs normally to any club's matches.
- [x] Verified against the Firestore emulator ([`app/api/rsvp/conduct.emulator.test.ts`](../../app/api/rsvp/conduct.emulator.test.ts)) and in the browser on emulators.

## Handoff

### Done so far

- v1 as described above, with unit, component and emulator tests.

### Remaining work

- None for v1. Candidates for later: per-club text, re-agreement on version change, admin list of who agreed.

### Blockers / risks

- None. No index or migration needed; existing clubs read `requireCodeOfConduct` as false.

### Pointers for the next agent

- Start at: `checkCodeOfConductForRsvp` in `lib/conduct/conductStoreAdmin.ts`.
- Do not: let the client write `codeOfConductAgreements`, or move the agreement onto `users/{uid}`.
- Verify with: `yarn test:run` and, with the Firestore emulator on `127.0.0.1:8080` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-rsvp-cascade`, `yarn vitest run app/api/rsvp`.
