import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeliveryJob, DeliveryStatus } from "@/api/types";
import { money } from "@/theme/format";
import { DELIVERY_LABEL, DELIVERY_STYLE, accuracyLabel, directionsUrl, dropoffDirectionsUrl, timeOnly } from "@/theme/delivery";
import { DeliveryMap, MapMarker } from "@/components/DeliveryMap";
import { RiderApi, errorMessage } from "../api";
import { useRiderShell } from "../RiderLayout";

const STEPS: { status: DeliveryStatus; label: string; at: (j: DeliveryJob) => string | null | undefined }[] = [
  { status: "ASSIGNED", label: "Accepted", at: (j) => j.acceptedAt },
  { status: "PICKED_UP", label: "Picked up", at: (j) => j.pickedUpAt },
  { status: "ARRIVED", label: "Arrived", at: (j) => j.arrivedAt },
  { status: "DELIVERED", label: "Delivered", at: (j) => j.deliveredAt },
];

/** /rider/active → the current job (or an empty state). */
export function RiderActiveRedirect() {
  const { active } = useRiderShell();
  if (active.length > 0) return <Navigate to={`/rider/jobs/${active[0].id}`} replace />;
  return (
    <div className="card mt-2 p-10 text-center">
      <p className="text-4xl">📭</p>
      <p className="mt-2 font-bold text-ink">No active delivery</p>
      <Link to="/rider/requests" className="btn-primary mt-4 inline-block">See requests</Link>
    </div>
  );
}

