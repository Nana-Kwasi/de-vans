import { useEffect } from "react";
import * as Linking from "expo-linking";
import { createSessionFromUrl } from "./authLinks";

/**
 * Completes an auth flow that finished in the browser or an email client.
 *
 * Without this, tapping "Confirm your email" opens the app and nothing happens: the
 * confirmation URL carries the token, and if no one reads it the account is verified
 * on Supabase's side while the app stays signed out.
 *
 * Covers both entry points — a cold start (the link launched the app) and a warm one
 * (the app was already open) — because they surface through different APIs.
 */
export function useAuthDeepLink() {
  // The URL that launched the app, if any. Null on a normal launch.
  const initialUrl = Linking.useURL();

  useEffect(() => {
    if (!initialUrl) return;
    createSessionFromUrl(initialUrl).catch((e) => {
      // A deep link with no auth payload is normal; only log real failures.
      console.warn("[auth] could not complete sign-in from link:", e?.message ?? e);
    });
  }, [initialUrl]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      createSessionFromUrl(url).catch((e) => {
        console.warn("[auth] could not complete sign-in from link:", e?.message ?? e);
      });
    });
    return () => sub.remove();
  }, []);
}
