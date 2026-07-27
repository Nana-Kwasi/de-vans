# QuickChop 🍚

A food-ordering system for a small home-kitchen business selling three meals:
**Plain Rice with Stew**, **Jollof Rice with Chicken**, and **Fried Rice**.
Prices in **GHS**. Part of the **De-VANS** project folder.

## Three parts

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](./backend) | REST API — the single source of truth | Java 21 · Spring Boot 3.3 · JPA · Flyway · Supabase Postgres |
| [`mobile/`](./mobile) | Customer app — browse, order, pay, track | Expo · React Native · TypeScript |
| [`web/`](./web) | Owner dashboard — orders, menu, sales | React · Vite · TypeScript · Tailwind |

The mobile app and web dashboard **only** talk to the backend. Supabase provides
Postgres hosting, email/password + Google auth (JWTs), and storage — never accessed directly
for data by the frontends.

## Build order (as delivered)
1. **Backend** — built and verified first (compiles + runs; endpoints tested via Swagger UI). ✅
2. **Mobile app** — full screen flow, glassmorphism UI. ✅
3. **Web dashboard** — glassmorphism UI matching the app. ✅

## Quick start (local demo, no cloud accounts)
```bash
# 1) Backend on H2 (seeds admin + the 3 meals)
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local
#    Swagger UI: http://localhost:8080/swagger-ui.html
#    Admin: franciskontoh4@gmail.com / 0000000000

# 2) Web dashboard
cd web && npm install && npm run dev        # http://localhost:5173

# 3) Mobile app
cd mobile && npm install && npm start
```

To go live, plug real Supabase, Paystack, and (optionally) FCM credentials into
each package's `.env` — see the `.env.example` files. The seeded admin password
**must be changed after first login** (`PATCH /api/admin/change-password`, also
available from the dashboard).

## Security notes
- Two separate auth paths: customers use Supabase email/password + Google JWTs (validated via
  JWKS); the admin logs in with email + password and receives the backend's own
  signed JWT.
- The admin account exists only as a seeded, BCrypt-hashed row in `admin_users`
  — never as plaintext in code or config.
- All secrets come from environment variables.

See each folder's README for details.
