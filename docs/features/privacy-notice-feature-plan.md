# Privacy Notice and Data Transparency

Plan for publishing an accurate privacy notice, making it easy to find, and
explaining the app's data use at account creation and location check-in. This
is a product and engineering plan, not legal advice; final policy text and the
app's jurisdictional obligations require review by qualified counsel.

## Status

| Field | Value |
|-------|-------|
| Status | planned |
| Owner session | Cursor Cloud planning session |
| Last updated | 2026-09-27 |
| Related PR / branch | `cursor/privacy-notice-plan-2304` |

## Problem

Soccerville has no public privacy notice, terms route, signup disclosure, or
persistent legal link. The app stores account, profile, club, match, RSVP,
attendance, and audit data; processes one-time device location for check-in;
and sends data to service providers. A generic "disclaimer" would not
accurately explain these practices or establish an operational process for
privacy requests.

The shipped notice must describe what the app actually does. It must not claim
that users can self-serve export or deletion, that all data is deleted with an
account, or that no third parties receive data unless the implementation has
been changed to make those statements true.

## Goals (v1)

- **Accurate public notice** — publish a mobile-friendly `/privacy` page with
  version, effective date, operator/contact details, data categories, purposes,
  recipients, retention, user choices, and request instructions.
- **Notice at collection** — link the notice from both email/password and
  Google account creation, and add specific just-in-time copy before requesting
  check-in location.
- **Persistent discovery** — expose the notice to signed-out visitors and in
  signed-in account navigation without requiring authentication.
- **Operationally support the promises** — document an owner and procedure for
  access/correction/deletion requests, and resolve or explicitly disclose
  known deletion and cross-user visibility gaps before publication.
- **Versioned source of truth** — keep approved copy and policy metadata in one
  reviewable module so links and displayed dates cannot drift.
- **Out of scope for v1:** drafting Terms of Service, automated data export,
  self-service account deletion, a general consent-management platform,
  backfilling policy acceptance records, marketing preferences, or asserting
  GDPR/CCPA/COPPA compliance without legal review.

## Product decisions required before implementation

| Decision | Recommended v1 default | Owner |
|----------|------------------------|-------|
| Legal operator name, address, and privacy email | Use real operator details; do not ship placeholders | Product/legal |
| Applicable jurisdictions and minimum user age | Confirm where users are offered the app and whether minors may register | Product/legal |
| Privacy notice vs. separate Terms | Ship the privacy notice now; plan Terms separately if counsel requires contract acceptance | Product/legal |
| Signup interaction | Clear linked acknowledgement text for both signup methods; do not call it "consent" | Product/legal |
| Acceptance record | Do not store one for an informational privacy notice unless counsel identifies a legal need | Product/legal |
| Cookie/SDK consent | Inventory actual production SDK storage first; add a banner only if required for non-essential technology in served jurisdictions | Product/legal/engineering |
| Material policy changes | Show the new effective date and notify users; require re-acceptance only if the legal basis or Terms require it | Product/legal |
| Privacy request fulfillment | Support through the published privacy email with a documented identity-verification runbook | Operations |

## Current state

### Data and visibility

| Category | Confirmed data and purpose | Storage / processing |
|----------|----------------------------|----------------------|
| Account | Email, Firebase UID, password authentication or Google sign-in | Firebase Auth; account creation in [`components/auth/RegisterForm.tsx`](../../components/auth/RegisterForm.tsx) |
| Profile | Display name, email, jersey number, preferred position, role, active club | Firestore `users`; schema in [`types/user.ts`](../../types/user.ts) |
| Club access | Club membership, role, invite use, creator and timestamps | Firestore `clubs`, `clubMemberships`, `clubInvites` |
| Match participation | RSVP state, position/jersey snapshot, attendance, check-in method and timestamps | Firestore `rsvps`; schema in [`types/rsvp.ts`](../../types/rsvp.ts) |
| Team and venue | Team assignments, match details, venue address and venue coordinates | Firestore match/team/location documents |
| Device location | Latitude, longitude, and accuracy used to validate proximity on check-in | Sent to [`app/api/check-in/route.ts`](../../app/api/check-in/route.ts); raw user coordinates are validated but not persisted by that route |
| Operations/security | Actor/target IDs, action, entity references, selected metadata, timestamp | Firestore `auditLogs`; schema in [`types/auditLog.ts`](../../types/auditLog.ts) |
| Browser state | Firebase authentication persistence and limited development/legacy local storage | Firebase client SDK and local browser storage |

