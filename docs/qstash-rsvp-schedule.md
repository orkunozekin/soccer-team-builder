# QStash RSVP schedule (9am / 10pm CT)

RSVP open/close is triggered by **Upstash QStash** at 9am CT (open) and 10pm CT (close) for minute-level precision. The handler is `POST /api/cron/rsvp-schedule`.

## 1. Upstash setup

1. Create an [Upstash](https://upstash.com) account and open **QStash**.
2. In the QStash dashboard, copy:
   - **QSTASH_TOKEN**
   - **QSTASH_CURRENT_SIGNING_KEY**
   - **QSTASH_NEXT_SIGNING_KEY**
3. In your Vercel project (or `.env.local`), set:
   - `QSTASH_TOKEN` (only needed to create schedules; optional in production if you use the dashboard)
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

The route accepts either **QStash signature verification** (when the signing keys are set) or **CRON_SECRET** (`Authorization: Bearer <CRON_SECRET>`). For QStash-triggered calls you only need the signing keys.

## 2. Create the two schedules

The setup script uses **US East 1** (`https://qstash-us-east-1.upstash.io`) by default. For EU, set `QSTASH_API_URL=https://qstash.upstash.io` in `.env.local`.

From the project root, with `BASE_URL` and `QSTASH_TOKEN` set:

```bash
BASE_URL=https://your-app.vercel.app QSTASH_TOKEN=your_token node scripts/setup-qstash-rsvp-schedule.mjs
```

Or set `BASE_URL` and `QSTASH_TOKEN` in `.env.local` and run:

```bash
node scripts/setup-qstash-rsvp-schedule.mjs
```

This creates:

- **rsvp-schedule-open**: runs at **9:00 CT** (open RSVP window)
- **rsvp-schedule-close**: runs at **22:00 CT** (close RSVP window)

Times use `CRON_TZ=America/Chicago` so DST is handled.

## 3. Optional: CRON_SECRET fallback

If you want to keep triggering the route manually or from another cron, set `CRON_SECRET` and call the route with `Authorization: Bearer <CRON_SECRET>` (GET or POST). When QStash signing keys are set, QStash requests are verified by signature and do not require CRON_SECRET.

## 4. Vercel cron

The previous Vercel Cron job for this route has been removed (`vercel.json` has an empty `crons` array). All scheduling is done via QStash.
