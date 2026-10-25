// Dynamic Expo config. Expo reads app.json first and passes it in as `config`, so this
// extends the static config rather than re-reading the file — expo-doctor checks for
// exactly that, and a stray second read would silently diverge if app.json moved.
//
// Secrets and per-environment values come from EXPO_PUBLIC_* vars (see .env.example),
// falling back to the app.json "extra" defaults used by production builds.
module.exports = ({ config }) => ({
  ...config,
  // react-native-maps (rider tracking + delivery pin): iOS uses Apple Maps with no key;
  // Android builds need a Google Maps SDK key, or the map renders blank in release.
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "" },
    },
  },
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? config.extra.apiBaseUrl,
    // Whether the URL above was pinned by the environment rather than inherited from
    // app.json. config.ts needs the difference: a pinned URL beats the Metro host,
    // the app.json default does not (otherwise dev could never reach a local backend).
    apiBaseUrlPinned: Boolean(process.env.EXPO_PUBLIC_API_BASE_URL),
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? config.extra.supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? config.extra.supabaseAnonKey,
  },
});
