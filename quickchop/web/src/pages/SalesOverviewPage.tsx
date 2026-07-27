import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardApi } from "@/api/endpoints";
import { money } from "@/theme/format";

export function SalesOverviewPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => DashboardApi.summary(from || undefined, to || undefined),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black text-ink">Sales overview</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={data?.ordersToday ?? 0} loading={isLoading} icon="🧾" />
        <StatCard label="Revenue today" value={money(data?.revenueToday ?? 0)} loading={isLoading} icon="💰" accent />
        <StatCard label="Orders this week" value={data?.ordersThisWeek ?? 0} loading={isLoading} icon="📦" />
        <StatCard label="Revenue this week" value={money(data?.revenueThisWeek ?? 0)} loading={isLoading} icon="📈" accent />
      </div>

      <div className="card p-6">
        <h3 className="mb-4 text-lg font-black text-ink">Custom date range</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <button onClick={() => refetch()} className="btn-primary py-3">
            {isFetching ? "Loading…" : "Apply"}
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard label="Orders in range" value={data?.ordersInRange ?? 0} loading={isLoading} icon="🗓️" />
          <StatCard label="Revenue in range" value={money(data?.revenueInRange ?? 0)} loading={isLoading} icon="💵" accent />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-lg">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accent ? "text-brand" : "text-ink"}`}>{loading ? "…" : value}</p>
    </div>
  );
}
