import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { BUSINESS_NAME } from "@/theme/format";

const nav = [
  { to: "/", label: "Dashboard", icon: "🏠", end: true },
  { to: "/orders", label: "Live Orders", icon: "🧾" },
  { to: "/menu", label: "Menu", icon: "🍽️" },
  { to: "/sales", label: "Sales", icon: "📊" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/reviews", label: "Reviews", icon: "⭐" },
  { to: "/support", label: "Support", icon: "💬" },
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
        {/* Mobile top bar + nav */}
        <header className="flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 md:hidden">
          <p className="text-lg font-black text-ink">{BUSINESS_NAME} Admin</p>
          <button onClick={signOut} className="text-sm font-bold text-brand-dark">Sign out</button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-hairline bg-surface px-4 py-2 md:hidden">
          <NavItems />
        </nav>

        <main className="flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
