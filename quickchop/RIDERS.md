# Rider module

Riders deliver orders; customers follow them live. Riders **cannot sign up** — an admin
creates every rider account.

## The flow

| Step | Who | Order status (customer sees) | Delivery status |
|---|---|---|---|
| Customer checks out with **Delivery**, confirms a GPS pin | Customer | Order received | — |
| Kitchen marks **Preparing** | Admin | Preparing | — |
| Food ready → **🛵 Send to riders** (optional note) | Admin | Finding a rider | OPEN — shown to **every** rider |
| First rider taps **Accept** — it disappears for everyone else | Rider | Rider assigned (+ name, phone, vehicle, plate) | ASSIGNED |
| **I've picked up the food** | Rider | On the way + live map/ETA + **delivery code** emailed | PICKED_UP |
| **I've arrived** | Rider | "Your rider has arrived" | ARRIVED |
| Rider enters the customer's **4-digit code** | Rider | Delivered | DELIVERED |

Every step is timestamped and the rider's GPS trail is stored per delivery.

Admin can also: assign a job to a specific rider, unassign it (back to the pool), recall it
(back to Preparing), or **Mark delivered** without the code after confirming by phone.

## Screens

**Rider portal** — `https://<dashboard-url>/rider` (phone-first; riders "Add to Home Screen")
- Sign in (phone + password) → forced password change on first sign-in
- Home: online/offline switch, GPS status, current delivery, today/week earnings
- Requests: live pool (fee, km, pickup → drop-off, items, cash to collect), chime + vibrate on new requests
- Delivery: map, step tracker, one big action button, navigate (Google Maps) to store/customer,
  call/text customer, items, notes, payment/cash to collect, code entry, release before pickup
- Earnings: today / week / all-time + completed list
- Account: details, change password, sign out (all devices)

**Admin dashboard**
- **Riders**: add (temporary password shown once + copyable message), edit, reset password,
  deactivate/reactivate, history and earnings, online/last-seen/locked status
- **Deliveries**: live map of online riders + drop-offs, active jobs with assign/unassign/recall/complete,
  7-day history with each delivery's route trail
- **Live Orders**: "Send to riders" on preparing delivery orders; rider card on each order

**Customer app**: checkout takes a high-accuracy GPS fix and lets the customer drag the pin to
their gate; tracking shows the rider card (name, vehicle, plate, call/message), live map, ETA,
delivery code, and "Moved? Update my delivery location".

## Security

- Separate rider login and token (issuer `quickchop-rider`, own key); a rider token can never reach
  admin or customer routes. Rider tokens are checked against the database on every request, so
  **deactivate / reset password / sign out takes effect immediately**.
- Temporary passwords must be changed before any other rider action (enforced server-side).
- Account lockout: 5 wrong passwords → 15 min lock (admins and riders). Admin reset unlocks a rider.
- Rate limiting per IP: sign-in 10/min, password reset 5/15 min, code entry 10/min, API 300/min (429 + Retry-After).
  Spoofed `X-Forwarded-For` values are ignored.
- Accepting a job is a single atomic database update — two riders can never both get it.
- Riders only see a job's customer name/phone after accepting it; only the assigned rider can act on it.
  Customers see the rider's location only while that rider holds their order.
- Proof of delivery: 4-digit code, 5 attempts max, then admin must confirm.
- Security headers (HSTS, frame, referrer, permissions policy), CSP on the built dashboard,
  500 errors no longer leak internal messages.

## Deploying

1. **Backend** — Flyway migration `V18__riders_and_deliveries.sql` runs on start. New optional env vars
   (see `backend/.env.example`): `RIDER_JWT_SECRET`, `RIDER_MAX_ACTIVE_DELIVERIES` (default 1),
   `RIDER_REQUIRE_PIN`, `RATE_LIMIT_*`, `SWAGGER_ENABLED` (**set `false` in production**).
   Also set `CORS_ALLOWED_ORIGINS` to the dashboard URL.
2. **Web** — rebuild and redeploy (rider portal ships inside the dashboard at `/rider`).
   The host must serve `index.html` for unknown paths (SPA fallback) so `/rider/...` links work.
   If the host can set headers, add `X-Frame-Options: DENY`.
3. **Mobile** — new native module (`react-native-maps`): needs a **new build**, not an OTA update.
   Android needs `GOOGLE_MAPS_ANDROID_API_KEY` (Maps SDK for Android) or maps render blank; iOS needs nothing.

## Known limits

- The rider portal is a web page: location is shared while it is open (the screen is kept awake
  during a delivery). A native rider app is the upgrade if riders need background tracking.
- Rate limits are per server instance (lockouts are global, in the database).
- Rider pay = the order's delivery fee.