Important gaps to resolve or disclose:

- [`firestore.rules`](../../firestore.rules) currently lets any authenticated
  user read every `users` and `rsvps` document. Because user documents contain
  email addresses, this is broader than the club-scoped roster purpose.
  Engineering should minimize these reads before publishing a statement about
  who can see profile data.
- Admin deletion in
  [`app/api/users/[userId]/route.ts`](../../app/api/users/%5BuserId%5D/route.ts)
  removes the Auth user, user document, RSVPs, and team references, but does not
  remove or anonymize all membership, invite-creator, or audit references.
  There is no self-service deletion or export.
- Matches are soft-deleted and related historical participation may remain.
  Audit logs default to 90 days, configurable from 1 to 3,650 days, in
  [`lib/audit/retention.ts`](../../lib/audit/retention.ts).

### Service providers to verify

| Provider | Confirmed app use | Items to confirm for approved copy |
|----------|-------------------|------------------------------------|
| Google Firebase | Authentication and Firestore database | Contracting entity, region, retention, subprocessors |
| Google OAuth | Optional Google account sign-in | Data returned/scopes and mobile flow |
| Vercel | Web/API hosting | Access-log contents and retention |
| LaunchDarkly | Feature evaluation using UID/email or anonymous context | SDK/browser storage, retention, whether email is necessary |
| Mapbox | Admin venue address search/map selection | Search data, device/network data, retention |
| Plunk | Transactional password-reset email | Message/recipient retention and subprocessor terms |
| Upstash QStash | Signed calls to scheduled API routes | Log contents and retention; no user payload is intentionally sent |

The inventory must be checked against production configuration, vendor
contracts, the native/mobile client if separately deployed, and operational
logs. Code review alone cannot establish those facts.

### Existing UX

- No `/privacy`, `/terms`, footer, legal settings page, or signup legal copy
  exists.
- [`components/layout/AppShell.tsx`](../../components/layout/AppShell.tsx)
  owns signed-in desktop/mobile chrome and the signed-out shell.
- [`components/layout/AccountNav.tsx`](../../components/layout/AccountNav.tsx)
  owns signed-in account destinations.
- [`lib/hooks/useClubWorkspace.ts`](../../lib/hooks/useClubWorkspace.ts) must
  classify `/privacy` as a platform path so club switching does not redirect it.
- The check-in product plan already promises a one-time location disclosure in
  [`docs/features/check-in-feature-plan.md`](check-in-feature-plan.md), but the
  full public privacy notice does not exist.

## Proposed v1 design

### 1. Approved policy source

Add a small server-safe module under `lib/legal/` containing:

- policy version and effective date;
- legal operator name and privacy contact;
- structured, approved section content;
- no environment-dependent or placeholder legal claims.

Keep the content in TypeScript/JSX because the repository has no established
MDX/content pipeline. A policy update should be an explicit reviewed code
change. Historical versions may be retained in git for v1; a public archive can
be added later if counsel requires one.

### 2. Public `/privacy` page

Add a static, unauthenticated App Router page with page metadata and semantic
headings. It should cover, in plain language:

1. operator/contact and scope;
2. data collected and sources;
3. purposes and legal bases where applicable;
4. profile/roster visibility to other users and administrators;
5. one-time location check-in and the host-assisted alternative;
6. service providers and disclosures;
7. retention criteria, including the audit-log window;
8. security statement without guarantees;
9. access, correction, deletion, objection, and complaint instructions as
   applicable;
10. children/minimum-age position;
11. international transfers if applicable;
12. policy changes, version, and effective date.

The page must remain readable on phone widths and when signed out. Do not put
legal copy behind a feature flag or authentication check.

### 3. Notice and navigation

