import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminUsersApi, AuthApi, MenuApi, SettingsApi } from "@/api/endpoints";
import { AdminInviteResult, AppSettings } from "@/api/types";
import { useAuth } from "@/store/auth";

type Tab = "restaurant" | "delivery" | "announcement" | "team" | "security";

const TABS: { key: Tab; label: string }[] = [
  { key: "restaurant", label: "Restaurant" },
  { key: "delivery", label: "Delivery & orders" },
  { key: "announcement", label: "Announcement" },
  { key: "team", label: "Team" },
  { key: "security", label: "Security" },
];

export function SettingsPage() {
  // A first-time admin is sent here with ?first=1; open on Security so the very first
  // thing they see is the password form.
  const firstLogin = new URLSearchParams(window.location.search).get("first") === "1";
  const [tab, setTab] = useState<Tab>(firstLogin ? "security" : "restaurant");

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

      {tab === "security" ? <ChangePassword /> : tab === "team" ? <TeamSettings /> : <RestaurantSettings tab={tab} />}
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

          <Divider label="Promo card" />
          <p className="mb-4 text-sm text-ink-muted">
            The large orange card on the Home screen. Its button opens your first featured dish.
          </p>
          <Toggle label="Show promo card" value={form.promoEnabled} onChange={(v) => set("promoEnabled", v)} />
          {form.promoEnabled && (
            <>
              <Field label="Title">
                <input className="input" maxLength={120} placeholder="Gonna Be a Good Day!"
                       value={form.promoTitle} onChange={(e) => set("promoTitle", e.target.value)} />
              </Field>
              <Field label="Description">
                <input className="input" maxLength={240} placeholder="Free delivery on your first order."
                       value={form.promoText} onChange={(e) => set("promoText", e.target.value)} />
              </Field>
              <Field label="Button label">
                <input className="input" maxLength={40} placeholder="Order Now"
                       value={form.promoCta} onChange={(e) => set("promoCta", e.target.value)} />
              </Field>
              <PromoImageField value={form.promoImageUrl ?? ""} onChange={(v) => set("promoImageUrl", v)} />
            </>
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

/** Promo image picker. Empty means "use the featured dish's own photo", which is what
 *  the app did before this was configurable — so clearing it restores that. */
function PromoImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await MenuApi.uploadImage(file));
    } catch {
      setError("Upload failed. Try a smaller image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label="Promo image">
      <div className="flex items-start gap-3">
        {value ? (
          <img src={value} alt="" className="h-20 w-24 rounded-lg border border-line object-cover" />
        ) : (
          <div className="flex h-20 w-24 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-muted">
            Featured dish
          </div>
        )}
        <div className="flex-1">
          <input type="file" accept="image/*" disabled={uploading}
                 onChange={(e) => pick(e.target.files?.[0])}
                 className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
          <p className="mt-2 text-xs text-ink-muted">
            {uploading ? "Uploading…" : "Leave empty to show the featured dish's photo."}
          </p>
          {value && (
            <button type="button" onClick={() => onChange("")}
                    className="mt-2 text-xs font-semibold text-red-600 hover:underline">
              Remove image
            </button>
          )}
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      </div>
    </Field>
  );
}

/** Invite and list admins. The temporary password is shown once, here, because the
 *  server only keeps its hash — if the email does not arrive there is no second copy. */
function TeamSettings() {
  const qc = useQueryClient();
  const { data: admins, isLoading } = useQuery({ queryKey: ["admins"], queryFn: AdminUsersApi.list });
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [issued, setIssued] = useState<AdminInviteResult | null>(null);

  const invite = useMutation({
    mutationFn: () => AdminUsersApi.invite({ email: email.trim(), fullName: fullName.trim() }),
    onSuccess: (res) => {
      setIssued(res);
      setEmail("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
  });

  return (
    <>
      <h2 className="mb-1 text-lg font-black text-ink">Team</h2>
      <p className="mb-5 text-sm text-ink-muted">
        Admins can manage orders, the menu and settings. A new admin gets a temporary password and must choose
        their own the first time they sign in.
      </p>

      <div className="mb-6 rounded-xl border border-line">
        {isLoading ? (
          <p className="p-4 text-sm text-ink-muted">Loading…</p>
        ) : (
          (admins ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-line p-3 last:border-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                {(a.fullName || a.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{a.fullName || "—"}</p>
                <p className="truncate text-xs text-ink-muted">{a.email}</p>
              </div>
              {a.mustChangePassword && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Pending first sign-in
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {issued && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">Admin created — {issued.email}</p>
          <p className="mt-1 text-sm text-emerald-800">
            Temporary password: <code className="rounded bg-white px-2 py-0.5 font-mono font-bold">{issued.temporaryPassword}</code>
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            {issued.emailed
              ? "Also emailed to them. This is the only time it is shown — copy it if you want a backup."
              : "Email is not configured, so send this to them yourself. It is not shown again."}
          </p>
          <button type="button" onClick={() => setIssued(null)}
                  className="mt-3 text-xs font-semibold text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <Divider label="Invite an admin" />
      <form
        onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}
        className="space-y-1"
      >
        <Field label="Full name">
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ama Mensah" />
        </Field>
        <Field label="Email">
          <input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ama@example.com" />
        </Field>
        <button type="submit" disabled={invite.isPending}
                className="btn-primary mt-3 px-6 py-2.5 disabled:opacity-40">
          {invite.isPending ? "Creating…" : "Create admin"}
        </button>
        {invite.isError && (
          <p className="mt-2 text-sm font-semibold text-red-600">
            {(invite.error as any)?.response?.data?.message ?? "Could not create that admin."}
          </p>
        )}
      </form>
    </>
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
  const mustChange = useAuth((st) => st.mustChangePassword);
  const clearMustChange = useAuth((st) => st.clearMustChangePassword);
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
      // The server clears must_change_password on any successful change; mirror it here
      // so the banner and the redirect stop straight away.
      clearMustChange();
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

      {mustChange && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Choose your own password to finish setting up your account. The temporary one you were
          sent stops working once you do.
        </div>
      )}

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
