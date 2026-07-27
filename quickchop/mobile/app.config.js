// Dynamic Expo config: merges app.json and injects secrets from environment
// variables (see .env.example). Values fall back to app.json "extra" defaults.
const appJson = require("./app.json");

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? appJson.expo.extra.apiBaseUrl,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? appJson.expo.extra.supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? appJson.expo.extra.supabaseAnonKey,
  },
});
