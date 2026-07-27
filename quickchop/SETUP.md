# QuickChop — Setup Checklist

A step-by-step guide to going from the local demo to a real, connected app.
Do these **in order**. Each section says which `.env` value it produces.

Legend: ☐ = do this · 🔑 = produces an env var · ⚠️ = common gotcha

You only need **Supabase** to run the backend + admin dashboard. The SMS provider
and Paystack are for the customer flow; Firebase (push) is optional.

---

## 0. Run the local demo first (no accounts needed)

Prove everything works before touching any cloud service:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
# Swagger UI: http://localhost:8080/swagger-ui.html
# Admin login: franciskontoh4@gmail.com / 0000000000
```

If that works, continue below to connect real services.

---

## 1. Supabase — Postgres database

☐ Go to https://supabase.com → **New project**. Pick a name, a strong
**database password** (save it), and a region close to your customers.
🔑 `SUPABASE_DB_PASSWORD` = that database password.

☐ Find your **project ref**: Project Settings → **General** → "Reference ID".
It's a ~15-char string like `abcdefghijklmno`. You'll reuse it several times.

☐ Get the pooler connection: click the green **Connect** button (top of the
dashboard) → **Session pooler** tab. Note the **host** and **user**:
- Host looks like `aws-0-<region>.pooler.supabase.com`
- User looks like `postgres.<project-ref>`

🔑 Fill these into `backend/.env`:
```
SUPABASE_DB_URL="jdbc:postgresql://aws-0-YOUR-REGION.pooler.supabase.com:5432/postgres?sslmode=require&prepareThreshold=0"
SUPABASE_DB_USER=postgres.YOUR-PROJECT-REF
SUPABASE_DB_PASSWORD=your-db-password
```
⚠️ Use port **5432** (session pooler), keep the `?sslmode=require...` and the
quotes. The user is `postgres.<ref>`, **not** plain `postgres`.

☐ Test it:
```bash
cd backend
cp .env.example .env      # if you haven't already; then edit .env
set -a; source .env; set +a
mvn spring-boot:run       # NOTE: no -Dspring-boot.run.profiles=local this time
```
On success you'll see Flyway apply `V1/V2/V3` and `Started QuickchopApplication`.
The 3 meals + admin account are now seeded in your Supabase DB.

> Do **not** create tables in the Supabase Table Editor — Flyway owns the schema.

---

## 2. Supabase — Auth (email/password)

Customers sign in with **email + password** (and optionally Google, §3).
The backend validates the JWTs Supabase issues. Two values point at your
project's **API domain** (`<project-ref>.supabase.co`, *not* the pooler host):

🔑 `backend/.env`:
```
SUPABASE_JWKS_URI=https://YOUR-PROJECT-REF.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_ISSUER_URI=https://YOUR-PROJECT-REF.supabase.co/auth/v1
```
☐ Sanity check: paste `SUPABASE_JWKS_URI` into a browser — you should get JSON
containing a `"keys"` array.

☐ Email auth is **on by default** — nothing to enable. But decide about
confirmation: Dashboard → **Authentication** → **Providers** → **Email**:
- Leave **"Confirm email" ON** (safer): new users get a confirmation link and
  must click it before they can sign in. The app shows "confirm your email".
- Turn it **OFF** for the smoothest MVP: sign-up logs the customer straight in.
  Fine to start with; you can turn it back on later.

⚠️ If you leave "Confirm email" ON, also set **Authentication → URL
Configuration → Site URL / Redirect URLs** so the confirmation link returns to
your app: add `quickchop://*`.

### Values the MOBILE app needs (not the backend)
☐ Project Settings → **API**. Copy the **Project URL** and the **anon public**
(a.k.a. **publishable**, `sb_publishable_…`) key.
🔑 `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
EXPO_PUBLIC_API_BASE_URL=http://YOUR-COMPUTER-LAN-IP:8080
```
⚠️ On a real phone, `localhost` means the phone itself — use your computer's LAN
IP (macOS: `ipconfig getifaddr en0`), and make sure the phone is on the same Wi-Fi.

With just this, **email/password sign-in works**. Google (§3) is optional.

---

## 3. Google sign-in (optional) — the "Client IDs" screen

This is what that Google provider screen was asking for: a **Google Cloud OAuth
client**. Skip this section entirely if you only want email/password.

