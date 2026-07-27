import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MenuApi } from "@/api/endpoints";
import { MenuCategory, MenuItem } from "@/api/types";
import { money } from "@/theme/format";

/** The four fixed categories the mobile app groups meals into. */
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

type MenuTab = "items" | "add";

export function MenuManagementPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<MenuTab>("items");
  const { data: items, isLoading } = useQuery({ queryKey: ["menu-all"], queryFn: MenuApi.list });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MenuItem> }) => MenuApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-all"] }),
  });
  const create = useMutation({
    mutationFn: (body: Partial<MenuItem>) => MenuApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-all"] });
      setTab("items"); // jump to the list so the new item is visible
    },
  });

  const tabs: { key: MenuTab; label: string }[] = [
    { key: "items", label: `Items${items?.length ? ` (${items.length})` : ""}` },
    { key: "add", label: "Add a meal or drink" },
  ];

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink">Menu</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-hairline">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key ? "border-b-2 border-brand text-brand" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        isLoading ? (
          <p className="font-semibold text-ink-muted">Loading…</p>
        ) : !items?.length ? (
          <div className="card p-8 text-center font-semibold text-ink-muted">
            No items yet —{" "}
            <button onClick={() => setTab("add")} className="font-bold text-brand underline">
              add your first meal
            </button>
            .
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onSavePrice={(price) => update.mutate({ id: item.id, body: { price } })}
                onSavePhoto={(photoUrl) => update.mutate({ id: item.id, body: { photoUrl } })}
                onSaveCategory={(category) => update.mutate({ id: item.id, body: { category } })}
                onToggle={() => update.mutate({ id: item.id, body: { available: !item.available } })}
                onToggleFeatured={() => update.mutate({ id: item.id, body: { featured: !item.featured } })}
                busy={update.isPending}
              />
            ))}
          </div>
        )
      ) : (
        <div className="max-w-xl">
          <AddItemForm onCreate={(body) => create.mutate(body)} busy={create.isPending} />
        </div>
      )}
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

function MenuCard({
  item,
  onSavePrice,
  onSavePhoto,
  onSaveCategory,
  onToggle,
  onToggleFeatured,
  busy,
}: {
  item: MenuItem;
  onSavePrice: (price: number) => void;
  onSavePhoto: (photoUrl: string) => void;
  onSaveCategory: (category: MenuCategory) => void;
  onToggle: () => void;
  onToggleFeatured: () => void;
  busy: boolean;
}) {
  const [price, setPrice] = useState(String(item.price));
  const priceDirty = Number(price) !== Number(item.price);

  return (
    <div className={`card flex flex-col gap-3 p-4 ${item.available ? "" : "opacity-70"}`}>
      {/* Image */}
      <div className="relative">
        <ImagePicker url={item.photoUrl} onUploaded={onSavePhoto} size="lg" />
        {item.featured && (
          <span className="absolute left-2 top-2 chip bg-orange-100 text-orange-700">🔥 Hot</span>
        )}
      </div>

      {/* Name + description */}
      <div>
        <p className="truncate font-black text-ink" title={item.name}>{item.name}</p>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-muted">{item.description}</p>
      </div>

      {/* Category */}
      <select
        value={item.category}
        disabled={busy}
        onChange={(e) => onSaveCategory(e.target.value as MenuCategory)}
        className="input py-2 text-sm"
      >
        {MENU_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.emoji} {c.label}
          </option>
        ))}
      </select>

      {/* Price */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-ink-muted">GHS</span>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="input w-full py-2"
        />
        <button
          disabled={!priceDirty || busy}
          onClick={() => onSavePrice(Number(price))}
          className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {/* Toggles */}
      <div className="mt-auto flex gap-2">
        <button
          onClick={onToggle}
          disabled={busy}
          className={`chip flex-1 text-center ${item.available ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
        >
          {item.available ? "Available" : "Sold out"}
        </button>
        <button
          onClick={onToggleFeatured}
          disabled={busy}
          className={`chip flex-1 text-center ${item.featured ? "bg-orange-100 text-orange-700" : "bg-canvas text-ink-muted"}`}
        >
          {item.featured ? "🔥 Hot meal" : "☆ Feature"}
        </button>
      </div>
    </div>
  );
}

function AddItemForm({ onCreate, busy }: { onCreate: (b: Partial<MenuItem>) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [category, setCategory] = useState<MenuCategory | "">("");
  const [featured, setFeatured] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !category) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      photoUrl: photoUrl || undefined,
      category,
      featured,
    });
    setName("");
    setDescription("");
    setPrice("");
    setPhotoUrl("");
    setCategory("");
    setFeatured(false);
  };

  return (
    <form onSubmit={submit} className="card h-fit p-6">
      <h2 className="mb-4 text-lg font-black text-ink">Add a meal or drink</h2>

      <label className="label">Photo</label>
      <div className="mb-4">
        <ImagePicker url={photoUrl} onUploaded={setPhotoUrl} size="lg" />
        <p className="mt-1.5 text-xs text-ink-muted">Click to upload from your computer.</p>
      </div>

      <label className="label">Name</label>
      <input className="input mb-3" placeholder="Jollof Rice with Chicken" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="label">Category</label>
      <select
        className="input mb-3"
        value={category}
        onChange={(e) => setCategory(e.target.value as MenuCategory)}
      >
        <option value="" disabled>
          Choose a category…
        </option>
        {MENU_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.emoji} {c.label}
          </option>
        ))}
      </select>

      <label className="label">Description</label>
      <textarea className="input mb-3" placeholder="Short description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

      <label className="label">Price (GHS)</label>
      <input className="input mb-4" placeholder="55.00" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />

      <button
        type="button"
        onClick={() => setFeatured((f) => !f)}
        className={`mb-5 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition ${
          featured ? "border-brand bg-brand-soft text-brand" : "border-hairline bg-canvas text-ink-soft"
        }`}
      >
        <span>🔥 Feature as a Hot meal</span>
        <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${featured ? "bg-brand" : "bg-hairline"}`}>
          <span className={`h-5 w-5 rounded-full bg-white shadow transition ${featured ? "translate-x-5" : ""}`} />
        </span>
      </button>

      <button
        type="submit"
        disabled={busy || !name.trim() || !price || !category}
        className="btn-primary w-full py-3 disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add item"}
      </button>
    </form>
  );
}