- Add linked acknowledgement text next to the account-creation actions in
  [`components/auth/RegisterForm.tsx`](../../components/auth/RegisterForm.tsx).
  It must apply equally to password and Google signup. Suggested structure:
  "By creating an account, you acknowledge the Privacy Notice."
- Do not add a required privacy checkbox by default. Privacy notices explain
  processing; bundling all processing into consent can create a misleading
  legal basis. Add explicit opt-in only for a separately identified optional
  purpose when counsel requires it.
- Add `Privacy` to
  [`components/layout/AccountNav.tsx`](../../components/layout/AccountNav.tsx)
  for signed-in users.
- Add a compact privacy link to the signed-out shell and a persistent signed-in
  location. Implement this as a small shared legal-links/footer component
  rendered by [`components/layout/AppShell.tsx`](../../components/layout/AppShell.tsx)
  without disrupting the sticky mobile navigation.
- Treat `/privacy` as a platform path in
  [`lib/hooks/useClubWorkspace.ts`](../../lib/hooks/useClubWorkspace.ts).

### 4. Just-in-time location notice

Immediately before the browser geolocation request, explain:

- the app requests current location only after the user taps Check in;
- latitude/longitude and accuracy are sent to the server to compare with the
  venue;
- the route does not store raw user coordinates after validation;
- successful attendance, method, and timestamp are retained;
- users can ask a host to mark them present instead.

Link "Learn more" to `/privacy`. Keep the browser permission prompt user
initiated; never request location on page load.

### 5. Privacy request operations

Before publishing request-rights language:

1. designate the inbox owner and response/escalation process;
2. define identity verification without requesting excessive new data;
3. map each request type to Firebase Auth, Firestore collections, audit logs,
   email provider records, and other processors;
4. document permitted retention/exceptions with counsel;
5. fix account deletion cleanup or accurately state what is retained and why;
6. record completion without placing request details or identity documents in
   general application logs.

This can start as a private operations runbook; do not commit personal request
details or vendor credentials.

## Todos

1. **Confirm scope with product/legal**
   - [ ] Supply operator legal name, address/contact, service region, age policy,
     and privacy inbox.
   - [ ] Decide whether separate Terms, SDK consent, or a cookie notice is
     required.
   - [ ] Obtain approval for notice, acknowledgement, location, and update copy.
2. **Validate the production data map**
   - [ ] Confirm enabled vendors, regions, retention, browser storage, server
     logs, and native/mobile behavior.
   - [ ] Confirm the production `AUDIT_LOG_RETENTION_DAYS` value and match the
     policy to deployed behavior.
   - [ ] Remove unnecessary personal fields from LaunchDarkly context where
     practical.
3. **Close privacy/security mismatches**
   - [ ] Replace globally readable full user/RSVP records with club-scoped or
     data-minimized read models/rules; add Firestore rules tests.
   - [ ] Define and test complete deletion/anonymization behavior for
     memberships, invite ownership, attendance/history, teams, and audit logs.
   - [ ] Decide whether these changes land in this feature or linked prerequisite
     plans; do not publish narrower visibility/deletion claims before they land.
4. **Implement the policy surface**
   - [ ] Add versioned approved content and the public `/privacy` route.
   - [ ] Add signup acknowledgement, signed-out legal link, signed-in account
     link, and platform-path handling.
   - [ ] Add the just-in-time check-in location notice and fallback wording.
5. **Operationalize requests and updates**
   - [ ] Write the private request-handling runbook and assign an owner.
   - [ ] Record release date/version and define the material-change notification
     procedure.
6. **Verify**
   - [ ] Run focused component/unit tests, lint, format check, and build.
   - [ ] Manually verify public access, all navigation links, signup methods,
     mobile/desktop layout, keyboard navigation, and check-in disclosure against
     Firebase emulators only.
   - [ ] Have product/legal compare final copy against the validated data map
     before release.

## Files to touch

