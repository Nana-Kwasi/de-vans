import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { createSessionFromUrl } from "./authLinks";

// Lets the auth browser tab close itself and hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

// Redirects back into the app via the "quickchop" scheme (see app.json).
export const redirectTo = AuthSession.makeRedirectUri();

console.log("[auth] redirectTo =", redirectTo);
console.log("[auth] executionEnvironment =", Constants.executionEnvironment);

/**
 * Opens Google's consent screen (via Supabase OAuth) and, on success, sets the
 * Supabase session. Requires the Google provider to be enabled in Supabase with
 * a Google Cloud OAuth client (see SETUP.md).
 */
export async function signInWithGoogle(): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) return null;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success") {
    return createSessionFromUrl(result.url);
  }
  return null; // user cancelled
}
