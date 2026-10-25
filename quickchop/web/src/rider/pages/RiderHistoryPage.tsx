import { useQuery } from "@tanstack/react-query";
import { money, dateTime } from "@/theme/format";
import { RiderApi } from "../api";

export function RiderHistoryPage() {
  const { data: summary } = useQuery({ queryKey: ["rider", "summary"], queryFn: RiderApi.summary });
  const { data: history = [], isLoading } = useQuery({ queryKey: ["rider", "history"], queryFn: RiderApi.history });

  const tiles = [
    { label: "Today", value: summary?.todayEarnings, count: summary?.todayCount },
    { label: "This week", value: summary?.weekEarnings, count: summary?.weekCount },
    { label: "All time", value: summary?.totalEarnings, count: summary?.totalCount },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">Earnings</h1>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="card p-3">
            <p className="text-[11px] font-bold text-ink-muted">{t.label}</p>
            <p className="text-base font-black text-ink">{money(t.value ?? 0)}</p>
            <p className="text-[11px] font-semibold text-ink-muted">{t.count ?? 0} trips</p>
          </div>
        ))}
      </div>

      <h2 className="pt-2 text-sm font-black uppercase tracking-wide text-ink-muted">Completed deliveries</h2>
      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : history.length === 0 ? (
        <div className="card p-8 text-center text-sm font-semibold text-ink-muted">No completed deliveries yet.</div>
      ) : (
        <div className="card divide-y divide-hairline">
          {history.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-bold text-ink">{j.orderNumber}</p>
                <p className="truncate text-xs text-ink-muted">{j.dropoffAddress}</p>
                <p className="text-xs text-ink-muted">
                  {j.deliveredAt ? dateTime(j.deliveredAt) : ""}{j.tripKm != null ? ` · ${j.tripKm} km` : ""}
                </p>
              </div>
              <p className="shrink-0 font-black text-emerald-600">+{money(j.riderFee)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
