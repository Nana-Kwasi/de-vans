# QuickChop Admin Web (React + Vite + Tailwind)

The business owner's dashboard: watch live orders, advance their status, manage
the menu, view sales, and see customers. Talks only to the Spring Boot API.

## Setup
```bash
cd web
npm install
cp .env.example .env     # set VITE_API_BASE_URL to your backend
npm run dev              # http://localhost:5173
```

Sign in with the seeded admin account (`franciskontoh4@gmail.com` / the seeded
password), then change the password — a "change password" endpoint is wired in
the backend. The dashboard stores the admin JWT and sends it as a Bearer token.

## Pages
- **Login** — email + password against the seeded `admin_users` account. No sign-up.
- **Live Orders** — auto-refreshing feed with one-tap status advance (Received → Preparing → Out for delivery → Delivered) and Cancel, filterable by status.
- **Menu** — edit prices, toggle sold-out/available, add new meals.
- **Sales** — totals for today / this week / a custom date range.
- **Customers** — everyone who has placed an order.

## Live updates: poll vs realtime
Default is **polling** (`VITE_ORDERS_REFRESH_MODE=poll`, interval
`VITE_ORDERS_POLL_MS`). It needs no extra services and is trivial to reason
about; the tradeoff is a small refresh delay and steady request volume. The
alternative — Supabase Realtime on the `orders` table — pushes changes
instantly but couples the dashboard directly to Supabase, which this
architecture otherwise avoids (everything else goes through the API). Polling
was chosen as the simpler option that fits the rest of the design.

## Design
Glassmorphism matching the mobile app — the same warm orange→cream gradient,
frosted `.glass` cards (real CSS `backdrop-filter: blur`), pill buttons, soft
shadows, and rounded corners. Tokens live in `src/index.css` +
`tailwind.config.js`, kept in sync with `mobile/src/theme/glass.ts`.
