import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeliveriesApi, OrdersApi, RidersApi } from "@/api/endpoints";
import { AdminOrderDetail, CustomerInsights, OrderStatus } from "@/api/types";
import { money, dateTime, parseOrderMeta } from "@/theme/format";
import { STATUS_STYLE, ago, isTerminal, nextStatus, statusLabel } from "@/theme/orders";
import { DELIVERY_LABEL, DELIVERY_STYLE, accuracyLabel, timeAgo } from "@/theme/delivery";
import { DeliveryMap, MapMarker } from "@/components/DeliveryMap";
import { Stars } from "@/components/Stars";

const apiError = (e: any) => e?.response?.data?.message ?? "Something went wrong.";

const SEGMENT: Record<CustomerInsights["segment"], { label: string; style: string }> = {
  NEW: { label: "🆕 New customer", style: "bg-blue-100 text-blue-700" },
  RETURNING: { label: "🔁 Returning", style: "bg-amber-100 text-amber-800" },
  LOYAL: { label: "⭐ Loyal", style: "bg-emerald-100 text-emerald-700" },
};

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => OrdersApi.detail(id),
    refetchInterval: 5000,
  });
  const { data: riders = [] } = useQuery({ queryKey: ["riders"], queryFn: RidersApi.list, enabled: !!data && !data.order.pickup });

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-detail", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setDispatchOpen(false);
      setNote("");
    },
    onError: (e) => window.alert(apiError(e)),
  });

  if (isLoading) return <p className="font-semibold text-ink-muted">Loading order…</p>;
  if (isError || !data) {
    return (
      <div className="card p-10 text-center">
        <p className="font-bold text-ink">Order not found.</p>
        <Link to="/orders" className="btn-primary mt-4 inline-block">Back to orders</Link>
      </div>
    );
  }

  const { order, customer, delivery } = data;
  const next = nextStatus(order);
  const terminal = isTerminal(order.status);
  const withRiders = !!delivery && delivery.status !== "CANCELLED" && delivery.status !== "DELIVERED";
  const canDispatch = !order.pickup && !withRiders && (order.status === "ORDER_RECEIVED" || order.status === "PREPARING");
  const meta = parseOrderMeta(order);
  const updateStatus = (s: OrderStatus) => act.mutate(() => OrdersApi.updateStatus(order.id, s));

  return (
    <div className="mx-auto max-w-6xl">
      <button onClick={() => navigate(-1)} className="mb-3 text-sm font-bold text-ink-muted hover:text-ink">← Back</button>

      {/* Header + actions */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-ink">{order.orderNumber}</h1>
              <span className={`chip ${STATUS_STYLE[order.status]}`}>{statusLabel(order.status, order.pickup)}</span>
              <span className={`chip ${order.pickup ? "bg-indigo-100 text-indigo-700" : "bg-brand-soft text-brand"}`}>
                {order.pickup ? "🏪 Self-pickup" : "🛵 Delivery"}
              </span>
              <span className={`chip ${data.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {data.paid ? "✅ Paid" : "Unpaid"}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Placed {dateTime(order.createdAt)} · {ago(order.createdAt)}</p>
          </div>
          <p className="text-2xl font-black text-ink">{money(order.total)}</p>
        </div>

        {!terminal && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
            {next && (
              <button disabled={act.isPending} onClick={() => updateStatus(next)} className="btn-primary">
                Mark {statusLabel(next, order.pickup).toLowerCase()}
              </button>
            )}
            {canDispatch && order.status === "PREPARING" && !dispatchOpen && (
              <button
                disabled={act.isPending || !data.paid}
                title={data.paid ? undefined : "Riders never collect money — wait for the customer's payment"}
                onClick={() => setDispatchOpen(true)}
                className="btn-primary"
              >
                🛵 Send to riders
              </button>
            )}
            {canDispatch && !data.paid && (
              <span className="self-center text-xs font-bold text-red-600">Not paid yet — can't send to riders until payment is confirmed.</span>
            )}
            {!withRiders && (
              <button
                disabled={act.isPending}
                onClick={() => window.confirm(`Cancel ${order.orderNumber}? The customer will be notified.`) && updateStatus("CANCELLED")}
                className="btn-ghost text-red-600"
              >
                Cancel order
              </button>
            )}
          </div>
        )}
        {dispatchOpen && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-canvas p-3 sm:flex-row">
            <input
              autoFocus
              className="input flex-1 bg-white"
              placeholder='Note for the rider (optional) — e.g. "2 bags, keep soup upright"'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button onClick={() => setDispatchOpen(false)} className="btn-ghost flex-1">Back</button>
              <button
                disabled={act.isPending}
                onClick={() => act.mutate(() => DeliveriesApi.dispatch(order.id, note.trim() || undefined))}
                className="btn-primary flex-1 whitespace-nowrap"
              >
                Send to all riders
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: the order */}
        <div className="space-y-5 lg:col-span-2">
          <Section title="Items">
            <ul className="divide-y divide-hairline">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span className="text-ink">
                    <b>{it.quantity}×</b> {it.name}
                    {it.addOns && <span className="block text-xs text-ink-muted">+ {it.addOns}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-ink">{money(it.unitPrice * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-1 border-t border-hairline pt-3 text-sm">
              <Line label="Subtotal" value={money(order.subtotal)} />
              <Line label="Delivery fee" value={Number(order.deliveryFee) === 0 ? "Free" : money(order.deliveryFee)} />
              <div className="flex justify-between text-base font-black text-ink"><span>Total</span><span>{money(order.total)}</span></div>
            </div>
            {meta.note && <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm text-ink-soft">📝 {meta.note}</p>}
          </Section>

          {!order.pickup && (
            <Section title="Delivery">
              <DeliveryBlock data={data} />
              {delivery && withRiders && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
                  {(delivery.status === "OPEN" || delivery.status === "ASSIGNED") && (
                    <div className="flex w-full gap-2 sm:w-auto">
                      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="input flex-1 py-2 text-sm sm:w-48">
                        <option value="">Assign to rider…</option>
                        {riders.filter((r) => r.active).map((r) => (
                          <option key={r.id} value={r.id}>{r.fullName}{r.online ? " ●" : ""}{r.activeDeliveries ? ` (${r.activeDeliveries} active)` : ""}</option>
                        ))}
                      </select>
                      <button disabled={!assignTo || act.isPending} onClick={() => act.mutate(() => DeliveriesApi.assign(delivery.id, assignTo))} className="btn-primary py-2 text-sm">Assign</button>
                    </div>
                  )}
                  {delivery.status === "ASSIGNED" && (
                    <button disabled={act.isPending} onClick={() => act.mutate(() => DeliveriesApi.unassign(delivery.id))} className="btn-ghost py-2 text-sm">Unassign</button>
                  )}
                  {(delivery.status === "OPEN" || delivery.status === "ASSIGNED") && (
                    <button
                      disabled={act.isPending}
                      onClick={() => window.confirm("Recall from riders? The order goes back to Preparing.") && act.mutate(() => DeliveriesApi.recall(delivery.id))}
                      className="btn-ghost py-2 text-sm text-red-600"
                    >
                      Recall
                    </button>
                  )}
                  {delivery.status !== "OPEN" && (
                    <button
                      disabled={act.isPending}
                      onClick={() => window.confirm("Mark delivered without the customer's code? Only if you've confirmed with the customer.") && act.mutate(() => DeliveriesApi.complete(delivery.id))}
                      className="btn-ghost py-2 text-sm text-emerald-700"
                    >
                      Mark delivered
                    </button>
                  )}
                </div>
              )}
            </Section>
          )}

          <Section title="Timeline">
            <ol className="space-y-2.5">
              {(order.history ?? []).map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="flex-1 font-semibold text-ink">{statusLabel(h.status, order.pickup)}</span>
                  <span className="text-xs text-ink-muted">{dateTime(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </Section>

          {(data.payments.length > 0 || data.review) && (
            <Section title="Payment & feedback">
              {data.payments.map((p) => (
                <div key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-hairline py-2 text-sm last:border-0">
                  <span className="text-ink">{p.method.replace(/_/g, " ").toLowerCase()} · {p.provider}</span>
                  <span className="text-ink-muted">{p.providerReference}</span>
                  <span className={`chip ${p.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : p.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {p.status} · {money(p.amount)}
                  </span>
                </div>
              ))}
              {data.review && (
                <div className="mt-3 rounded-xl bg-canvas p-3">
                  <Stars value={data.review.rating} size="text-sm" />
                  {data.review.comment && <p className="mt-1 text-sm text-ink">{data.review.comment}</p>}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Right: the customer */}
        <CustomerPanel c={customer} phone={order.contactPhone ?? meta.phone} currentId={order.id} />
      </div>
    </div>
  );
}

