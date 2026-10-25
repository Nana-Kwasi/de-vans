import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";
import { BUSINESS_NAME } from "@/theme/format";
import { AuthLayout } from "@/components/AuthLayout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await AuthApi.login(email.trim(), password);
      setAuth(res.token, res.email, res.fullName, res.mustChangePassword);
      // A freshly invited admin is still on their temporary password; send them
      // straight to the change-password screen rather than into the dashboard.
      navigate(res.mustChangePassword ? "/settings?first=1" : "/");
    } catch (err: any) {
      // Distinguish a rejected login from an unreachable API. axios reports both as an
      // error, but with no `response` when the request never landed — reporting that as
      // "Invalid email or password" sends you hunting for a credentials problem that
      // does not exist.
      setError(
        err?.response
          ? err.response.data?.message ?? "Invalid email or password"
          : "Cannot reach the server. Check that the API is running and VITE_API_BASE_URL is correct."
      );
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
            <h1 className="text-2xl font-black text-ink">{BUSINESS_NAME}</h1>
            <p className="-mt-1 text-sm font-semibold text-ink-muted">Owner dashboard</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
        )}

        <label className="label">Email</label>
        <input
          type="email"
          className="input mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <label className="label">Password</label>
        <input
          type="password"
          className="input mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm font-semibold">
          <Link to="/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
