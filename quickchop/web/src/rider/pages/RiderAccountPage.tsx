import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { VEHICLE_LABEL } from "@/theme/delivery";
import { RiderApi, errorMessage } from "../api";
import { useRiderAuth } from "../store";

export function RiderAccountPage() {
  const { rider, setSession, logout } = useRiderAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const first = params.get("first") === "1" || !!rider?.mustChangePassword;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "The new passwords don't match." });
    setSaving(true);
    try {
      // The server revokes the old token and hands back a new one.
      const res = await RiderApi.changePassword(current, next);
      setSession(res.token, res.rider);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ ok: true, text: "Password changed." });
      if (first) navigate("/rider", { replace: true });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await RiderApi.logout(); // revokes the session on every device
    } catch {
      /* signing out locally still matters if the call fails */
    }
    logout();
    qc.clear();
    navigate("/rider/login", { replace: true });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">Account</h1>

      {first && (
        <div className="rounded-2xl bg-brand-soft p-4 text-sm font-bold text-brand-dark">
          Welcome! Choose your own password before you start — the one you were given is temporary.
        </div>
      )}

      {!first && rider && (
        <div className="card space-y-1 p-5 text-sm">
          <p className="text-lg font-black text-ink">{rider.fullName}</p>
          <p className="text-ink-soft">📞 {rider.phoneNumber}</p>
          {rider.email && <p className="text-ink-soft">✉️ {rider.email}</p>}
          <p className="text-ink-soft">{VEHICLE_LABEL[rider.vehicleType] ?? rider.vehicleType}{rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ""}</p>
          <p className="pt-2 text-xs text-ink-muted">To change these details, contact the restaurant.</p>
        </div>
      )}

      <form onSubmit={change} className="card p-5">
        <h2 className="mb-3 font-black text-ink">{first ? "Set your password" : "Change password"}</h2>
        {msg && (
          <div className={`mb-3 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>
        )}
        <label className="label">{first ? "Temporary password" : "Current password"}</label>
        <input type="password" autoComplete="current-password" className="input mb-3" value={current} onChange={(e) => setCurrent(e.target.value)} required maxLength={200} />
        <label className="label">New password</label>
        <input type="password" autoComplete="new-password" className="input mb-3" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={200} />
        <label className="label">Confirm new password</label>
        <input type="password" autoComplete="new-password" className="input mb-4" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={200} />
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">{saving ? "Saving…" : "Save password"}</button>
      </form>

      <div className="card p-5 text-sm text-ink-soft">
        <p className="font-black text-ink">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Add this page to your home screen (browser menu → "Add to Home screen").</li>
          <li>Keep it open while delivering so the customer can follow you on the map.</li>
          <li>Never share your password. The restaurant will never ask for it.</li>
        </ul>
      </div>

      <div className="card p-5 text-sm">
        <p className="mb-2 font-black text-ink">Policies</p>
        <a href="/legal/rider-terms" target="_blank" rel="noreferrer" className="block py-1 font-bold text-brand">Rider Agreement ↗</a>
        <a href="/legal/rider-privacy" target="_blank" rel="noreferrer" className="block py-1 font-bold text-brand">Rider Privacy Notice ↗</a>
      </div>

      <button onClick={signOut} className="btn-ghost w-full py-3 text-red-600">Sign out</button>
    </div>
  );
}