function DeliveryBlock({ data }: { data: AdminOrderDetail }) {
  const { order, delivery } = data;
  const acc = accuracyLabel(order.deliveryAccuracyM);
  const markers: MapMarker[] = [];
  if (delivery) markers.push({ key: "store", kind: "store", point: { lat: delivery.pickupLat, lng: delivery.pickupLng }, label: delivery.pickupName });
  if (order.deliveryLat != null && order.deliveryLng != null) {
    markers.push({ key: "drop", kind: "dropoff", point: { lat: order.deliveryLat, lng: order.deliveryLng, accuracyM: order.deliveryAccuracyM }, label: order.deliveryAddress });
  }
  if (delivery?.riderLocation) markers.push({ key: "rider", kind: "rider", point: delivery.riderLocation, label: delivery.riderName ?? "Rider" });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink"><b>Address:</b> {order.deliveryAddress}</p>
      <p className={`text-xs font-bold ${order.deliveryLat == null ? "text-amber-600" : acc?.poor ? "text-amber-600" : "text-emerald-600"}`}>
        📍 {order.deliveryLat == null ? "No GPS pin — rider will use the address" : `GPS pin ${acc?.text ?? "set by customer"}`}
      </p>
      {order.deliveryTimeNote && <p className="text-ink-soft"><b className="text-ink">When:</b> {order.deliveryTimeNote}</p>}
      {markers.length > 0 && <DeliveryMap markers={markers} height={240} />}
      {delivery ? (
        <div className="rounded-xl bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-ink">🛵 {delivery.riderName ?? "No rider yet"}</span>
            <span className={`chip ${DELIVERY_STYLE[delivery.status]}`}>{DELIVERY_LABEL[delivery.status]}</span>
          </div>
          {delivery.riderPhone && <a href={`tel:${delivery.riderPhone}`} className="font-semibold text-brand">{delivery.riderPhone}</a>}
          {delivery.riderLocation && <p className="text-xs text-ink-muted">Location updated {timeAgo(delivery.riderLocation.at)}</p>}
          <p className="mt-1 text-xs text-ink-muted">
            Rider fee {money(delivery.riderFee)}{delivery.tripKm != null ? ` · ${delivery.tripKm} km` : ""}
            {delivery.dispatchNote ? ` · note: ${delivery.dispatchNote}` : ""}
          </p>
          {delivery.pinLocked && <p className="mt-1 font-bold text-red-600">Rider entered the wrong code 5 times — confirm with the customer.</p>}
        </div>
      ) : (
        <p className="text-ink-muted">Not sent to riders yet.</p>
      )}
    </div>
  );
}

