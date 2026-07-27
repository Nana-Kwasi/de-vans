import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { getQueryParams } from "expo-auth-session/build/QueryParams";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Lets the auth browser tab close itself and hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

// Redirects back into the app via the "quickchop" scheme (see app.json).
const redirectTo = AuthSession.makeRedirectUri();

/** Turns the OAuth redirect URL (with tokens) into a Supabase session. */
async function createSessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

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
