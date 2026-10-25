import { createContext, useContext, useEffect, useRef } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BUSINESS_NAME } from "@/theme/format";
import { DeliveryJob } from "@/api/types";
import { RiderApi, errorMessage } from "./api";
import { useRiderAuth } from "./store";
import { SharingState, useLocationSharing } from "./useLocationSharing";
import { PolicyGate } from "./PolicyGate";
import { onPoliciesRequired } from "./api";

interface RiderShell {
  available: DeliveryJob[];
  active: DeliveryJob[];
  sharing: SharingState;
  toggleOnline: () => void;
  toggling: boolean;
}

const ShellContext = createContext<RiderShell | null>(null);
export const useRiderShell = () => useContext(ShellContext)!;

const POLL_MS = 5000;

/** Short two-tone chime + vibration when a new request lands, so riders notice it on the road. */
function alertNewRequest() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  } catch {
    /* audio blocked until the rider has tapped the page once — vibration still fires */
  }
}

const tabs = [
  { to: "/rider", label: "Home", icon: "🏠", end: true },
  { to: "/rider/requests", label: "Requests", icon: "📥" },
  { to: "/rider/active", label: "Delivery", icon: "🛵" },
  { to: "/rider/history", label: "Earnings", icon: "💰" },
  { to: "/rider/account", label: "Account", icon: "👤" },
];

export function RiderLayout() {
  const { token, rider, setRider } = useRiderAuth();
  const qc = useQueryClient();
  const location = useLocation();

  const mustChange = !!rider?.mustChangePassword;

  // Policies come after the password: the server refuses everything else until accepted.
  const { data: policies, refetch: refetchPolicies } = useQuery({
    queryKey: ["rider", "policies"],
    queryFn: RiderApi.policies,
    enabled: !!token && !mustChange,
  });
  useEffect(() => onPoliciesRequired(() => refetchPolicies()), [refetchPolicies]);
  const policiesPending = !!policies?.some((p) => !p.accepted);
  const ready = !!token && !mustChange && !!policies && !policiesPending;
  const online = !!rider?.online;

  // Refresh the profile on load so an admin's changes (or deactivation → 401) show up.
  useQuery({
    queryKey: ["rider", "me"],
    queryFn: async () => {
      const me = await RiderApi.me();
      setRider(me);
      return me;
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: active = [] } = useQuery({
    queryKey: ["rider", "active"],
    queryFn: RiderApi.active,
    enabled: ready,
    refetchInterval: POLL_MS,
  });
  const { data: available = [] } = useQuery({
    queryKey: ["rider", "available"],
    queryFn: RiderApi.available,
    enabled: ready,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  // Chime for requests we have not seen before (only while online — offline riders aren't working).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(available.map((j) => j.id));
    if (seen.current && online && available.some((j) => !seen.current!.has(j.id))) alertNewRequest();
    seen.current = ids;
  }, [available, online]);

  const sharing = useLocationSharing(ready && online, active.length > 0);

  const toggle = useMutation({
    mutationFn: () => RiderApi.setOnline(!online),
    onSuccess: (me) => {
      setRider(me);
      qc.invalidateQueries({ queryKey: ["rider"] });
    },
    onError: (e) => window.alert(errorMessage(e)),
  });

  if (!token) return <Navigate to="/rider/login" replace />;
  if (mustChange && location.pathname !== "/rider/account") return <Navigate to="/rider/account?first=1" replace />;

  return (
    <ShellContext.Provider value={{ available, active, sharing, toggleOnline: () => toggle.mutate(), toggling: toggle.isPending }}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-canvas">
        <header className="sticky top-0 z-[1000] flex items-center justify-between border-b border-hairline bg-surface px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-8 w-8 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ink">{rider?.fullName ?? "Rider"}</p>
              <p className="-mt-0.5 text-xs font-semibold text-ink-muted">Rider · {BUSINESS_NAME}</p>
            </div>
          </div>
          {ready && (
            <button
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
              className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black transition ${
                online ? "bg-emerald-500 text-white" : "bg-canvas text-ink-soft"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${online ? "animate-pulse bg-white" : "bg-ink-muted"}`} />
              {online ? "Online" : "Offline"}
            </button>
          )}
        </header>

        {online && (sharing.status === "denied" || sharing.status === "unsupported") && (
          <div className="bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
            📍 Location is blocked. Allow location for this site in your browser settings — customers can't follow you without it.
          </div>
        )}

        <main className="flex-1 px-4 pb-28 pt-4">
          {policiesPending && !mustChange ? <PolicyGate statuses={policies!} /> : <Outlet />}
        </main>

        {!mustChange && !policiesPending && (
          <nav className="fixed inset-x-0 bottom-0 z-[1000] mx-auto flex max-w-xl border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
            {tabs.map((t) => {
              const badge = t.to === "/rider/requests" ? available.length : t.to === "/rider/active" ? active.length : 0;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${isActive ? "text-brand" : "text-ink-muted"}`
                  }
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  {t.label}
                  {badge > 0 && (
                    <span className="absolute right-[22%] top-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-black leading-[18px] text-white">
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </ShellContext.Provider>
  );
}
