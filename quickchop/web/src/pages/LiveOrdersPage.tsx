import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { OrdersApi } from "@/api/endpoints";
import { config } from "@/api/config";
import { Order, OrderStatus } from "@/api/types";
import { money, dateTime } from "@/theme/format";
import { STATUS_STYLE, ago, isTerminal, statusLabel } from "@/theme/orders";

type Filter = { label: string; value?: OrderStatus | "ACTIVE" };

const FILTERS: Filter[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "All" },
  { label: "Received", value: "ORDER_RECEIVED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Waiting for rider", value: "AWAITING_RIDER" },
  { label: "Rider assigned", value: "RIDER_ASSIGNED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Ready (pickup)", value: "READY" },
  { label: "Cancelled", value: "CANCELLED" },
];

const itemCount = (o: Order) => o.items.reduce((n, i) => n + i.quantity, 0);

/**
 * The order board: a compact, scannable list. Everything you can do to an order lives
 * on its detail screen (/orders/:id) — open a row to act on it.
 */
export function LiveOrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter["value"]>("ACTIVE");
  const [text, setText] = useState("");

  // One fetch for everything; filters are applied locally so counts stay visible on every chip.
  const { data: orders = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["orders", undefined],
    queryFn: () => OrdersApi.list(),
    refetchInterval: config.ordersRefreshMode === "poll" ? config.ordersPollMs : false,
  });

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    orders.forEach((o) => c.set(o.status, (c.get(o.status) ?? 0) + 1));
    c.set("ACTIVE", orders.filter((o) => !isTerminal(o.status)).length);
    c.set("ALL", orders.length);
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "ACTIVE" && isTerminal(o.status)) return false;
      if (filter && filter !== "ACTIVE" && o.status !== filter) return false;
      if (!t) return true;
      return [o.orderNumber, o.customerName, o.contactPhone, o.deliveryAddress, o.delivery?.riderName]
        .some((v) => v?.toLowerCase().includes(t));
    });
  }, [orders, filter, text]);

  const open = (o: Order) => navigate(`/orders/${o.id}`);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Live orders</h1>
          <p className="text-xs font-semibold text-ink-muted">
            {counts.get("ACTIVE") ?? 0} active · updated {dataUpdatedAt ? ago(new Date(dataUpdatedAt).toISOString()) : "—"} · refreshes every{" "}
            {Math.round(config.ordersPollMs / 1000)}s
          </p>
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by order #, name, phone…"
          className="input w-full py-2.5 sm:w-72"
        />
      </div>

      {/* Swipeable on phones, wrapping on wider screens. */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {FILTERS.map((f) => {
          const n = counts.get(f.value ?? "ALL") ?? 0;
          const active = filter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition ${
                active ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft hover:bg-canvas"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/25" : "bg-canvas text-ink-muted"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading orders…</p>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No orders here.</div>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="hidden px-4 py-3 text-right lg:table-cell">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 xl:table-cell">Rider</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => open(o)}
                    className="cursor-pointer border-b border-hairline last:border-0 hover:bg-brand-soft/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {o.status === "ORDER_RECEIVED" && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand" title="New" />}
                        <span className="font-black text-ink">{o.orderNumber}</span>
                      </div>
                      <span className="text-xs text-ink-muted" title={dateTime(o.createdAt)}>{ago(o.createdAt)}</span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate font-semibold text-ink">{o.customerName ?? "—"}</p>
                      <p className="truncate text-xs text-ink-muted">{o.contactPhone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${o.pickup ? "bg-indigo-100 text-indigo-700" : "bg-brand-soft text-brand"}`}>
                        {o.pickup ? "Pickup" : "Delivery"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-ink-soft lg:table-cell">{itemCount(o)}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{money(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`chip whitespace-nowrap ${STATUS_STYLE[o.status]}`}>{statusLabel(o.status, o.pickup)}</span>
                      {!o.paidAt && o.status !== "CANCELLED" && (
                        <span className="chip ml-1 whitespace-nowrap bg-red-50 text-red-600">Unpaid</span>
                      )}
                    </td>
                    <td className="hidden max-w-[160px] truncate px-4 py-3 text-ink-soft xl:table-cell">
                      {o.delivery?.riderName ?? (o.delivery?.status === "OPEN" ? "Finding…" : "—")}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: compact rows */}
          <div className="card divide-y divide-hairline md:hidden">
            {shown.map((o) => (
              <button key={o.id} onClick={() => open(o)} className="flex w-full items-center gap-3 p-3.5 text-left active:bg-canvas">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {o.status === "ORDER_RECEIVED" && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    <span className="font-black text-ink">{o.orderNumber}</span>
                    <span className="text-xs text-ink-muted">{ago(o.createdAt)}</span>
                  </div>
                  <p className="truncate text-sm text-ink-soft">
                    {o.customerName ?? "Customer"} · {o.pickup ? "Pickup" : "Delivery"} · {itemCount(o)} item{itemCount(o) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-ink">{money(o.total)}</p>
                  <span className={`chip whitespace-nowrap text-[11px] ${STATUS_STYLE[o.status]}`}>{statusLabel(o.status, o.pickup)}</span>
                  {!o.paidAt && o.status !== "CANCELLED" && <p className="mt-0.5 text-[11px] font-bold text-red-600">Unpaid</p>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
