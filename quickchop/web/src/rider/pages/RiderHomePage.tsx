import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/theme/format";
import { DELIVERY_LABEL, timeAgo } from "@/theme/delivery";
import { RiderApi } from "../api";
import { useRiderAuth } from "../store";
import { useRiderShell } from "../RiderLayout";

const SHARING_TEXT = {
  off: "Location sharing is off",
  starting: "Finding your location…",
  on: "Sharing your live location",
  denied: "Location permission denied",
  unsupported: "This browser can't share location",
  error: "Can't get a GPS fix — move to open sky",
};

export function RiderHomePage() {
  const rider = useRiderAuth((s) => s.rider);
  const { available, active, sharing, toggleOnline, toggling } = useRiderShell();
  const { data: summary } = useQuery({ queryKey: ["rider", "summary"], queryFn: RiderApi.summary, refetchInterval: 30_000 });
  const online = !!rider?.online;
  const firstName = rider?.fullName.split(" ")[0] ?? "Rider";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">Hi {firstName} 👋</h1>

      <div className={`card p-5 ${online ? "ring-2 ring-emerald-400" : ""}`}>
        <p className="text-sm font-bold text-ink-muted">{online ? "You're online" : "You're offline"}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {online ? "New delivery requests will chime on this phone. Keep this page open while working." : "Go online to receive delivery requests."}
        </p>
        <button onClick={toggleOnline} disabled={toggling} className={`mt-4 w-full py-3.5 ${online ? "btn-ghost" : "btn-primary"}`}>
          {online ? "Go offline" : "Go online"}
        </button>
        {online && (
          <p className={`mt-3 text-xs font-bold ${sharing.status === "on" ? "text-emerald-600" : "text-amber-600"}`}>
            📍 {SHARING_TEXT[sharing.status]}
            {sharing.status === "on" && sharing.accuracyM != null && ` (±${Math.round(sharing.accuracyM)} m)`}
            {sharing.lastSentAt && ` · sent ${timeAgo(new Date(sharing.lastSentAt).toISOString())}`}
          </p>
        )}
      </div>

      {active.map((job) => (
        <Link key={job.id} to={`/rider/jobs/${job.id}`} className="card block border-2 border-brand p-5">
          <p className="text-xs font-black uppercase tracking-wide text-brand">Current delivery · {job.orderNumber}</p>
          <p className="mt-1 text-lg font-black text-ink">{DELIVERY_LABEL[job.status]}</p>
          <p className="mt-1 text-sm text-ink-soft">{job.customerName} · {job.dropoffAddress}</p>
          <p className="mt-3 text-sm font-black text-brand">Open delivery →</p>
        </Link>
      ))}

      <Link to="/rider/requests" className="card flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-bold text-ink-muted">Open requests</p>
          <p className="text-3xl font-black text-ink">{available.length}</p>
        </div>
        <span className="text-sm font-black text-brand">View →</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold text-ink-muted">Today</p>
          <p className="text-xl font-black text-ink">{money(summary?.todayEarnings ?? 0)}</p>
          <p className="text-xs font-semibold text-ink-muted">{summary?.todayCount ?? 0} deliveries</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold text-ink-muted">This week</p>
          <p className="text-xl font-black text-ink">{money(summary?.weekEarnings ?? 0)}</p>
          <p className="text-xs font-semibold text-ink-muted">{summary?.weekCount ?? 0} deliveries</p>
        </div>
      </div>
    </div>
  );
}
