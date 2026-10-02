# Consistent list pagination

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Last updated | 2026-09-30 |

## Goals

Paginate RSVP order, active invites, saved locations, schedules, and filtered match lists with the existing Roster/Users controls and 10 rows per page. Preserve ordering, counts, permissions, and actions. Team lineups, selection menus, charts, and unused legacy player components are out of scope.

## Current state

Roster, Users, RSVP history, and audit events already paginate. The five lists above render every record. Team display has its own pair navigation.

## Design

Reuse `components/ui/pagination.tsx` and share client pagination state in a hook. Clamp pages after deletions, reset when scope/filter changes, retain absolute RSVP ranks, and keep edited sorted records visible. No data query changes.

## Todos

- [x] Add shared pagination state and apply to five lists.
- [x] Verify navigation, shrinking lists, scope changes, and RSVP ranks.
- [x] Run available checks and update handoff.

## Acceptance criteria

- Lists show at most 10 entries and controls only when needed.
- RSVP numbers continue across pages; filtering happens before pagination.
- Page state stays valid after removals and resets for a new scope.
- Existing mutations and auth boundaries remain intact.

## Handoff

### Done so far

- Implemented shared client pagination for RSVP order, invites, locations, schedules, and filtered match lists.
- Preserved absolute RSVP ranks, scope resets, removal clamping, and visibility of renamed locations/schedules.
- Added hook, RSVP, location, and schedule regression coverage. All 441 tests across 99 files pass (`yarn test:run --no-cache`); changed-file lint and diff checks pass.

### Remaining work

- None for this implementation.

### Blockers / risks

- Full TypeScript check remains blocked by pre-existing test-fixture errors in audit routes, RegisterForm, ClubInvitesPanel, MatchDetailView, and placeGkOnTeamWithoutGk. No errors in the new or modified implementation files.
- Tests use the existing local dependency installation through an ignored node_modules symlink; registry access was unavailable.
- Browser viewport checks were not run. Pagination reuses the existing responsive control.

### Pointers

- Start at `components/admin/RsvpOrderCard.tsx` and `components/ui/pagination.tsx`.
- Verify with focused Vitest tests, TypeScript, and lint.
