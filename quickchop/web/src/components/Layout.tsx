import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { BUSINESS_NAME } from "@/theme/format";
import { GlobalSearch } from "@/components/GlobalSearch";

const nav = [
  { to: "/", label: "Dashboard", icon: "🏠", end: true },
  { to: "/orders", label: "Live Orders", icon: "🧾" },
  { to: "/deliveries", label: "Deliveries", icon: "🛵" },
  { to: "/riders", label: "Riders", icon: "🪪" },
  { to: "/menu", label: "Menu", icon: "🍽️" },
  { to: "/sales", label: "Sales", icon: "📊" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/reviews", label: "Reviews", icon: "⭐" },
  { to: "/support", label: "Support", icon: "💬" },
  { to: "/policies", label: "Policies", icon: "📜" },
  { to: "/consents", label: "Consents", icon: "✅" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
              isActive ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-canvas"
            }`
          }
        >
          <span className="text-lg">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { fullName, email, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = nav.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  // Close the phone menu whenever the page changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const initial = (fullName ?? email ?? "A")[0]?.toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-hairline bg-surface p-5 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <p className="text-lg font-black text-ink">{BUSINESS_NAME}</p>
            <p className="-mt-1 text-xs font-semibold text-ink-muted">Admin</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <NavItems />
        </nav>

        <div className="mt-4 border-t border-hairline pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-black text-brand">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{fullName ?? "Admin"}</p>
              <p className="truncate text-xs text-ink-muted">{email}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-bold text-brand-dark hover:bg-canvas">
            ← Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone/tablet top bar: current section + a menu button that opens every section. */}
        <header className="sticky top-0 z-[1500] flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ink">{current?.label ?? "Admin"}</p>
              <p className="-mt-0.5 truncate text-xs font-semibold text-ink-muted">{BUSINESS_NAME}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
          <GlobalSearch variant="icon" />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-xl text-ink"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          </div>
        </header>
        {/* Desktop top bar */}
        <div className="sticky top-0 z-[1500] hidden items-center border-b border-hairline bg-surface/90 px-8 py-3 backdrop-blur md:flex">
          <GlobalSearch variant="bar" />
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[1400] bg-black/30 md:hidden" onClick={() => setMenuOpen(false)} />
            <div className="fixed inset-x-0 top-[57px] z-[1450] max-h-[calc(100vh-57px)] overflow-y-auto border-b border-hairline bg-surface p-3 shadow-card md:hidden">
              <nav className="grid grid-cols-2 gap-1">
                <NavItems onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="mt-3 flex items-center justify-between border-t border-hairline px-2 pt-3">
                <p className="min-w-0 truncate text-xs font-semibold text-ink-muted">{email}</p>
                <button onClick={signOut} className="shrink-0 text-sm font-bold text-brand-dark">Sign out</button>
              </div>
            </div>
          </>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
