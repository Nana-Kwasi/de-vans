import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OrdersApi, ReviewsApi } from "@/api/endpoints";
import { config } from "@/api/config";
import { Order, OrderStatus, Review } from "@/api/types";
import { money, dateTime, parseOrderMeta } from "@/theme/format";
import { Stars } from "@/components/Stars";

const FILTERS: { label: string; value?: OrderStatus }[] = [
  { label: "All" },
  { label: "Received", value: "ORDER_RECEIVED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Ready (pickup)", value: "READY" },
  { label: "Cancelled", value: "CANCELLED" },
];

// Pickup and delivery advance through different flows.
const NEXT_DELIVERY: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_RECEIVED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};
const NEXT_PICKUP: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_RECEIVED: "PREPARING",
  PREPARING: "READY",
};
const nextStatus = (order: Order): OrderStatus | undefined =>
  (order.pickup ? NEXT_PICKUP : NEXT_DELIVERY)[order.status];

// PREPARING reads as "Processing" for pickup, "Preparing" for delivery.
const statusLabel = (status: OrderStatus, pickup: boolean): string => {
  if (status === "PREPARING" && pickup) return "Processing";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "bg-amber-100 text-amber-700",
  PREPARING: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  READY: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function LiveOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | undefined>(undefined);
  const qc = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => OrdersApi.list(filter),
    refetchInterval: config.ordersRefreshMode === "poll" ? config.ordersPollMs : false,
  });
  const { data: reviews } = useQuery({ queryKey: ["reviews"], queryFn: ReviewsApi.list });
  const reviewByOrder = new Map<string, Review>();
  (reviews ?? []).forEach((r) => r.orderId && reviewByOrder.set(r.orderId, r));

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => OrdersApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Live orders</h1>
        <span className="hidden text-xs font-semibold text-ink-muted sm:block">
          Auto-refreshing every {Math.round(config.ordersPollMs / 1000)}s
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter === f.value ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft hover:bg-canvas"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading orders…</p>
      ) : !orders?.length ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No orders here yet.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              review={reviewByOrder.get(order.id)}
              onAdvance={(status) => mutation.mutate({ id: order.id, status })}
              busy={mutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, review, onAdvance, busy }: { order: Order; review?: Review; onAdvance: (s: OrderStatus) => void; busy: boolean }) {
  const isPickup = order.pickup;
  const next = nextStatus(order);
  const terminal = order.status === "DELIVERED" || order.status === "READY" || order.status === "CANCELLED";
  const meta = parseOrderMeta(order);

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-black text-ink">{order.orderNumber}</span>
        <span className={`chip ${STATUS_STYLE[order.status]}`}>{statusLabel(order.status, isPickup)}</span>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`chip ${isPickup ? "bg-indigo-100 text-indigo-700" : "bg-brand-soft text-brand"}`}>
          {isPickup ? "🏪 Self-pickup" : "🛵 Delivery"}
        </span>
        <span className="text-xs font-semibold text-ink-muted">{dateTime(order.createdAt)}</span>
      </div>

      <ul className="mb-3 space-y-1">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between text-sm text-ink">
            <span className="font-semibold">
              {it.quantity}× {it.name}
              {it.addOns ? <span className="text-ink-muted"> ({it.addOns})</span> : null}
            </span>
            <span className="font-bold">{money(it.unitPrice * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-hairline pt-3 text-sm">
        <div className="text-ink-soft">
          <span className="font-bold text-ink">{isPickup ? "Pickup:" : "Deliver to:"}</span> {order.deliveryAddress}
        </div>
        {meta.phone && (
          <div className="text-ink-soft">
            <span className="font-bold text-ink">Contact:</span>{" "}
            <a href={`tel:${meta.phone}`} className="font-semibold text-brand">{meta.phone}</a>
          </div>
        )}
        {order.deliveryTimeNote && (
          <div className="text-ink-soft"><span className="font-bold text-ink">When:</span> {order.deliveryTimeNote}</div>
        )}
      </div>

      {meta.note && (
        <div className="mt-2 rounded-xl bg-canvas px-3 py-2 text-sm text-ink-soft">📝 {meta.note}</div>
      )}

      <div className="mt-3 space-y-1 border-t border-hairline pt-3 text-sm">
        <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        <div className="flex justify-between text-ink-soft">
          <span>Delivery fee</span>
          <span className={Number(order.deliveryFee) === 0 ? "font-semibold text-emerald-600" : ""}>
            {Number(order.deliveryFee) === 0 ? "Free" : money(order.deliveryFee)}
          </span>
        </div>
        <div className="flex justify-between text-base font-black text-ink"><span>Total</span><span>{money(order.total)}</span></div>
      </div>

      {review && (
        <div className="mt-3 rounded-xl bg-canvas p-3">
          <div className="flex items-center gap-2">
            <Stars value={review.rating} size="text-sm" />
            <span className="text-xs font-bold text-ink-muted">Customer review</span>
          </div>
          {review.comment && <p className="mt-1 text-sm text-ink">{review.comment}</p>}
        </div>
      )}

      {!terminal && (
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => onAdvance("CANCELLED")}
            className="btn-ghost flex-1 py-2 text-sm text-red-600"
          >
            Cancel
          </button>
          {next && (
            <button disabled={busy} onClick={() => onAdvance(next)} className="btn-primary flex-1 py-2 text-sm">
              Mark {statusLabel(next, isPickup).toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