function CustomerPanel({ c, phone, currentId }: { c: CustomerInsights; phone?: string | null; currentId: string }) {
  const seg = SEGMENT[c.segment];
  const stats: [string, string][] = [
    ["Orders", String(c.orderCount)],
    ["Total spent", money(c.totalSpent)],
    ["Avg. order", money(c.avgOrderValue)],
    ["Completed", String(c.completedCount)],
    ["Cancelled", String(c.cancelledCount)],
    ["Rating given", c.avgRating != null ? `${c.avgRating} ★ (${c.reviewCount})` : "—"],
    ["Delivery / pickup", `${c.deliveryCount} / ${c.pickupCount}`],
    ["Last order", c.daysSinceLastOrder == null ? "—" : c.daysSinceLastOrder === 0 ? "Today" : `${c.daysSinceLastOrder} days ago`],
  ];
  return (
    <div className="space-y-5">
      <Section title="Customer">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-black text-brand">
            {c.customer.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-ink">{c.customer.fullName}</p>
            <span className={`chip ${seg.style}`}>{seg.label}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {phone && <a href={`tel:${phone}`} className="block font-semibold text-brand">📞 {phone}</a>}
          {c.customer.email && <a href={`mailto:${c.customer.email}`} className="block truncate text-ink-soft">✉️ {c.customer.email}</a>}
          <p className="text-xs text-ink-muted">Customer since {c.firstOrderAt ? dateTime(c.firstOrderAt) : dateTime(c.customer.createdAt)}</p>
          {c.openTickets > 0 && <p className="text-xs font-bold text-red-600">⚠️ {c.openTickets} open support ticket{c.openTickets === 1 ? "" : "s"}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas p-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
              <p className="text-sm font-black text-ink">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {c.favouriteItems.length > 0 && (
        <Section title="Usually orders">
          {c.favouriteItems.map((f) => (
            <div key={f.name} className="flex justify-between py-1 text-sm">
              <span className="text-ink">{f.name}</span>
              <span className="font-bold text-ink-muted">×{f.quantity}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Recent orders">
        {c.recentOrders.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className={`flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-canvas ${o.id === currentId ? "bg-brand-soft/50" : ""}`}
          >
            <span>
              <b className="text-ink">{o.orderNumber}</b> <span className="text-xs text-ink-muted">{ago(o.createdAt)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className={`chip text-[11px] ${STATUS_STYLE[o.status]}`}>{statusLabel(o.status, o.pickup)}</span>
              <span className="font-bold text-ink">{money(o.total)}</span>
            </span>
          </Link>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
