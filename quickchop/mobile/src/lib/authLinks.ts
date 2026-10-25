import { getQueryParams } from "expo-auth-session/build/QueryParams";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Turns a URL Supabase redirected back into the app into a signed-in session.
 *
 * Two shapes arrive here, and which one depends on the project's auth settings
 * rather than on anything the app does, so both are handled:
 *
 *  - Implicit flow (OAuth, and email confirmation on older projects): the tokens
 *    themselves come back as `access_token` / `refresh_token`.
 *  - PKCE / token-hash flow (email confirmation on current projects): a single-use
 *    `token_hash` comes back and has to be exchanged via verifyOtp.
 *
 * Returns null when the URL carries no auth payload — most deep links do not.
 */
export async function createSessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  // Supabase reports failures as query params, not as an errorCode.
  if (params.error || params.error_description) {
    throw new Error(params.error_description ?? params.error);
  }

  const { access_token, refresh_token, token_hash, type } = params;

  if (access_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return data.session;
  }

  if (token_hash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      // `signup` covers email confirmation; recovery and invite arrive the same way.
      type: (type as any) ?? "signup",
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}
