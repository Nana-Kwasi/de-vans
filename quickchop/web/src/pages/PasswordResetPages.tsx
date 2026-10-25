import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthApi } from "@/api/endpoints";
import { BUSINESS_NAME } from "@/theme/format";
import { AuthLayout } from "@/components/AuthLayout";

const apiError = (e: any, fallback: string) =>
  e?.response?.data?.message ?? (e?.response ? fallback : "Cannot reach the server. Check your connection.");

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthLayout>
      <div className="card w-full p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-2xl font-black text-ink">{title}</h1>
            <p className="-mt-1 text-sm font-semibold text-ink-muted">{BUSINESS_NAME}</p>
          </div>
        </div>
        {children}
      </div>
    </AuthLayout>
  );
}

/** Asks for a reset link. The reply is the same whether or not the email is an admin. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await AuthApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(apiError(err, "Could not send the reset link. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Reset password">
      {sent ? (
        <>
          <p className="text-sm text-ink-soft">
            If <b>{email.trim()}</b> belongs to an admin account, a reset link is on its way. It expires in 60 minutes —
            check spam if it doesn't arrive.
          </p>
          <Link to="/login" className="btn-primary mt-6 block w-full py-3 text-center">Back to sign in</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}
          <p className="mb-4 text-sm text-ink-soft">Enter your admin email and we'll send you a link to choose a new password.</p>
          <label className="label">Email</label>
          <input type="email" className="input mb-6" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus maxLength={160} />
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? "Sending…" : "Send reset link"}</button>
          <p className="mt-4 text-center text-sm font-semibold">
            <Link to="/login" className="text-ink-muted hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </Shell>
  );
}

/** Opened from the emailed link (/reset-password?token=…). Tokens are single-use and expire. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setLoading(true);
    try {
      await AuthApi.resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      setError(apiError(err, "This reset link is invalid or has expired."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Choose a new password">
      {done ? (
        <>
          <p className="text-sm text-ink-soft">Your password has been changed. Sign in with the new one.</p>
          <button onClick={() => navigate("/login", { replace: true })} className="btn-primary mt-6 w-full py-3">Sign in</button>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}
          {!params.get("token") && (
            <>
              <label className="label">Reset code (from the email)</label>
              <input className="input mb-4" value={token} onChange={(e) => setToken(e.target.value)} required />
            </>
          )}
          <label className="label">New password</label>
          <input type="password" autoComplete="new-password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={200} autoFocus />
          <label className="label">Confirm new password</label>
          <input type="password" autoComplete="new-password" className="input mb-6" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={200} />
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </Shell>
  );
}