### 3a. Create the OAuth client in Google Cloud
☐ Go to https://console.cloud.google.com → create/select a project.
☐ **APIs & Services → OAuth consent screen** → set it up (External; add your
email as a test user while in "testing" mode).
☐ **APIs & Services → Credentials → Create credentials → OAuth client ID** →
application type **Web application**.
☐ Under **Authorized redirect URIs**, add your Supabase callback URL (shown on
the Supabase Google provider screen), e.g.:
```
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
```
☐ Create it, then copy the **Client ID** and **Client Secret**.

### 3b. Paste them into Supabase
☐ Supabase → **Authentication → Providers → Google** → toggle **Enable** on.
☐ **Client IDs** field ← paste the Client ID (the field you saw earlier).
☐ **Client Secret (for OAuth)** ← paste the Client Secret. **Save**.

### 3c. Allow the app's redirect
☐ Supabase → **Authentication → URL Configuration → Redirect URLs** → add:
```
quickchop://*
```
(That's the app's deep-link scheme, from `mobile/app.json`. Without it Supabase
rejects the sign-in redirect.)

☐ Test: in the app, tap **Continue with Google** → Google consent → you land
back signed in.

> No env var in QuickChop for Google — the Client ID/Secret live inside Supabase.
> The app just calls Supabase's Google OAuth, which uses them.

---

## 4. Supabase — Storage (menu photos) — optional

☐ Dashboard → **Storage** → **New bucket** → name it `menu-photos` → mark it
**Public** (so photo URLs load without a signed token).
☐ Upload a meal photo into the bucket → click it → **Copy URL**.
☐ Attach it to a menu item. Two easy ways:
- **Swagger:** `PATCH /api/menu/{id}` with body `{"photoUrl":"<the copied URL>"}`
  (Authorize with an admin token first — from `POST /api/admin/login`), or
- Ask me to add a "photo URL" field to the dashboard's Add/Edit item form.

The `menu_items.photo_url` column and the API already support this; the mobile
and web UIs render whatever URL is stored.

---

## 5. Admin session secret (generate — not an external service)

🔑 `backend/.env`:
```bash
openssl rand -base64 48    # copy the output
```
```
ADMIN_JWT_SECRET=paste-the-generated-string-here
```
⚠️ Must be ≥ 32 bytes. Keep it different from anything Supabase.

☐ After first admin login, **change the seeded password** (`0000000000`) via the
dashboard or `PATCH /api/admin/change-password`.

---

## 6. Paystack — payments (test mode)

☐ Create an account: https://paystack.com (Ghana supported, GHS).
☐ Dashboard → **Settings** → **API Keys & Webhooks** → copy the **Test Secret Key**
(`sk_test_...`).
🔑 `backend/.env`:
```
PAYSTACK_SECRET_KEY=<your-paystack-test-secret-key>
```
☐ Add the webhook: same page → **Webhook URL** → set it to your backend's public
URL + `/api/payments/paystack/webhook`.
⚠️ Paystack must reach your backend over the internet. On localhost, use a tunnel
(e.g. `ngrok http 8080`) and paste the tunnel URL. In production use your real
domain. The backend verifies the webhook signature, so only genuine Paystack
calls are accepted.
☐ Test with Paystack's test cards (e.g. `4084 0840 8408 4081`, any future expiry,
any CVV) — no real money moves.

---

## 7. Firebase Cloud Messaging (push) — optional, later

Order updates work without this (the app polls status). Add it when you want
real push notifications.

☐ Create a Firebase project (https://console.firebase.google.com), add your
Android/iOS app, and download the **service-account JSON** (Project Settings →
Service accounts → Generate new private key).
🔑 `backend/.env`:
```
FCM_CREDENTIALS_PATH=/absolute/path/to/service-account.json
```
☐ Then implement the actual send in `NotificationService` (it's a ready stub —
ask me and I'll wire in the Firebase Admin SDK).

---

## 8. Run everything

```bash
# Backend (real Supabase)
cd backend && set -a; source .env; set +a && mvn spring-boot:run

# Admin dashboard
cd web && cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:8080
npm install && npm run dev       # http://localhost:5173

# Mobile app
cd mobile && cp .env.example .env   # fill Supabase URL + anon key + API LAN IP
npm install && npm start
```

---

## Minimum to reach each milestone

| Goal | You need |
|---|---|
| Backend + admin dashboard on real data | Supabase (§1, §2 values, §5 secret) |
| Customers sign up (email/password) & order | §2 mobile values + Paystack test (§6) |
| "Continue with Google" button | + Google OAuth client (§3) |
| Menu photos | + Supabase Storage (§4) |
| Push notifications | + Firebase (§7) |

Stuck on any step? Paste the error output here (safe — no passwords in logs) and
I'll walk through it.
