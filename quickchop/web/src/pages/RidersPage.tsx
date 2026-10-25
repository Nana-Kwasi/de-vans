import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RiderInput, RidersApi } from "@/api/endpoints";
import { RiderAdmin, RiderCredentials, VehicleType } from "@/api/types";
import { money, dateTime } from "@/theme/format";
import { VEHICLE_LABEL, timeAgo } from "@/theme/delivery";

const EMPTY: RiderInput = { fullName: "", phoneNumber: "", email: "", vehicleType: "MOTORBIKE", vehiclePlate: "", notes: "" };

const apiError = (e: any) => e?.response?.data?.message ?? "Something went wrong.";

export function RidersPage() {
  const qc = useQueryClient();
  const { data: riders = [], isLoading } = useQuery({ queryKey: ["riders"], queryFn: RidersApi.list, refetchInterval: 15_000 });
  const [editing, setEditing] = useState<RiderAdmin | "new" | null>(null);
  const [credentials, setCredentials] = useState<RiderCredentials | null>(null);
  const [historyFor, setHistoryFor] = useState<RiderAdmin | null>(null);
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get("q") ?? "");
  const shown = riders.filter((r) =>
    !filter.trim() || [r.fullName, r.phoneNumber, r.vehiclePlate, r.email].some((v) => v?.toLowerCase().includes(filter.trim().toLowerCase()))
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["riders"] });

  const toggleActive = useMutation({
    mutationFn: (r: RiderAdmin) => RidersApi.setActive(r.id, !r.active),
    onSuccess: refresh,
    onError: (e) => window.alert(apiError(e)),
  });
  const reset = useMutation({
    mutationFn: (r: RiderAdmin) => RidersApi.resetPassword(r.id),
    onSuccess: (res) => {
      setCredentials(res);
      refresh();
    },
    onError: (e) => window.alert(apiError(e)),
  });

  const riderLoginUrl = `${window.location.origin}/rider/login`;
  const online = riders.filter((r) => r.active && r.online).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Riders</h1>
          <p className="text-sm font-semibold text-ink-muted">
            {riders.length} rider{riders.length === 1 ? "" : "s"} · {online} online now · riders sign in at{" "}
            <a href={riderLoginUrl} target="_blank" rel="noreferrer" className="text-brand underline">{riderLoginUrl}</a>
          </p>
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary">+ Add rider</button>
      </div>

      {riders.length > 0 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter riders by name, phone, plate…"
          className="input mb-5 py-2.5 sm:max-w-sm"
        />
      )}

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading riders…</p>
      ) : riders.length === 0 ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">
          No riders yet. Add your first rider — they'll get a phone number + temporary password to sign in with.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <div key={r.id} className={`card p-5 ${r.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-ink">{r.fullName}</p>
                  <a href={`tel:${r.phoneNumber}`} className="text-sm font-semibold text-brand">{r.phoneNumber}</a>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!r.active ? (
                    <span className="chip bg-red-100 text-red-700">Deactivated</span>
                  ) : r.online ? (
                    <span className="chip bg-emerald-100 text-emerald-700">● Online</span>
                  ) : (
                    <span className="chip bg-canvas text-ink-muted">Offline</span>
                  )}
                  {r.locked && <span className="chip bg-amber-100 text-amber-800">🔒 Locked</span>}
                  {r.mustChangePassword && <span className="chip bg-blue-100 text-blue-700">First sign-in pending</span>}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-ink-soft">
                <p>{VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType}{r.vehiclePlate ? ` · ${r.vehiclePlate}` : ""}</p>
                {r.email && <p>✉️ {r.email}</p>}
                <p>📍 Last seen {timeAgo(r.lastLocation?.at)}</p>
                <p>🛵 {r.activeDeliveries} active · {r.deliveredCount} delivered · {money(r.totalEarned)} earned</p>
                {r.notes && <p className="rounded-xl bg-canvas px-3 py-2 text-xs">{r.notes}</p>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setEditing(r)} className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5">Edit</button>
                <button onClick={() => setHistoryFor(r)} className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5">History</button>
                <button
                  onClick={() => window.confirm(`Issue a new temporary password for ${r.fullName}? They'll be signed out.`) && reset.mutate(r)}
                  className="btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5"
                >
                  Reset password
                </button>
                <button
                  onClick={() =>
                    window.confirm(r.active ? `Deactivate ${r.fullName}? They will be signed out and can't sign in.` : `Reactivate ${r.fullName}?`) &&
                    toggleActive.mutate(r)
                  }
                  className={`btn-ghost px-3.5 py-2.5 text-xs sm:py-1.5 ${r.active ? "text-red-600" : "text-emerald-600"}`}
                >
                  {r.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RiderForm
          rider={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(res) => {
            setEditing(null);
            setCredentials(res);
            refresh();
          }}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {credentials && <CredentialsModal creds={credentials} loginUrl={riderLoginUrl} onClose={() => setCredentials(null)} />}
      {historyFor && <HistoryModal rider={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          <button onClick={onClose} className="text-xl text-ink-muted">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RiderForm({ rider, onClose, onCreated, onSaved }: {
  rider: RiderAdmin | null;
  onClose: () => void;
  onCreated: (r: RiderCredentials) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RiderInput>(
    rider
      ? { fullName: rider.fullName, phoneNumber: rider.phoneNumber, email: rider.email ?? "", vehicleType: rider.vehicleType, vehiclePlate: rider.vehiclePlate ?? "", notes: rider.notes ?? "" }
      : EMPTY
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof RiderInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { ...form, email: form.email?.trim() || undefined };
    try {
      if (rider) {
        await RidersApi.update(rider.id, { ...body, email: form.email?.trim() ?? "" });
        onSaved();
      } else {
        onCreated(await RidersApi.create(body));
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={rider ? `Edit ${rider.fullName}` : "Add a rider"} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}
        <label className="label">Full name</label>
        <input className="input mb-3" value={form.fullName} onChange={set("fullName")} required maxLength={120} />
        <label className="label">Phone number (used to sign in)</label>
        <input className="input mb-3" type="tel" value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="024 123 4567" required maxLength={20} />
        <label className="label">Email (optional)</label>
        <input className="input mb-3" type="email" value={form.email} onChange={set("email")} maxLength={160} />
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Vehicle</label>
            <select className="input" value={form.vehicleType} onChange={set("vehicleType")}>
              {(["MOTORBIKE", "BICYCLE", "CAR", "ON_FOOT"] as VehicleType[]).map((v) => (
                <option key={v} value={v}>{VEHICLE_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Plate number</label>
            <input className="input" value={form.vehiclePlate} onChange={set("vehiclePlate")} placeholder="GR-1234-24" maxLength={20} />
          </div>
        </div>
        <label className="label">Notes (admin only)</label>
        <textarea className="input mb-4" rows={2} value={form.notes} onChange={set("notes")} placeholder="Ghana card no., emergency contact…" maxLength={1000} />
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving…" : rider ? "Save changes" : "Create rider"}
        </button>
        {!rider && <p className="mt-3 text-center text-xs text-ink-muted">A temporary password is generated; the rider must change it at first sign-in.</p>}
      </form>
    </Modal>
  );
}

function CredentialsModal({ creds, loginUrl, onClose }: { creds: RiderCredentials; loginUrl: string; onClose: () => void }) {
  const text = `Hi ${creds.rider.fullName}, your rider account is ready.\nSign in: ${loginUrl}\nPhone: ${creds.rider.phoneNumber}\nTemporary password: ${creds.temporaryPassword}\nYou'll be asked to choose your own password.`;
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Rider sign-in details" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-soft">
        Give these to <b>{creds.rider.fullName}</b> in person or by private message. The password is shown <b>only once</b>.
      </p>
      <div className="space-y-2 rounded-2xl bg-canvas p-4 font-mono text-sm">
        <p>Sign in: {loginUrl}</p>
        <p>Phone: {creds.rider.phoneNumber}</p>
        <p>Password: <b className="text-lg">{creds.temporaryPassword}</b></p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
          className="btn-ghost flex-1"
        >
          {copied ? "Copied ✓" : "Copy message"}
        </button>
        <button onClick={onClose} className="btn-primary flex-1">Done</button>
      </div>
    </Modal>
  );
}

function HistoryModal({ rider, onClose }: { rider: RiderAdmin; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["riders", rider.id, "history"], queryFn: () => RidersApi.deliveries(rider.id) });
  const total = data.reduce((sum, j) => sum + Number(j.riderFee), 0);
  return (
    <Modal title={`${rider.fullName} · deliveries`} onClose={onClose}>
      <p className="mb-3 text-sm font-bold text-ink">{data.length} delivered · {money(total)} in delivery fees</p>
      {isLoading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-ink-muted">No completed deliveries yet.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {data.map((j) => (
            <div key={j.id} className="flex justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-bold text-ink">{j.orderNumber} · {j.customerName}</p>
                <p className="truncate text-xs text-ink-muted">{j.dropoffAddress}</p>
                <p className="text-xs text-ink-muted">{j.deliveredAt ? dateTime(j.deliveredAt) : ""}{j.completedByAdmin ? " · completed by admin" : ""}</p>
              </div>
              <p className="shrink-0 font-black text-ink">{money(j.riderFee)}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
