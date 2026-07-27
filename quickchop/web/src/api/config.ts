export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080",
  ordersRefreshMode: (import.meta.env.VITE_ORDERS_REFRESH_MODE ?? "poll") as "poll" | "realtime",
  ordersPollMs: Number(import.meta.env.VITE_ORDERS_POLL_MS ?? 5000),
};
