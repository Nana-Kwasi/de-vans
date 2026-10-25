import Constants from "expo-constants";

/**
 * App config read from app.json / app.config.js "extra".
 *
 * apiBaseUrl resolution (so a physical device can always reach the dev backend):
 *  1. If EXPO_PUBLIC_API_BASE_URL is set to a real host (not localhost), use it.
 *  2. Otherwise, in dev, derive the host from the Metro/Expo connection — the
 *     same LAN IP the phone already used to load the app — and hit :8080 there.
 *     (On a simulator that host is localhost, which is correct.)
 *  3. Fall back to localhost.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiBaseUrlPinned?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const API_PORT = 8080;

function metroHost(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  return hostUri?.split(":")[0];
}

function resolveApiBaseUrl(): string {
  // An explicitly pinned EXPO_PUBLIC_API_BASE_URL wins, so a dev build can be pointed
  // at the deployed backend. The "a pinned URL goes stale" worry applies to a LAN IP,
  // not to a Cloud Run URL — and unpinned is still the default, so the Metro host
  // remains the behaviour when nothing is set.
  if (extra.apiBaseUrlPinned && extra.apiBaseUrl) return extra.apiBaseUrl;
  // In dev, reuse the machine that's serving Metro — it's the current host, so a
  // changing Wi-Fi/LAN IP never breaks the connection.
  const host = metroHost();
  if (host) return `http://${host}:${API_PORT}`;
  // Standalone/production build (no Metro): use the configured URL, else localhost.
  return extra.apiBaseUrl ?? `http://localhost:${API_PORT}`;
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  supabaseUrl: extra.supabaseUrl ?? "",
  supabaseAnonKey: extra.supabaseAnonKey ?? "",
};

/**
 * When true, "Pay" opens a fake sheet that never reaches the server — the order then
 * stays unpaid (no confirmation email, kitchen not alerted, can't go to riders). Keep it
 * false: Paystack's checkout is used, in test mode while the server has a sk_test_ key.
 */
export const SIMULATE_PAYMENTS = false;

/**
 * Resolve a menu image URL. Backend-served images (".../uploads/x.jpg") are
 * re-pointed at the app's current API host, so an image the admin uploaded from
 * a `localhost` browser still loads on a phone. External URLs pass through.
 */
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const i = url.indexOf("/uploads/");
  if (i >= 0) return base + url.slice(i);
  if (url.startsWith("/")) return base + url;
  return url;
}

/** Public site used for shared links. The app registers this host for deep linking, so
 *  a recipient with the app installed lands on the dish; everyone else gets the web
 *  page, which offers to open the app. */
export const SHARE_BASE = "https://qookaqooks.web.app";
