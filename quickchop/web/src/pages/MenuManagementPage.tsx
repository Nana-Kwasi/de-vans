import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MenuApi } from "@/api/endpoints";
import { DrinkType, MenuCategory, MenuItem } from "@/api/types";
import { money } from "@/theme/format";

/** The four fixed categories the mobile app groups meals into (drinks split soft/local). */
const MENU_CATEGORIES: { key: MenuCategory; label: string; emoji: string }[] = [
  { key: "rice", label: "Rice", emoji: "🍚" },
  { key: "chicken", label: "Chicken", emoji: "🍗" },
  { key: "salad", label: "Salad", emoji: "🥗" },
  { key: "drinks", label: "Drinks", emoji: "🥤" },
];

/** Pulls the backend's error message ({ message }) out of an axios error, else a fallback. */
function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? err.message ?? fallback;
  }
  return fallback;
}

/**
 * <img> that retries on load failure. A freshly-uploaded Supabase public URL can
 * 404 for a moment while the CDN populates; without this the preview shows broken
 * even though the image is fine seconds later. Cache-busts each retry so the
 * browser actually re-requests, backing off up to MAX attempts.
 */
function RetryingImage({ src, className }: { src: string; className?: string }) {
  const MAX = 4;
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  if (failed) {
    return <span className="flex h-full w-full items-center justify-center text-lg" title="Image failed to load">⚠️</span>;
  }

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;
  return (
    <img
      src={url}
      alt=""
      className={className}
      onError={() => {
        if (attempt < MAX) {
          setTimeout(() => setAttempt((a) => a + 1), 600 * (attempt + 1));
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

type Shelf = "all" | "rice" | "chicken" | "salad" | "soft" | "local";

const SHELVES: { key: Shelf; label: string }[] = [
  { key: "all", label: "All" },
  { key: "rice", label: "🍚 Rice" },
  { key: "chicken", label: "🍗 Chicken" },
  { key: "salad", label: "🥗 Salad" },
  { key: "soft", label: "🥤 Soft drinks" },
  { key: "local", label: "🍹 Local drinks" },
];

const shelfOf = (m: MenuItem): Shelf =>
  m.category === "drinks" ? (m.drinkType === "local" ? "local" : "soft") : (m.category as Shelf);

const shelfLabel = (m: MenuItem) => SHELVES.find((s) => s.key === shelfOf(m))?.label ?? m.category;

export function MenuManagementPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [shelf, setShelf] = useState<Shelf>("all");
  const [text, setText] = useState(params.get("q") ?? "");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["menu-all"], queryFn: MenuApi.list });

  useEffect(() => {
    const q = params.get("q");
    if (q) setText(q);
  }, [params]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["menu-all"] });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MenuItem> }) => MenuApi.update(id, body),
    onSuccess: refresh,
    onError: (e) => alert(errMessage(e, "Could not save.")),
  });

  const counts = useMemo(() => {
    const c = new Map<Shelf, number>([["all", items.length]]);
    items.forEach((m) => c.set(shelfOf(m), (c.get(shelfOf(m)) ?? 0) + 1));
    return c;
  }, [items]);

  const shown = items
    .filter((m) => shelf === "all" || shelfOf(m) === shelf)
    .filter((m) => !text.trim() || `${m.name} ${m.description ?? ""}`.toLowerCase().includes(text.trim().toLowerCase()))
    .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));

  const stats = [
    { label: "Items", value: items.length, style: "text-ink" },
    { label: "Available", value: items.filter((m) => m.available).length, style: "text-emerald-600" },
    { label: "Sold out", value: items.filter((m) => !m.available).length, style: "text-red-600" },
    { label: "Hot meals", value: items.filter((m) => m.featured).length, style: "text-brand" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Menu</h1>
          <p className="text-sm font-semibold text-ink-muted">What customers see in the app. Changes show up immediately.</p>
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary">+ Add item</button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{s.label}</p>
            <p className={`text-2xl font-black ${s.style}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {SHELVES.map((s) => (
            <button
              key={s.key}
              onClick={() => setShelf(s.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition ${
                shelf === s.key ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft hover:bg-canvas"
              }`}
            >
              {s.label}
              <span className={`rounded-full px-1.5 text-xs ${shelf === s.key ? "bg-white/25" : "bg-canvas text-ink-muted"}`}>
                {counts.get(s.key) ?? 0}
              </span>
            </button>
          ))}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search the menu…" className="input py-2.5 lg:w-64" />
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-ink-muted">{items.length ? "Nothing matches." : "No items yet."}</p>
          <button onClick={() => setEditing("new")} className="btn-primary mt-4">+ Add item</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              busy={update.isPending}
              onEdit={() => setEditing(item)}
              onToggle={() => update.mutate({ id: item.id, body: { available: !item.available } })}
              onToggleFeatured={() => update.mutate({ id: item.id, body: { featured: !item.featured } })}
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemModal
          item={editing === "new" ? null : editing}
          defaultShelf={shelf}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Switch({ on, onClick, disabled, label, tone }: { on: boolean; onClick: () => void; disabled?: boolean; label: string; tone: "green" | "brand" }) {
  const bg = on ? (tone === "green" ? "bg-emerald-500" : "bg-brand") : "bg-hairline";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-2 text-xs font-bold text-ink-soft disabled:opacity-50">
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${bg}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${on ? "translate-x-4" : ""}`} />
      </span>
      {label}
    </button>
  );
}

function MenuCard({ item, busy, onEdit, onToggle, onToggleFeatured }: {
  item: MenuItem;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onToggleFeatured: () => void;
}) {
  return (
    <div className={`card flex flex-col overflow-hidden ${item.available ? "" : "opacity-75"}`}>
      <button onClick={onEdit} className="relative aspect-[4/3] w-full bg-canvas">
        {item.photoUrl ? (
          <RetryingImage src={item.photoUrl} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-4xl text-ink-muted">📷</span>
        )}
        <span className="absolute left-2 top-2 flex gap-1">
          {item.featured && <span className="chip bg-white/95 text-orange-700 shadow-soft">🔥 Hot</span>}
          {!item.available && <span className="chip bg-red-600 text-white shadow-soft">Sold out</span>}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black leading-tight text-ink">{item.name}</p>
          <p className="shrink-0 font-black text-brand">{money(item.price)}</p>
        </div>
        <span className="mt-1 w-fit rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink-muted">{shelfLabel(item)}</span>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{item.description}</p>}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <div className="flex flex-col gap-2">
            <Switch on={item.available} onClick={onToggle} disabled={busy} label={item.available ? "Available" : "Sold out"} tone="green" />
            <Switch on={!!item.featured} onClick={onToggleFeatured} disabled={busy} label="Hot meal" tone="brand" />
          </div>
          <button onClick={onEdit} className="btn-ghost px-4 py-2 text-sm">Edit</button>
        </div>
      </div>
    </div>
  );
}

/** Add or edit an item. Drinks also pick a shelf: soft (bottled) or local (sobolo, ginger…). */
function ItemModal({ item, defaultShelf, onClose, onSaved }: {
  item: MenuItem | null;
  defaultShelf: Shelf;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialCategory: MenuCategory | "" = item?.category
    ?? (defaultShelf === "soft" || defaultShelf === "local" ? "drinks" : defaultShelf === "all" ? "" : defaultShelf);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? "");
  const [category, setCategory] = useState<MenuCategory | "">(initialCategory);
  const [drinkType, setDrinkType] = useState<DrinkType>(item?.drinkType ?? (defaultShelf === "local" ? "local" : "soft"));
  const [available, setAvailable] = useState(item?.available ?? true);
  const [featured, setFeatured] = useState(!!item?.featured);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() && Number(price) >= 0 && price !== "" && category;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const body: Partial<MenuItem> = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      photoUrl: photoUrl || undefined,
      category: category as MenuCategory,
      drinkType: category === "drinks" ? drinkType : undefined,
      available,
      featured,
    };
    try {
      if (item) await MenuApi.update(item.id, body);
      else await MenuApi.create(body);
      onSaved();
    } catch (err) {
      setError(errMessage(err, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-card sm:rounded-card sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">{item ? `Edit ${item.name}` : "Add a meal or drink"}</h2>
          <button type="button" onClick={onClose} className="text-xl text-ink-muted">✕</button>
        </div>
        {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        <ImagePicker url={photoUrl} onUploaded={setPhotoUrl} size="lg" />
        <p className="mb-4 mt-1.5 text-xs text-ink-muted">Tap the photo to upload. Square or landscape photos look best.</p>

        <label className="label">Name</label>
        <input className="input mb-3" placeholder="e.g. Jollof Rice with Chicken, Sobolo" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />

        <label className="label">Category</label>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MENU_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                category === c.key ? "border-brand bg-brand-soft text-brand" : "border-hairline bg-canvas text-ink-soft"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {category === "drinks" && (
          <>
            <label className="label">Drink type</label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([["soft", "🥤 Soft drink", "Coke, Malta, water…"], ["local", "🍹 Local drink", "Sobolo, ginger, watermelon…"]] as const).map(([key, label, hint]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setDrinkType(key)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    drinkType === key ? "border-brand bg-brand-soft" : "border-hairline bg-canvas"
                  }`}
                >
                  <span className={`block text-sm font-bold ${drinkType === key ? "text-brand" : "text-ink"}`}>{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="label">Description</label>
        <textarea className="input mb-3" rows={2} placeholder="Short description customers will read" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="label">Price (GHS)</label>
        <input className="input mb-4" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />

        <div className="mb-5 flex flex-wrap gap-5 rounded-xl bg-canvas px-4 py-3">
          <Switch on={available} onClick={() => setAvailable((v) => !v)} label={available ? "Available" : "Sold out"} tone="green" />
          <Switch on={featured} onClick={() => setFeatured((v) => !v)} label="🔥 Feature as Hot meal" tone="brand" />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
          <button type="submit" disabled={saving || !valid} className="btn-primary flex-1 py-3 disabled:opacity-40">
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ImagePicker({
  url,
  onUploaded,
  size = "sm",
}: {
  url?: string | null;
  onUploaded: (url: string) => void;
  size?: "sm" | "lg";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dim = size === "lg" ? "h-32 w-full" : "h-16 w-16";

  const pick = () => ref.current?.click();
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onUploaded(await MenuApi.uploadImage(file));
    } catch (err) {
      alert(errMessage(err, "Image upload failed. Try again."));
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <button
      type="button"
      onClick={pick}
      className={`relative flex ${dim} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-hairline bg-canvas text-2xl transition hover:border-brand`}
    >
      {url ? (
        <RetryingImage src={url} className="h-full w-full object-cover" />
      ) : (
        <span className="text-ink-muted">📷</span>
      )}
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-bold text-brand">
          Uploading…
        </span>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </button>
  );
}