export function RiderDeliveryPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { sharing } = useRiderShell();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["rider", "job", id],
    queryFn: () => RiderApi.get(id),
    refetchInterval: 5000,
    retry: false,
  });

  const act = useMutation({
    mutationFn: (fn: () => Promise<DeliveryJob>) => fn(),
    onSuccess: (updated) => {
      setError(null);
      qc.setQueryData(["rider", "job", id], updated);
      qc.invalidateQueries({ queryKey: ["rider"] });
      if (updated.status === "OPEN") navigate("/rider/requests");
    },
    onError: (err) => {
      setError(errorMessage(err));
      qc.invalidateQueries({ queryKey: ["rider", "job", id] });
    },
  });

  if (isLoading) return <p className="font-semibold text-ink-muted">Loading delivery…</p>;
  if (isError || !job) {
    return (
      <div className="card p-8 text-center">
        <p className="font-bold text-ink">This delivery isn't available.</p>
        <p className="mt-1 text-sm text-ink-muted">Another rider may have taken it, or it was recalled.</p>
        <Link to="/rider/requests" className="btn-primary mt-4 inline-block">Back to requests</Link>
      </div>
    );
  }

  const mine = job.status !== "OPEN";
  const stepIndex = STEPS.findIndex((s) => s.status === job.status);
  const goingToStore = job.status === "ASSIGNED" || job.status === "OPEN";
  const acc = accuracyLabel(job.dropoffAccuracyM);

  const markers: MapMarker[] = [
    { key: "store", kind: "store", point: { lat: job.pickupLat, lng: job.pickupLng }, label: job.pickupName },
  ];
  if (job.dropoffLat != null && job.dropoffLng != null) {
    markers.push({ key: "dropoff", kind: "dropoff", point: { lat: job.dropoffLat, lng: job.dropoffLng, accuracyM: job.dropoffAccuracyM }, label: job.dropoffAddress });
  }
  if (mine && sharing.lat != null && sharing.lng != null) {
    markers.push({ key: "me", kind: "rider", point: { lat: sharing.lat, lng: sharing.lng }, label: "You" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-ink-muted">{job.orderNumber}</p>
          <h1 className="text-xl font-black text-ink">{DELIVERY_LABEL[job.status]}</h1>
        </div>
        <span className={`chip ${DELIVERY_STYLE[job.status]}`}>{money(job.riderFee)}</span>
      </div>

      {mine && (
        <div className="card flex justify-between p-4">
          {STEPS.map((s, i) => (
            <div key={s.status} className="flex flex-1 flex-col items-center text-center">
              <div className={`h-3.5 w-3.5 rounded-full ${i <= stepIndex ? "bg-emerald-500" : "bg-hairline"}`} />
              <p className={`mt-1 text-[11px] font-bold ${i <= stepIndex ? "text-ink" : "text-ink-muted"}`}>{s.label}</p>
              <p className="text-[10px] text-ink-muted">{timeOnly(s.at(job))}</p>
            </div>
          ))}
        </div>
      )}

      <DeliveryMap markers={markers} height={240} />

      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      {/* Primary action for the current step */}
      {job.status === "OPEN" && (
        <button disabled={act.isPending} onClick={() => act.mutate(() => RiderApi.accept(job.id))} className="btn-primary w-full py-4 text-base">
          Accept delivery · {money(job.riderFee)}
        </button>
      )}
      {job.status === "ASSIGNED" && (
        <button disabled={act.isPending} onClick={() => act.mutate(() => RiderApi.pickedUp(job.id))} className="btn-primary w-full py-4 text-base">
          ✅ I've picked up the food
        </button>
      )}
      {job.status === "PICKED_UP" && (
        <button disabled={act.isPending} onClick={() => act.mutate(() => RiderApi.arrived(job.id))} className="btn-primary w-full py-4 text-base">
          📍 I've arrived at the customer
        </button>
      )}
      {(job.status === "PICKED_UP" || job.status === "ARRIVED") && (
        <form
          className="card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate(() => RiderApi.complete(job.id, pin.trim()));
          }}
        >
          <label className="label">Customer's delivery code</label>
          <p className="mb-2 text-xs text-ink-muted">Ask the customer for the 4-digit code in their app or email once they have the food.</p>
          <div className="flex gap-2">
            <input
              className="input text-center text-2xl font-black tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              disabled={job.pinLocked}
            />
            <button type="submit" disabled={act.isPending || pin.length < 4 || job.pinLocked} className="btn-primary shrink-0 px-5">
              Complete
            </button>
          </div>
          {job.pinLocked && (
            <p className="mt-2 text-sm font-bold text-red-600">
              Too many wrong codes. Call the restaurant{job.storePhone ? ` (${job.storePhone})` : ""} to confirm this delivery.
            </p>
          )}
        </form>
      )}
      {job.status === "DELIVERED" && (
        <div className="card bg-emerald-50 p-5 text-center">
          <p className="text-3xl">🎉</p>
          <p className="font-black text-emerald-700">Delivered at {timeOnly(job.deliveredAt)} · {money(job.riderFee)} earned</p>
          <Link to="/rider/requests" className="btn-primary mt-3 inline-block">Find next delivery</Link>
        </div>
      )}

      {/* Navigation */}
      {mine && job.status !== "DELIVERED" && (
        <div className="grid grid-cols-2 gap-2">
          <a href={directionsUrl(job.pickupLat, job.pickupLng)} target="_blank" rel="noreferrer" className={`${goingToStore ? "btn-primary" : "btn-ghost"} py-3 text-center text-sm`}>
            🧭 To store
          </a>
          <a href={dropoffDirectionsUrl(job)} target="_blank" rel="noreferrer" className={`${!goingToStore ? "btn-primary" : "btn-ghost"} py-3 text-center text-sm`}>
            🧭 To customer
          </a>
        </div>
      )}

      {/* Customer */}
      <div className="card space-y-2 p-4 text-sm">
        <p className="text-xs font-black uppercase tracking-wide text-ink-muted">Customer</p>
        <p className="text-base font-black text-ink">{job.customerName ?? "Shown after you accept"}</p>
        <p className="text-ink-soft">🏠 {job.dropoffAddress}</p>
        {job.dropoffLat != null ? (
          <p className={`text-xs font-bold ${acc?.poor ? "text-amber-600" : "text-emerald-600"}`}>
            📍 GPS pin {acc ? acc.text : ""}{acc?.poor ? " — pin may be rough, call to confirm" : ""}
          </p>
        ) : (
          <p className="text-xs font-bold text-amber-600">No GPS pin — use the address and call the customer.</p>
        )}
        {job.deliveryTimeNote && <p className="text-ink-soft">⏰ {job.deliveryTimeNote}</p>}
        {job.customerNote && <p className="rounded-xl bg-canvas px-3 py-2 text-ink-soft">📝 {job.customerNote}</p>}
        {job.customerPhone && job.status !== "DELIVERED" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a href={`tel:${job.customerPhone}`} className="btn-ghost py-2.5 text-center">📞 Call</a>
            <a href={`sms:${job.customerPhone}`} className="btn-ghost py-2.5 text-center">💬 Text</a>
          </div>
        )}
      </div>

      {/* Order */}
      <div className="card p-4 text-sm">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-muted">Order {job.orderNumber}</p>
        <ul className="space-y-1">
          {job.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span className="font-semibold text-ink">{it.quantity}× {it.name}{it.addOns ? <span className="text-ink-muted"> ({it.addOns})</span> : null}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-hairline pt-3 text-base font-black text-emerald-600">
          <span>Your delivery fee</span>
          <span>{money(job.riderFee)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Customers pay the restaurant in the app — never take money for the food.</p>
        {job.dispatchNote && <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 font-semibold text-brand-dark">🍳 Kitchen: {job.dispatchNote}</p>}
      </div>

      {/* Store */}
      <div className="card p-4 text-sm">
        <p className="text-xs font-black uppercase tracking-wide text-ink-muted">Pickup</p>
        <p className="font-black text-ink">{job.pickupName}</p>
        <p className="text-ink-soft">{job.pickupAddress}</p>
        {job.storePhone && <a href={`tel:${job.storePhone}`} className="mt-2 inline-block font-bold text-brand">📞 Call restaurant</a>}
      </div>

      {job.status === "ASSIGNED" && (
        <button
          disabled={act.isPending}
          onClick={() => window.confirm("Give this delivery back so another rider can take it?") && act.mutate(() => RiderApi.release(job.id))}
          className="w-full py-3 text-sm font-bold text-red-600"
        >
          Can't do this delivery? Release it
        </button>
      )}
    </div>
  );
}
