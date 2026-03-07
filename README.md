# To get started:

1. Clone the app
2. run `yarn` to install dependencies
3. run `yarn dev` to start local server

To use a **local database** instead of production Firebase (Auth + Firestore), see [docs/local-development.md](docs/local-development.md).


## RSVP schedule (cron)

RSVP opens automatically at 6:00 AM CT and the match gets deleted at 10:00 PM CT on match day. See [docs/rsvp-cron.md](docs/rsvp-cron.md) for cron setup.

## Some of the libraries used:

1. Zustand (State management)
2. Shadcn/ui (headless UI components)
3. Tailwindcss for styling

## Testing

Unit tests use [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react). Run tests:

- `yarn test` — watch mode
- `yarn test:run` — single run
