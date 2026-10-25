import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Content-Security-Policy for production builds.
 *
 * Admin and rider session tokens live in localStorage, so cross-site scripting is the
 * main way one could be stolen; this policy stops injected or third-party scripts from
 * running and limits where the page may send data (only this site and the API).
 *
 * Build-only: Vite's dev server relies on inline scripts for hot reload, which the
 * policy would block. Hosts that can set headers should also send
 * `frame-ancestors 'none'` (meta tags cannot) — see web/README.md.
 */
function contentSecurityPolicy(apiBaseUrl: string): Plugin {
  const api = (() => {
    try {
      return new URL(apiBaseUrl).origin;
    } catch {
      return "";
    }
  })();
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Tailwind output is a file, but Leaflet positions map tiles with inline styles.
    "style-src 'self' 'unsafe-inline'",
    // Map tiles (OpenStreetMap) and menu photos (Supabase Storage) are remote images.
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${api}`.trim(),
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`
      ),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_BASE_URL ?? "http://localhost:8080")],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: { port: 5173 },
  };
});
