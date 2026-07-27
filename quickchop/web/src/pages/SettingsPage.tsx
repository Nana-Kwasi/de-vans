import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthApi, SettingsApi } from "@/api/endpoints";
import { AppSettings } from "@/api/types";

type Tab = "restaurant" | "delivery" | "announcement" | "security";

const TABS: { key: Tab; label: string }[] = [
  { key: "restaurant", label: "Restaurant" },
  { key: "delivery", label: "Delivery & orders" },
  { key: "announcement", label: "Announcement" },
  { key: "security", label: "Security" },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("restaurant");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-2xl font-black text-ink">Settings</h1>

      {/* Sub top-tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key ? "border-b-2 border-brand text-brand" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "security" ? <ChangePassword /> : <RestaurantSettings tab={tab} />}
    </div>
  );
}

/* ------------------------------- Restaurant ------------------------------- */

function RestaurantSettings({ tab }: { tab: Tab }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: SettingsApi.get });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: AppSettings) => SettingsApi.update(body),
    onSuccess: (fresh) => {
      qc.setQueryData(["settings"], fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading || !form) {
    return <div className="card p-6 font-semibold text-ink-muted">Loading settings…</div>;
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
      className="card p-6"
    >
      {tab === "restaurant" && (
        <>
          <h2 className="mb-1 text-lg font-black text-ink">Restaurant</h2>
          <p className="mb-5 text-sm text-ink-muted">Name, availability and contact shown in the mobile app.</p>

          <Field label="Business name">
            <input className="input" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
          </Field>

          <Divider label="Availability" />
          <Toggle
            label="Accepting orders"
            hint="Turn off to close the store — the app blocks checkout and shows your message."
            value={form.acceptingOrders}
            onChange={(v) => set("acceptingOrders", v)}
          />
          {!form.acceptingOrders && (
            <Field label="Closed message">
              <input className="input" value={form.closedMessage} onChange={(e) => set("closedMessage", e.target.value)} />
            </Field>
          )}

          <Divider label="Contact & address" />
          <Field label="Contact phone / WhatsApp">
            <input className="input" placeholder="+233…" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
          </Field>
          <Field label="Store address">
            <input className="input" value={form.storeAddress} onChange={(e) => set("storeAddress", e.target.value)} />
          </Field>
        </>
      )}

      {tab === "delivery" && (
        <>
          <h2 className="mb-1 text-lg font-black text-ink">Delivery & orders</h2>
          <p className="mb-5 text-sm text-ink-muted">
            Delivery fee is calculated automatically by distance using these rates. Delivery is offered only within the
            max radius (Accra); beyond it, customers get self-pickup only.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Delivery base fee (GHS)" value={form.deliveryBaseFee} onChange={(v) => set("deliveryBaseFee", v)} />
            <NumField label="Per km (GHS)" value={form.deliveryPerKm} onChange={(v) => set("deliveryPerKm", v)} />
            <NumField label="Max delivery fee (GHS)" value={form.deliveryMaxFee} onChange={(v) => set("deliveryMaxFee", v)} />
            <NumField label="Max delivery distance (km)" value={form.maxDeliveryKm} onChange={(v) => set("maxDeliveryKm", v)} />
            <NumField label="Free delivery over (GHS, 0 = off)" value={form.freeDeliveryThreshold} onChange={(v) => set("freeDeliveryThreshold", v)} />
            <NumField label="Minimum order (GHS, 0 = none)" value={form.minOrderAmount} onChange={(v) => set("minOrderAmount", v)} />
          </div>

          <Divider label="Store location" />
          <p className="mb-3 text-sm text-ink-muted">
            Where orders are cooked/dispatched from. Delivery distance and fees are measured from here. Tip: right-click
            your spot in Google Maps to copy its latitude, longitude.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Store latitude" value={form.storeLat} onChange={(v) => set("storeLat", v)} step="0.000001" min="-90" />
            <NumField label="Store longitude" value={form.storeLng} onChange={(v) => set("storeLng", v)} step="0.000001" min="-180" />
          </div>
        </>
      )}

      {tab === "announcement" && (
        <>
          <h2 className="mb-1 text-lg font-black text-ink">Home announcement</h2>
          <p className="mb-5 text-sm text-ink-muted">A banner shown at the top of the app's Home screen.</p>
          <Toggle
            label="Show announcement banner"
            value={form.announcementEnabled}
            onChange={(v) => set("announcementEnabled", v)}
          />
          {form.announcementEnabled && (
            <Field label="Announcement text">
              <input
                className="input"
                placeholder="Free delivery this weekend!"
                value={form.announcementText}
                onChange={(e) => set("announcementText", e.target.value)}
              />
            </Field>
          )}
        </>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={save.isPending} className="btn-primary px-6 py-2.5 disabled:opacity-40">
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>}
        {save.isError && <span className="text-sm font-semibold text-red-600">Save failed. Try again.</span>}
      </div>
    </form>
  );
}

/* ------------------------------ Small pieces ------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "0.01",
  min = "0",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step={step} min={min} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-3 mt-5 border-t border-hairline pt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`mb-3 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
        value ? "border-brand bg-brand-soft text-brand" : "border-hairline bg-canvas text-ink-soft"
      }`}
    >
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-xs font-normal text-ink-muted">{hint}</span>}
      </span>
      <span className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${value ? "bg-brand" : "bg-hairline"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition ${value ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

/* ---------------------------- Change password ----------------------------- */

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await AuthApi.changePassword(currentPassword, newPassword);
      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not change password. Check your current password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <h2 className="mb-4 text-lg font-black text-ink">Change password</h2>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}
      {ok && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Password changed successfully.
        </div>
      )}

      <label className="label">Current password</label>
      <input
        type="password"
        className="input mb-4"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
      />

      <label className="label">New password</label>
      <input
        type="password"
        className="input mb-1"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
      />
      <p className="mb-4 text-xs text-ink-muted">At least 8 characters.</p>

      <label className="label">Confirm new password</label>
      <input
        type="password"
        className="input mb-5"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={saving || !currentPassword || !newPassword || !confirm}
        className="btn-primary px-6 py-2.5 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
