import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from "recharts";
import { CustomersApi, DashboardApi, MenuApi, OrdersApi, ReviewsApi, SupportApi } from "@/api/endpoints";
import { Order, OrderStatus } from "@/api/types";
import { money, dateTime, parseOrderMeta, BUSINESS_NAME } from "@/theme/format";
import { useAuth } from "@/store/auth";

const ACTIVE: OrderStatus[] = ["ORDER_RECEIVED", "PREPARING", "OUT_FOR_DELIVERY"];

const STATUS_META: Record<OrderStatus, { label: string; color: string; chip: string }> = {
  ORDER_RECEIVED: { label: "Received", color: "#E69F00", chip: "bg-amber-100 text-amber-700" },
  PREPARING: { label: "Preparing", color: "#56B4E9", chip: "bg-blue-100 text-blue-700" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "#CC79A7", chip: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Delivered", color: "#009E73", chip: "bg-emerald-100 text-emerald-700" },
  READY: { label: "Ready", color: "#009E73", chip: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelled", color: "#D55E00", chip: "bg-red-100 text-red-700" },
};
const BRAND = "#F26A21";

function last7DaysRevenue(orders: Order[]) {
  const days: { day: string; revenue: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dayOrders = orders.filter((o) => {
      const od = new Date(o.createdAt);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate() && o.status !== "CANCELLED";
    });
    days.push({ day: label, revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0), orders: dayOrders.length });
  }
  return days;
}

function topItems(orders: Order[]) {
  const map = new Map<string, number>();
  orders.forEach((o) => o.items.forEach((it) => map.set(it.name, (map.get(it.name) ?? 0) + it.quantity)));
  return [...map.entries()]
    .map(([name, qty]) => ({ name: name.length > 14 ? name.slice(0, 13) + "…" : name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
}

function statusData(orders: Order[]) {
  const counts = {} as Record<OrderStatus, number>;
  orders.forEach((o) => (counts[o.status] = (counts[o.status] ?? 0) + 1));
  return (Object.keys(STATUS_META) as OrderStatus[])
    .filter((s) => counts[s])
    .map((s) => ({ name: STATUS_META[s].label, value: counts[s], color: STATUS_META[s].color }));
}

export function DashboardPage() {
  const fullName = useAuth((s) => s.fullName);
  const { data: summary } = useQuery({ queryKey: ["summary", "", ""], queryFn: () => DashboardApi.summary() });
  const { data: orders } = useQuery({ queryKey: ["orders", undefined], queryFn: () => OrdersApi.list(), refetchInterval: 20000 });
  const { data: tickets } = useQuery({ queryKey: ["support", "OPEN"], queryFn: () => SupportApi.list("OPEN") });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: CustomersApi.list });
  const { data: menu } = useQuery({ queryKey: ["menu-all"], queryFn: MenuApi.list });
  const { data: reviews } = useQuery({ queryKey: ["reviews"], queryFn: ReviewsApi.list });

  const all = orders ?? [];
  const active = all.filter((o) => ACTIVE.includes(o.status));
  const recent = all.slice(0, 6);
  const revenue7 = last7DaysRevenue(all);
  const items = topItems(all);
  const statuses = statusData(all);
  const avgRating = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ink">Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""} 👋</h1>
        <p className="text-sm font-semibold text-ink-muted">{today} · {BUSINESS_NAME} kitchen</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="🧾" label="Orders today" value={summary?.ordersToday ?? 0} />
        <Stat icon="💰" label="Revenue today" value={money(summary?.revenueToday ?? 0)} accent />
        <Stat icon="📦" label="Orders this week" value={summary?.ordersThisWeek ?? 0} />
        <Stat icon="📈" label="Revenue this week" value={money(summary?.revenueThisWeek ?? 0)} accent />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon="🔥" label="Active orders" value={String(active.length)} to="/orders" />
        <MiniStat icon="⭐" label="Avg rating" value={avgRating ? avgRating.toFixed(1) : "—"} to="/reviews" />
        <MiniStat icon="💬" label="Open tickets" value={String(tickets?.length ?? 0)} to="/support" />
        <MiniStat icon="👥" label="Customers" value={String(customers?.length ?? 0)} to="/customers" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Revenue · last 7 days" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenue7} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#ECEDF0" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#9A9DA6", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9A9DA6", fontSize: 12 }} width={44} />
              <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: BRAND }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Order status">
          {statuses.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statuses} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {statuses.map((s) => (
                    <Cell key={s.name} fill={s.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Top-selling items" className="lg:col-span-3">
          {items.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={items} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#ECEDF0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#5B5E66", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9A9DA6", fontSize: 12 }} width={36} allowDecimals={false} />
                <Tooltip formatter={(v: number) => `${v} sold`} contentStyle={tooltipStyle} cursor={{ fill: "#F4F5F7" }} />
                <Bar dataKey="qty" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>

      {/* Recent orders */}
      <div className="mt-6 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">Recent orders</h2>
          <Link to="/orders" className="text-sm font-bold text-brand hover:underline">View all →</Link>
        </div>
        {!recent.length ? (
          <p className="py-6 text-center font-semibold text-ink-muted">No orders yet.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {recent.map((o) => <RecentRow key={o.id} order={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = { borderRadius: 12, border: "1px solid #ECEDF0", boxShadow: "0 8px 24px rgba(11,11,15,0.08)", fontSize: 13 } as const;

function ChartCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`card p-5 ${className ?? ""}`}>
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="flex h-[260px] items-center justify-center text-sm font-semibold text-ink-muted">No data yet.</div>;
}

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-lg">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accent ? "text-brand" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ icon, label, value, to }: { icon: string; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 transition hover:shadow-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-lg">{icon}</div>
      <div>
        <p className="text-2xl font-black text-ink">{value}</p>
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
      </div>
    </Link>
  );
}

function RecentRow({ order }: { order: Order }) {
  const meta = parseOrderMeta(order);
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-base">
        {meta.fulfillment === "pickup" ? "🏪" : "🛵"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{order.orderNumber}</p>
        <p className="truncate text-xs text-ink-muted">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
      </div>
      <div className="text-right">
        <p className="font-black text-ink">{money(order.total)}</p>
        <p className="text-xs text-ink-muted">{dateTime(order.createdAt)}</p>
      </div>
      <span className={`chip ${STATUS_META[order.status].chip}`}>{STATUS_META[order.status].label}</span>
    </div>
  );
}
