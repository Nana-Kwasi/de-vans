# QuickChop Mobile (Expo / React Native)

The customer app: browse the menu, order, pay with Paystack, and track delivery.
Talks only to the Spring Boot API; uses Supabase purely for phone-OTP auth.

## Setup
```bash
cd mobile
npm install
cp .env.example .env    # fill in API URL + Supabase anon key
npm start               # then press i (iOS), a (Android), or scan with Expo Go
```

> On a physical phone, set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN IP
> (e.g. `http://192.168.1.5:8080`) — `localhost` points at the phone itself.

## What's here
- **Glassmorphism theme** — `src/theme/glass.ts` (shared token set, mirrored by the web dashboard). Frosted `GlassCard` (expo-blur) over a warm orange→cream `LinearGradient` background, pill buttons, soft shadows, rounded corners.
- **Screens** (`src/screens`), in journey order: SignUp (email/password + Google) → Home/Menu → ItemDetail → Cart → DeliveryDetails → Payment → OrderTracking (live status stepper, polls every 5s) → OrderHistory (with Reorder).
- **State** — React Query for server data, Zustand for the cart (`src/store/cart.ts`) and auth session (`src/store/auth.ts`).
- **API** — `src/api/` axios client attaches the Supabase JWT as a Bearer token.
- **Push** — `src/hooks/usePushToken.ts` registers the device token with the backend for FCM order updates.

## Notes
- Sign-in is **email/password + Google** (Supabase Auth). Email works out of the box; for Google, set up a Google OAuth client in Supabase — see `SETUP.md` §3.
- Payment uses Paystack test mode; the app opens Paystack's checkout in a browser, then the backend verifies the result (never trusts the client).