| Path | Change |
|------|--------|
| `app/privacy/page.tsx` | New public policy route, metadata, and semantic page layout |
| `lib/legal/privacyNotice.tsx` | New approved content and version/effective-date source |
| `components/legal/LegalLinks.tsx` | New reusable compact privacy link/footer |
| `components/auth/RegisterForm.tsx` | Add linked acknowledgement covering both signup methods |
| `components/matches/CheckInButton.tsx` | Add just-in-time location disclosure and privacy link |
| `components/layout/AppShell.tsx` | Render legal links in signed-out and signed-in shells |
| `components/layout/AccountNav.tsx` | Add signed-in Privacy destination |
| `lib/hooks/useClubWorkspace.ts` | Classify `/privacy` as a platform path |
| `firestore.rules` and rules tests | Scope/minimize user and RSVP reads if included in this feature |
| `app/api/users/[userId]/route.ts` and tests | Complete or intentionally anonymize account-related deletion if included |
| `components/auth/RegisterForm.test.tsx` | Assert accessible notice text and link for signup |
| `components/layout/AccountNav.test.tsx` | Assert destination and active state |
| `components/layout/AppShell.test.tsx` | Assert legal-link discovery signed in/out |
| `components/matches/CheckInButton.test.tsx` | Assert disclosure precedes geolocation and host fallback remains |
| `.env.sample` | Add a public privacy-contact variable only if product chooses configuration over a reviewed constant |

## Acceptance criteria

- [ ] `/privacy` is public, indexable as intended, mobile-friendly, keyboard
  accessible, and displays approved operator/contact, version, and effective date.
- [ ] Policy content matches the production data map and names all active
  processor categories, one-time location handling, visibility, and retention
  without unsupported promises.
- [ ] Email/password and Google account creation show the same linked notice
  before the action; no unrelated processing is mislabeled as consent.
- [ ] Signed-out users and signed-in users can reach `/privacy` from persistent
  navigation, and club switching does not redirect the policy route.
- [ ] Check-in presents concise purpose, transmission, retention, and host
  fallback information before invoking browser geolocation.
- [ ] Cross-club profile/RSVP access and account-deletion leftovers are either
  corrected and tested or accurately called out in approved policy and the
  request runbook.
- [ ] The published privacy email is monitored and a documented, secure request
  workflow has an accountable owner.
- [ ] Focused tests, `yarn lint`, `yarn format:check`, and `yarn build` pass; UI
  is manually verified on phone and desktop against local emulators.
- [ ] Qualified legal review is recorded before production publication.

## Risks and later work

- A policy cannot repair overbroad access control or incomplete deletion. Those
  are engineering risks even if disclosed.
- Vendor dashboards and contracts may differ from repository assumptions.
- White-label clubs may change controller/processor roles and require club-level
  notices; review before broadening club branding or ownership.
- Later work may include self-service export/deletion, policy-change messaging,
  consent preferences for optional processing, a public version archive, and
  native-app store disclosures.

## Handoff

> Updated by `/handoff`. `/feature-context` reads this first.

### Done so far

- Completed a code-based inventory of data categories, key retention/deletion
  behavior, processors, and current legal UX.
- Identified broad authenticated reads of user/RSVP records and incomplete
  account deletion as pre-publication privacy risks.
- Drafted v1 scope, implementation surfaces, acceptance criteria, and required
  product/legal decisions.

### Remaining work

- Resolve every item under **Product decisions required before implementation**.
- Validate code-derived assumptions against production vendor configuration and
  operations.
- Obtain approved copy, then execute Todos 3–6 in order.

### Blockers / risks

- Operator identity/contact, jurisdiction, age policy, and approved legal text
  are not available in the repository.
- Production vendor configuration, log retention, and native/mobile data flows
  cannot be proven from this codebase alone.
- Current broad Firestore reads and partial deletion may conflict with the
  intended final claims.

### Pointers for the next agent

- Start at: the production data-map validation and product/legal decisions in
  this plan; do not invent legal copy or placeholders.
- Do not: call the notice a universal consent, promise full deletion/export,
  hide it behind authentication, or test against production Firebase.
- Verify with: focused Vitest coverage, Firestore rules tests where access
  changes, lint/format/build, and a mobile/desktop emulator walkthrough.
