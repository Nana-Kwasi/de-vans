import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BUSINESS_NAME } from "@/theme/format";
import { AuthLayout } from "@/components/AuthLayout";
import { RiderApi, errorMessage } from "../api";
import { useRiderAuth } from "../store";

export function RiderLoginPage() {
  const { token, setSession } = useRiderAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/rider" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await RiderApi.login(phone.trim(), password);
      setSession(res.token, res.rider);
      navigate(res.rider.mustChangePassword ? "/rider/account?first=1" : "/rider", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Invalid phone number or password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="card w-full p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-black text-ink">Rider sign in</h1>
            <p className="-mt-0.5 text-sm font-semibold text-ink-muted">{BUSINESS_NAME}</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        <label className="label">Phone number</label>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="username"
          className="input mb-4"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="024 123 4567"
          required
          maxLength={20}
        />

        <label className="label">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          className="input mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          maxLength={200}
        />

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs font-medium text-ink-muted">
          Rider accounts are created by the restaurant. Forgot your password? Ask the restaurant to reset it.
        </p>
      </form>
    </AuthLayout>
  );
}
