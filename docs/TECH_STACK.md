# Technology Stack

This document lists the technologies used in this app so you can replicate the same stack in a new project. Versions below are **latest stable** at the time of writing; pin exact versions from npm when scaffolding. A **“same stack minus scheduled jobs”** variant is described at the end.

---

## Core framework & runtime

| Technology     | Version     | Purpose                                      |
| -------------- | ----------- | -------------------------------------------- |
| **Next.js**    | 15.x / 16.x | React framework, App Router, API routes, SSR |
| **React**      | 19.x        | UI library                                   |
| **TypeScript** | ^5          | Typing, `strict` mode, path alias `@/*`      |
| **Node**       | 20.x LTS+   | Runtime                                      |

- **App Router**: `app/` for pages, layouts, and API routes.
- **Path alias**: `@/*` → project root (see `tsconfig.json`).
- **Dev**: `next dev --turbo --port 3001` (Turbopack is stable in Next 15+).

---

## Styling & UI primitives

| Technology                         | Version | Purpose                                                         |
| ---------------------------------- | ------- | --------------------------------------------------------------- |
| **Tailwind CSS**                   | ^3.4    | Utility-first CSS, theme (colors, radius, animations)           |
| **tailwindcss-animate**            | latest  | Accordion and other animations                                  |
| **PostCSS**                        | ^8      | Tailwind pipeline (`postcss.config.mjs`)                        |
| **class-variance-authority (cva)** | latest  | Variant-based component APIs (e.g. button variants)             |
| **clsx** + **tailwind-merge**      | latest  | Conditional and merged class names (e.g. `cn()` in `lib/utils`) |

- **Dark mode**: `darkMode: ['class']` in `tailwind.config.ts`.
- **Theme**: Custom palette + shadcn/ui CSS variables for `background`, `foreground`, `card`, `primary`, etc.

---

## Component library

| Technology    | Purpose                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui** | UI components (copy-paste into `components/ui/`). Built on Radix UI + Tailwind; add with `npx shadcn@latest add <component>`. |

- **No separate package**: Components are owned in your repo. Install the CLI and add only what you need (button, card, input, form, dialog, select, accordion, calendar, etc.).
- **Init**: `npx shadcn@latest init`; then add components as needed. Uses Radix primitives under the hood, styled with Tailwind and `cva`/`cn()`.

---

## Forms & validation

| Technology              | Version | Purpose                            |
| ----------------------- | ------- | ---------------------------------- |
| **react-hook-form**     | ^7      | Form state, validation, submission |
| **@hookform/resolvers** | ^3      | Schema-based validation (e.g. Zod) |
| **zod**                 | ^3      | Schema and validation              |

- **Pattern**: Zod schema → resolver → `react-hook-form`; form components wired via shadcn/ui + custom `Field`/form wrappers.

---

## Backend & data

| Technology            | Version | Purpose                                                      |
| --------------------- | ------- | ------------------------------------------------------------ |
| **Firebase (client)** | ^12     | Auth (sign-in, sign-up, session), Firestore (client SDK)     |
| **firebase-admin**    | ^13     | Server-side Auth (token verification), Firestore (admin SDK) |

- **Auth**: Firebase Auth (e.g. email/password, Google); optional emulator for local dev.
- **Database**: **Firestore** (client + admin).
- **Config**: `lib/firebase/config.ts` (client), `lib/firebase/admin.ts` (server); env for API keys and (optionally) service account.

---

## State & utilities

| Technology       | Version | Purpose                                                |
| ---------------- | ------- | ------------------------------------------------------ |
| **Zustand**      | ^5      | Client-side global state (e.g. auth store in `store/`) |
| **date-fns**     | ^4      | Date formatting and manipulation                       |
| **date-fns-tz**  | ^3      | Timezone-aware dates                                   |
| **uuid**         | ^10     | Stable IDs (e.g. for entities)                         |
| **lucide-react** | latest  | Icons (commonly used with shadcn/ui)                   |

---

## Drag and drop

| Technology             | Version | Purpose                        |
| ---------------------- | ------- | ------------------------------ |
| **@dnd-kit/core**      | ^6      | Drag-and-drop core             |
| **@dnd-kit/utilities** | ^3      | DnD helpers (e.g. coordinates) |

Used for reorderable lists (e.g. teams, bench).

---

## Dev & tooling

| Technology   | Version    | Purpose                                                              |
| ------------ | ---------- | -------------------------------------------------------------------- |
| **ESLint**   | ^9         | Linting (`eslint-config-next`)                                       |
| **Prettier** | ^3         | Formatting (`eslint-config-prettier`, `prettier-plugin-tailwindcss`) |
| **Yarn**     | 1.x or 4.x | Package manager                                                      |

---

## Hosting & deployment

| Technology | Purpose                           |
| ---------- | --------------------------------- |
| **Vercel** | Hosting and serverless API routes |

- **Config**: `vercel.json` (e.g. empty `crons` if not using Vercel Cron).

---

## Scheduled jobs (omit for “same stack minus scheduled jobs”)

These are **only** used for scheduled/cron workflows in this app. For a new app that should **not** include scheduled jobs, do **not** add these.

| Technology           | Version | Purpose in this app                                                                             |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| **@upstash/qstash**  | ^2      | Trigger API route on a schedule (e.g. RSVP open/close at 9am / 10pm CT)                         |
| **QStash schedules** | —       | Created via script `scripts/setup-qstash-rsvp-schedule.mjs`                                     |
| **Cron API route**   | —       | `app/api/cron/rsvp-schedule/route.ts` (handler called by QStash)                                |
| **Scheduler helper** | —       | `lib/utils/rsvpScheduler.ts` (QStash schedule creation)                                         |
| **Env vars**         | —       | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`; optional `CRON_SECRET` |

**To replicate “same stack minus scheduled jobs”:**

1. **Do not install** `@upstash/qstash`.
2. **Do not create** cron API routes or QStash-related scripts.
3. **Do not add** QStash or CRON env vars.
4. **Omit** any UI or services that only exist to manage schedules (e.g. RSVP schedule controls that call QStash).
5. Keep **Vercel** and the rest of the stack (Next.js, Firebase, Tailwind, shadcn/ui, etc.) as above.

---

## Checklist for a new app (same stack, no scheduled jobs)

- [ ] Next.js 15+ (App Router), React 19, TypeScript 5
- [ ] Tailwind 3.4 + tailwindcss-animate; theme (e.g. `tailwind.config.ts`) and `cn()` in `lib/utils`
- [ ] **shadcn/ui** — `npx shadcn@latest init` then add components (button, card, input, form, dialog, select, etc.)
- [ ] react-hook-form + @hookform/resolvers + zod
- [ ] Firebase (client: Auth + Firestore); firebase-admin (Auth + Firestore) for API routes
- [ ] Zustand (if you need global client state)
- [ ] date-fns (+ date-fns-tz if you need timezones)
- [ ] uuid, lucide-react
- [ ] @dnd-kit/core + @dnd-kit/utilities (only if you need drag-and-drop)
- [ ] ESLint + Prettier + Tailwind Prettier plugin
- [ ] Yarn; path alias `@/*`
- [ ] **Skip**: @upstash/qstash, cron routes, QStash scripts, and QStash/CRON env vars

This gives you the same core stack (Next.js, Firebase, Tailwind, shadcn/ui, forms, state, tooling) without any scheduled jobs.
