import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CustomersApi, OrdersApi, ReviewsApi } from "@/api/endpoints";
import { Customer, Order, OrderStatus, Review } from "@/api/types";
import { dateTime, money, parseOrderMeta } from "@/theme/format";
import { Stars } from "@/components/Stars";

const STATUS_STYLE: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "bg-amber-100 text-amber-700",
  PREPARING: "bg-blue-100 text-blue-700",
  AWAITING_RIDER: "bg-amber-100 text-amber-800",
  RIDER_ASSIGNED: "bg-sky-100 text-sky-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  READY: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

/** Phone/address fall back to the latest order when the profile is blank. */
function deriveContact(customer: Customer, orders: Order[]) {
  const mine = orders.filter((o) => o.customerId === customer.id);
  const phone = customer.phoneNumber || mine.map((o) => parseOrderMeta(o).phone).find(Boolean) || null;
  const address =
    customer.defaultAddress ||
    mine.find((o) => parseOrderMeta(o).fulfillment === "delivery")?.deliveryAddress ||
    null;
  return { phone, address, orders: mine };
}

export function CustomersPage() {
  const { data: customers, isLoading } = useQuery({ queryKey: ["customers"], queryFn: CustomersApi.list });
  const { data: orders } = useQuery({ queryKey: ["orders", undefined], queryFn: () => OrdersApi.list() });
  const { data: reviews } = useQuery({ queryKey: ["reviews"], queryFn: ReviewsApi.list });
  const [selected, setSelected] = useState<Customer | null>(null);
  // Global search links here as /customers?id=… — open that customer once the list loads.
  const [params, setParams] = useSearchParams();
  const wanted = params.get("id");
  useEffect(() => {
    const match = wanted && customers?.find((c) => c.id === wanted);
    if (match) {
      setSelected(match);
      setParams({}, { replace: true });
    }
  }, [wanted, customers, setParams]);
  const allOrders = orders ?? [];
  const allReviews = reviews ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Customers</h1>
        {customers && <span className="chip bg-brand-soft text-brand">{customers.length} total</span>}
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : !customers?.length ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No customers yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="hidden p-4 lg:table-cell">Phone</th>
                <th className="hidden p-4 md:table-cell">Address</th>
                <th className="hidden p-4 sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const { phone, address } = deriveContact(c, allOrders);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer border-b border-hairline last:border-0 hover:bg-canvas"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-black text-brand">
                          {(c.fullName?.[0] ?? "?").toUpperCase()}
                        </div>
                        <span className="font-bold text-ink hover:text-brand">{c.fullName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-ink-soft">{c.email ?? "—"}</td>
                    <td className="hidden p-4 text-ink-soft lg:table-cell">{phone ?? "—"}</td>
                    <td className="hidden max-w-[220px] truncate p-4 text-ink-soft md:table-cell">{address ?? "—"}</td>
                    <td className="hidden p-4 text-ink-muted sm:table-cell">{dateTime(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CustomerDrawer customer={selected} allOrders={allOrders} allReviews={allReviews} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CustomerDrawer({ customer, allOrders, allReviews, onClose }: { customer: Customer; allOrders: Order[]; allReviews: Review[]; onClose: () => void }) {
  const { phone, address, orders } = useMemo(() => deriveContact(customer, allOrders), [customer, allOrders]);
  const totalSpent = orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + Number(o.total), 0);
  const lastOrder = orders[0];
  const myReviews = allReviews.filter((r) => r.customerId === customer.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-canvas shadow-card">
        <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-surface px-5 py-4">
          <h2 className="text-lg font-black text-ink">Customer</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink-muted hover:text-ink">✕</button>
        </div>

        <div className="p-5">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-xl font-black text-brand">
                {(customer.fullName?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-ink">{customer.fullName}</p>
                <p className="truncate text-sm text-ink-muted">Joined {dateTime(customer.createdAt)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
              <Row label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined} />
              <Row label="Phone" value={phone} href={phone ? `tel:${phone}` : undefined} />
              <Row label="Address" value={address} />
            </div>

            <div className="mt-4 flex gap-2">
              {customer.email && <a href={`mailto:${customer.email}`} className="btn-primary flex-1 py-2 text-center text-sm">✉️ Email</a>}
              {phone && <a href={`tel:${phone}`} className="btn-ghost flex-1 py-2 text-center text-sm">📞 Call</a>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Orders" value={String(orders.length)} />
            <MiniStat label="Spent" value={money(totalSpent)} />
            <MiniStat label="Last" value={lastOrder ? new Date(lastOrder.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"} />
          </div>

          {myReviews.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-ink-muted">Reviews</h3>
              <div className="space-y-3">
                {myReviews.map((r) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} size="text-sm" />
                      {r.orderNumber && <span className="text-xs text-ink-muted">{r.orderNumber}</span>}
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-ink">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-ink-muted">Order history</h3>
          {!orders.length ? (
            <div className="card p-6 text-center text-sm font-semibold text-ink-muted">No orders yet.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const meta = parseOrderMeta(o);
                return (
                  <div key={o.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-ink">{o.orderNumber}</span>
                      <span className={`chip ${STATUS_STYLE[o.status]}`}>{o.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-ink-muted">{meta.fulfillment === "pickup" ? "🏪 Pickup" : "🛵 Delivery"} · {dateTime(o.createdAt)}</span>
                      <span className="font-black text-ink">{money(o.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-bold text-ink-muted">{label}</span>
      {href ? (
        <a href={href} className="truncate text-right font-semibold text-brand hover:underline">{value}</a>
      ) : (
        <span className="truncate text-right text-ink">{value ?? "—"}</span>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-base font-black text-ink">{value}</p>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
    </div>
  );
}
