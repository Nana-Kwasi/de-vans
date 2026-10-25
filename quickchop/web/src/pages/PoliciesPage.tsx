import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PoliciesApi } from "@/api/endpoints";
import { AdminPolicy, Policy } from "@/api/types";
import { dateTime } from "@/theme/format";
import { Markdown } from "@/components/Markdown";

const apiError = (e: any) => e?.response?.data?.message ?? "Something went wrong.";

const LABEL: Record<string, { name: string; who: string }> = {
  CUSTOMER_PRIVACY: { name: "Customer Privacy Policy", who: "Customers" },
  CUSTOMER_TERMS: { name: "Customer Terms of Service", who: "Customers" },
  RIDER_PRIVACY: { name: "Rider Privacy Notice", who: "Riders" },
  RIDER_TERMS: { name: "Rider Agreement", who: "Riders" },
};

/**
 * Edit and publish policies. Publishing never changes an existing version — it creates
 * the next one — and everyone in that audience must accept it again.
 */
export function PoliciesPage() {
  const { data: policies = [], isLoading } = useQuery({ queryKey: ["admin-policies"], queryFn: PoliciesApi.overview });
  const [selected, setSelected] = useState<string>("CUSTOMER_PRIVACY");
  const current = policies.find((p) => p.type === selected);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Policies</h1>
          <p className="text-sm font-semibold text-ink-muted">What customers and riders agree to. Publishing a change asks everyone to accept again.</p>
        </div>
        <Link to="/consents" className="btn-ghost">View acceptance records →</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {policies.map((p) => {
          const pct = p.totalUsers ? Math.round((p.acceptedCurrent / p.totalUsers) * 100) : 0;
          return (
            <button
              key={p.type}
              onClick={() => setSelected(p.type)}
              className={`card p-4 text-left transition ${selected === p.type ? "ring-2 ring-brand" : "hover:shadow-soft"}`}
            >
              <p className="text-[11px] font-black uppercase tracking-wide text-ink-muted">{LABEL[p.type].who}</p>
              <p className="font-black text-ink">{LABEL[p.type].name}</p>
              <p className="mt-1 text-xs text-ink-muted">
                v{p.current?.version ?? "—"} · {p.current ? dateTime(p.current.publishedAt) : "not published"}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs font-bold text-ink-soft">{p.acceptedCurrent} / {p.totalUsers} accepted this version</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : current ? (
        <Editor key={current.type + (current.current?.version ?? 0)} policy={current} />
      ) : null}
    </div>
  );
}

function Editor({ policy }: { policy: AdminPolicy }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(policy.current?.title ?? LABEL[policy.type].name);
  const [content, setContent] = useState(policy.current?.content ?? "");
  const [summary, setSummary] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [viewing, setViewing] = useState<Policy | null>(null);
  const changed = title !== (policy.current?.title ?? "") || content.trim() !== (policy.current?.content ?? "").trim();
  const nextVersion = (policy.current?.version ?? 0) + 1;

  useEffect(() => setMode("edit"), [policy.type]);

  const publish = useMutation({
    mutationFn: () => PoliciesApi.publish(policy.slug, { title: title.trim(), content, changeSummary: summary.trim() || undefined }),
    onSuccess: () => {
      setSummary("");
      qc.invalidateQueries({ queryKey: ["admin-policies"] });
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
    onError: (e) => window.alert(apiError(e)),
  });

  const openVersion = async (id: string) => {
    try {
      setViewing(await PoliciesApi.version(id));
    } catch (e) {
      window.alert(apiError(e));
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="card p-5 xl:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full bg-canvas p-1">
            {(["edit", "preview"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${mode === m ? "bg-white text-ink shadow-soft" : "text-ink-muted"}`}>
                {m === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
          <a href={`/legal/${policy.slug}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand">Public page ↗</a>
        </div>

        <label className="label">Title</label>
        <input className="input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />

        {mode === "edit" ? (
          <>
            <label className="label">Content</label>
            <textarea
              className="input min-h-[480px] font-mono text-[13px] leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck
            />
            <p className="mt-1 text-xs text-ink-muted">Formatting: <code>## Heading</code>, <code>- list item</code>, <code>**bold**</code>. Blank line = new paragraph.</p>
          </>
        ) : (
          <div className="max-h-[560px] overflow-y-auto rounded-xl border border-hairline p-5">
            <p className="text-2xl font-black text-ink">{title}</p>
            <Markdown source={content} />
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-canvas p-4">
          <label className="label">What changed? (shown in the version history)</label>
          <input className="input mb-3 bg-white" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} placeholder="e.g. Added Paystack as payment provider" />
          <button
            disabled={!changed || !title.trim() || !content.trim() || publish.isPending}
            onClick={() =>
              window.confirm(`Publish version ${nextVersion} of "${title}"?\n\nEvery ${LABEL[policy.type].who.toLowerCase().slice(0, -1)} will have to read and accept it again before they can continue.`) &&
              publish.mutate()
            }
            className="btn-primary w-full py-3 disabled:opacity-40"
          >
            {publish.isPending ? "Publishing…" : changed ? `Publish version ${nextVersion}` : "No changes to publish"}
          </button>
        </div>
      </div>

      <div className="card h-fit p-5">
        <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-ink-muted">Version history</h2>
        <ol className="space-y-2">
          {policy.versions.map((v, i) => (
            <li key={v.id}>
              <button onClick={() => openVersion(v.id)} className="w-full rounded-xl p-3 text-left hover:bg-canvas">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-ink">Version {v.version}</span>
                  {i === 0 && <span className="chip bg-emerald-100 text-emerald-700">Current</span>}
                </div>
                <p className="text-xs text-ink-muted">{dateTime(v.publishedAt)}</p>
                {v.changeSummary && <p className="mt-1 text-xs text-ink-soft">{v.changeSummary}</p>}
                <p className="mt-1 truncate font-mono text-[10px] text-ink-muted" title={v.contentSha256}>SHA-256 {v.contentSha256.slice(0, 16)}…</p>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(null)}>
          <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black text-ink">{viewing.title}</p>
                <p className="text-xs text-ink-muted">Version {viewing.version} · published {dateTime(viewing.publishedAt)}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-xl text-ink-muted">✕</button>
            </div>
            <p className="mb-2 break-all font-mono text-[10px] text-ink-muted">SHA-256 {viewing.contentSha256}</p>
            <Markdown source={viewing.content} />
          </div>
        </div>
      )}
    </div>
  );
}
