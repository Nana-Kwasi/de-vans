import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeliveriesApi, RidersApi, SettingsApi } from "@/api/endpoints";
import { DeliveryJob } from "@/api/types";
import { money, dateTime } from "@/theme/format";
import { DELIVERY_LABEL, DELIVERY_STYLE, accuracyLabel, timeAgo, timeOnly } from "@/theme/delivery";
import { DeliveryMap, MapMarker } from "@/components/DeliveryMap";

const apiError = (e: any) => e?.response?.data?.message ?? "Something went wrong.";

export function DeliveriesPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [routeId, setRouteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: active = [] } = useQuery({ queryKey: ["deliveries", "active"], queryFn: DeliveriesApi.active, refetchInterval: 5000 });
  const { data: history = [] } = useQuery({ queryKey: ["deliveries", "history"], queryFn: () => DeliveriesApi.history(7), enabled: tab === "history" });
  const { data: riders = [] } = useQuery({ queryKey: ["riders"], queryFn: RidersApi.list, refetchInterval: 10_000 });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: SettingsApi.get });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["deliveries"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["riders"] });
  };
  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => window.alert(apiError(e)),
  });

  // Overview map: the store, every online rider, and every open drop-off.
  const markers: MapMarker[] = [];
  if (settings) markers.push({ key: "store", kind: "store", point: { lat: settings.storeLat, lng: settings.storeLng }, label: settings.businessName });
  riders
    .filter((r) => r.active && r.online && r.lastLocation)
    .forEach((r) =>
      markers.push({
        key: `rider-${r.id}`,
        kind: r.activeDeliveries > 0 ? "rider" : "riderIdle",
        point: r.lastLocation!,
        label: `${r.fullName} · ${r.activeDeliveries > 0 ? "on a delivery" : "available"} · ${timeAgo(r.lastLocation!.at)}`,
      })
    );
  active
    .filter((j) => j.dropoffLat != null && j.dropoffLng != null)
    .forEach((j) => markers.push({ key: `drop-${j.id}`, kind: "dropoff", point: { lat: j.dropoffLat!, lng: j.dropoffLng! }, label: `${j.orderNumber} · ${j.customerName}` }));

  const available = riders.filter((r) => r.active);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-ink">Deliveries</h1>
        <div className="flex gap-2">
          {(["active", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft"}`}
            >
              {t === "active" ? `Active (${active.length})` : "Last 7 days"}
            </button>
          ))}
        </div>
      </div>

      {tab === "active" ? (
        <>
          <DeliveryMap markers={markers} height={340} className="mb-6" />
          {active.length === 0 ? (
            <div className="card p-10 text-center font-semibold text-ink-muted">
              No active deliveries. Use “Send to riders” on a delivery order in Live Orders.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {active.map((j) => (
                <ActiveCard key={j.id} job={j} riders={available} busy={action.isPending} run={(fn) => action.mutate(fn)} onRoute={() => setRouteId(j.id)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card divide-y divide-hairline">
          {history.length === 0 && <p className="p-8 text-center font-semibold text-ink-muted">Nothing in the last 7 days.</p>}
          {history.map((j) => (
            <button key={j.id} onClick={() => setRouteId(j.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-canvas">
              <div className="min-w-0">
                <p className="font-bold text-ink">{j.orderNumber} · {j.customerName}</p>
                <p className="truncate text-xs text-ink-muted">{j.riderName ?? "—"} · {j.dropoffAddress}</p>
                <p className="text-xs text-ink-muted">
                  Sent {timeOnly(j.dispatchedAt)} → {j.deliveredAt ? `delivered ${dateTime(j.deliveredAt)}` : `recalled ${j.cancelledAt ? dateTime(j.cancelledAt) : ""}`}
                  {j.completedByAdmin ? " · completed by admin" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`chip ${DELIVERY_STYLE[j.status]}`}>{DELIVERY_LABEL[j.status]}</span>
                <p className="mt-1 text-sm font-black text-ink">{money(j.riderFee)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {routeId && <RouteModal id={routeId} onClose={() => setRouteId(null)} />}
    </div>
  );
}

function ActiveCard({ job, riders, busy, run, onRoute }: {
  job: DeliveryJob;
  riders: { id: string; fullName: string; online: boolean; activeDeliveries: number }[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onRoute: () => void;
}) {
  const [assignTo, setAssignTo] = useState("");
  const acc = accuracyLabel(job.dropoffAccuracyM);
  const canReassign = job.status === "OPEN" || job.status === "ASSIGNED";

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-black text-ink">{job.orderNumber}</span>
        <span className={`chip ${DELIVERY_STYLE[job.status]}`}>{DELIVERY_LABEL[job.status]}</span>
      </div>

      <div className="space-y-1 text-sm text-ink-soft">
        <p><b className="text-ink">Customer:</b> {job.customerName} · <a className="text-brand" href={`tel:${job.customerPhone}`}>{job.customerPhone}</a></p>
        <p><b className="text-ink">Deliver to:</b> {job.dropoffAddress}{acc && <span className={acc.poor ? "text-amber-600" : "text-emerald-600"}> ({acc.text})</span>}</p>
        <p><b className="text-ink">Rider:</b>{" "}
          {job.riderName ? (
            <>
              {job.riderName} · <a className="text-brand" href={`tel:${job.riderPhone}`}>{job.riderPhone}</a>
              {job.riderLocation && <span className="text-ink-muted"> · seen {timeAgo(job.riderLocation.at)}</span>}
            </>
          ) : (
            <span className="text-amber-600">waiting for a rider to accept…</span>
          )}
        </p>
        <p><b className="text-ink">Fee:</b> {money(job.riderFee)} rider fee · order {money(job.orderTotal ?? 0)} {job.paid ? "(paid)" : "(not paid yet)"}{job.tripKm != null ? ` · ${job.tripKm} km` : ""}</p>
        <p className="text-xs text-ink-muted">
          Sent {timeOnly(job.dispatchedAt)} · accepted {timeOnly(job.acceptedAt)} · picked up {timeOnly(job.pickedUpAt)} · arrived {timeOnly(job.arrivedAt)}
        </p>
        {job.pinLocked && <p className="font-bold text-red-600">Rider entered the wrong code 5 times — confirm with the customer, then complete.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onRoute} className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5">Track</button>
        {canReassign && (
          <span className="flex gap-1">
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="rounded-full border border-hairline bg-white px-2 text-xs font-bold">
              <option value="">Assign to…</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}{r.online ? " ●" : ""}{r.activeDeliveries ? ` (${r.activeDeliveries} active)` : ""}</option>
              ))}
            </select>
            <button disabled={!assignTo || busy} onClick={() => run(() => DeliveriesApi.assign(job.id, assignTo))} className="btn-primary px-3.5 py-2.5 text-xs sm:py-1.5">Assign</button>
          </span>
        )}
        {job.status === "ASSIGNED" && (
          <button disabled={busy} onClick={() => run(() => DeliveriesApi.unassign(job.id))} className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5">Unassign</button>
        )}
        {canReassign && (
          <button
            disabled={busy}
            onClick={() => window.confirm("Recall from riders? The order goes back to Preparing.") && run(() => DeliveriesApi.recall(job.id))}
            className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5 text-red-600"
          >
            Recall
          </button>
        )}
        {job.status !== "OPEN" && (
          <button
            disabled={busy}
            onClick={() => window.confirm("Mark as delivered without the customer's code? Only do this if you've confirmed with the customer.") && run(() => DeliveriesApi.complete(job.id))}
            className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5 text-emerald-700"
          >
            Mark delivered
          </button>
        )}
      </div>
    </div>
  );
}

function RouteModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["deliveries", "route", id], queryFn: () => DeliveriesApi.route(id), refetchInterval: 5000 });
  const job = data?.job;
  const markers: MapMarker[] = [];
  if (job) {
    markers.push({ key: "store", kind: "store", point: { lat: job.pickupLat, lng: job.pickupLng }, label: job.pickupName });
    if (job.dropoffLat != null && job.dropoffLng != null)
      markers.push({ key: "drop", kind: "dropoff", point: { lat: job.dropoffLat, lng: job.dropoffLng, accuracyM: job.dropoffAccuracyM }, label: job.dropoffAddress });
    if (job.riderLocation) markers.push({ key: "rider", kind: "rider", point: job.riderLocation, label: job.riderName ?? "Rider" });
  }
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">{job ? `${job.orderNumber} · ${DELIVERY_LABEL[job.status]}` : "Loading…"}</h2>
          <button onClick={onClose} className="text-xl text-ink-muted">✕</button>
        </div>
        {job && (
          <>
            <DeliveryMap markers={markers} path={data?.path} height={380} />
            <p className="mt-3 text-sm text-ink-soft">
              {job.riderName ?? "No rider"} · {data?.path.length ?? 0} location points recorded · sent {dateTime(job.dispatchedAt)}
              {job.deliveredAt ? ` · delivered ${dateTime(job.deliveredAt)}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
