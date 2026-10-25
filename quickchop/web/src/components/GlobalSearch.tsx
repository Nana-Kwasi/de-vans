import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SearchApi } from "@/api/endpoints";
import { money } from "@/theme/format";
import { STATUS_STYLE, ago, statusLabel } from "@/theme/orders";

interface Hit {
  key: string;
  group: string;
  title: string;
  subtitle: string;
  badge?: { text: string; style: string };
  to: string;
}

/** Waits until typing pauses before searching, so each keystroke isn't a request. */
function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Search anything from anywhere: orders (number, full id, phone, address, customer name),
 * customers, menu items and riders. Opens with the header button or Ctrl/⌘ K.
 */
export function GlobalSearch({ variant }: { variant: "bar" | "icon" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {variant === "bar" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full max-w-md items-center gap-3 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-left text-sm text-ink-muted transition hover:border-brand"
        >
          <span>🔍</span>
          <span className="flex-1 truncate">Search orders, customers, menu, riders…</span>
          <kbd className="rounded-md border border-hairline bg-white px-1.5 text-[11px] font-bold">Ctrl K</kbd>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-lg"
        >
          🔍
        </button>
      )}
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const q = useDebounced(text.trim(), 250);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => SearchApi.search(q),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });

  const hits: Hit[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.orders.map((o) => ({
        key: `o${o.id}`,
        group: "Orders",
        title: `${o.orderNumber} · ${money(o.total)}`,
        subtitle: `${o.customerName ?? "Customer"} · ${o.pickup ? "Pickup" : "Delivery"} · ${ago(o.createdAt)}`,
        badge: { text: statusLabel(o.status, o.pickup), style: STATUS_STYLE[o.status] },
        to: `/orders/${o.id}`,
      })),
      ...data.customers.map((c) => ({
        key: `c${c.id}`,
        group: "Customers",
        title: c.fullName,
        subtitle: [c.phoneNumber, c.email, `${c.orderCount} order${c.orderCount === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
        to: `/customers?id=${c.id}`,
      })),
      ...data.menu.map((m) => ({
        key: `m${m.id}`,
        group: "Menu",
        title: m.name,
        subtitle: `${money(m.price)} · ${m.category}${m.drinkType ? ` (${m.drinkType})` : ""}${m.available ? "" : " · sold out"}`,
        to: `/menu?q=${encodeURIComponent(m.name)}`,
      })),
      ...data.riders.map((r) => ({
        key: `r${r.id}`,
        group: "Riders",
        title: r.fullName,
        subtitle: `${r.phoneNumber} · ${!r.active ? "deactivated" : r.online ? "online" : "offline"}`,
        to: `/riders?q=${encodeURIComponent(r.fullName)}`,
      })),
    ];
  }, [data]);

  useEffect(() => setCursor(0), [hits]);

  const go = (hit?: Hit) => {
    if (!hit) return;
    onClose();
    navigate(hit.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") go(hits[cursor]);
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/40 p-3 pt-[8vh] sm:p-4 sm:pt-[12vh]" onClick={onClose}>
      <div className="card w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <span className="text-lg">🔍</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Order number, name, phone, dish, rider…"
            className="flex-1 bg-transparent py-4 text-base text-ink outline-none placeholder:text-ink-muted"
            maxLength={100}
          />
          <button onClick={onClose} className="text-sm font-bold text-ink-muted">Esc</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="p-6 text-center text-sm text-ink-muted">Type at least 2 characters. Try an order number like QC-001001, a phone number or a name.</p>
          ) : isFetching && !data ? (
            <p className="p-6 text-center text-sm text-ink-muted">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-muted">Nothing matches “{q}”.</p>
          ) : (
            hits.map((h, i) => {
              const header = h.group !== lastGroup ? ((lastGroup = h.group), h.group) : null;
              return (
                <div key={h.key}>
                  {header && <p className="px-3 pb-1 pt-3 text-[11px] font-black uppercase tracking-wide text-ink-muted">{header}</p>}
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${i === cursor ? "bg-brand-soft" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-ink">{h.title}</span>
                      <span className="block truncate text-xs text-ink-muted">{h.subtitle}</span>
                    </span>
                    {h.badge && <span className={`chip shrink-0 text-[11px] ${h.badge.style}`}>{h.badge.text}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
