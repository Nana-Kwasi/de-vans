import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";
import { BUSINESS_NAME } from "@/theme/format";

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
      setAuth(res.token, res.email, res.fullName);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4"
      style={{ backgroundImage: "url(/web.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <form onSubmit={submit} className="card relative z-10 w-full max-w-md p-8">
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

        <p className="mt-4 text-center text-xs font-medium text-ink-muted">
          First login uses the seeded password. Change it after signing in.
        </p>
      </form>
    </div>
  );
}
