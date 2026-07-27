# QuickChop Backend (Spring Boot)

Java 21 · Spring Boot 3.3 · Spring Data JPA · Spring Security · Flyway · PostgreSQL (Supabase) · springdoc/Swagger

The single source of truth for the mobile app and the admin web dashboard.
Both frontends talk **only** to this API — never to Supabase directly for data.

## Run it

### Option A — Local demo (no Supabase/Paystack needed)
Uses an in-memory H2 database, disables Flyway, and seeds the admin + 3 meals.

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

- API:        http://localhost:8080
- Swagger UI:  http://localhost:8080/swagger-ui.html
- H2 console:  http://localhost:8080/h2-console  (JDBC URL `jdbc:h2:mem:quickchop`, user `sa`, no password)

Seeded admin login: `franciskontoh4@gmail.com` / `0000000000`

### Option B — Real Supabase Postgres
1. Copy `.env.example` to `.env` and fill in the values (Supabase DB, JWKS, Paystack, admin JWT secret).
2. Export them, e.g. `export $(grep -v '^#' .env | xargs)`.
3. Run: `mvn spring-boot:run`

On first run against Supabase, Flyway applies `V1__init_schema.sql`,
`V2__seed_admin.sql`, and `V3__seed_menu.sql`. **Do not** create tables in the
Supabase dashboard — Spring Boot + Flyway own the schema.

## Auth — two separate paths
- **Customers (mobile app):** sign in with Supabase Auth (email/password + Google) → Supabase
  JWT. This API validates it against Supabase's JWKS endpoint (`SUPABASE_JWKS_URI`).
- **Admin (web dashboard):** `POST /api/admin/login` with email + password
  (checked against the `admin_users` table via BCrypt) → this API issues its
  **own** HMAC-signed JWT (`ADMIN_JWT_SECRET`). Admin tokens are recognised by
  the issuer claim `quickchop-admin`; a single security filter chain routes each
  token type to the right validator.

> ⚠️ Change the seeded admin password after first login via
> `PATCH /api/admin/change-password`.

## Key endpoints
| Method | Path | Access |
|---|---|---|
| GET | `/api/menu` | Public |
| POST/PATCH | `/api/menu`, `/api/menu/{id}` | Admin |
| POST | `/api/customers`, GET `/api/customers/me` | Customer |
| POST | `/api/orders`, GET `/api/orders/me`, GET `/api/orders/{id}` | Customer |
| GET | `/api/orders`, PATCH `/api/orders/{id}/status` | Admin |
| POST | `/api/payments/paystack/initialize` | Customer |
| POST | `/api/payments/paystack/webhook` | Paystack (signed) |
| GET | `/api/payments/paystack/verify/{ref}` | Customer/Admin |
| POST | `/api/admin/login`, PATCH `/api/admin/change-password` | Public / Admin |
| GET | `/api/dashboard/summary`, `/api/admin/customers` | Admin |

Explore and try them all in Swagger UI.

## Payments (Paystack)
App calls `/initialize` → backend calls Paystack, returns the checkout URL →
customer pays → Paystack calls `/webhook` (signature verified with the secret
key) → backend marks the payment `SUCCESS`. The frontend is never trusted to
confirm payment on its own.

## Notifications (FCM)
`NotificationService` currently logs each push. To send real pushes, add the
Firebase Admin SDK, point `FCM_CREDENTIALS_PATH` at the service-account JSON,
and implement the `send(...)` call — the rest of the app already stores each
device's token and calls the service on every status change.

## Currency
All prices are in **GHS (Ghanaian Cedi)**. Business name is the single config
value `BUSINESS_NAME` (default `QuickChop`).
