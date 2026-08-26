# QStash recurring match schedules (daily)

Active match schedules keep the next **3 upcoming matches** materialized in Firestore. Top-up runs daily via **Upstash QStash** against `POST /api/cron/materialize-schedules`.

Activating a schedule (or creating one as active) also materializes immediately so players do not wait for cron.

## Behavior

- Collection: `schedules/{scheduleId}` with one or more slots (day + time + location)
- Cadence: `weekly` or `monthly` (optional `interval`, default 1)
- Generated matches store `scheduleId`, `scheduleSlotId`, and `scheduleOccurrenceKey` for deduping
- Soft-deleted occurrence keys are not recreated
- Deactivating a schedule stops new creation; existing matches stay

## Setup

Uses the same QStash env vars as the RSVP cron (`QSTASH_*`, `BASE_URL`, optional `CRON_SECRET`). See [qstash-rsvp-schedule.md](./qstash-rsvp-schedule.md).

From the project root:

```bash
npm run setup:qstash-materialize
```

Or:

```bash
BASE_URL=https://your-app.vercel.app QSTASH_TOKEN=... node scripts/setup-qstash-materialize-schedules.mjs
```

This creates **materialize-schedules-daily** at **00:15 America/Chicago**.

## Manual trigger

```bash
curl -X POST "$BASE_URL/api/cron/materialize-schedules" \
  -H "Authorization: Bearer $CRON_SECRET"
```
