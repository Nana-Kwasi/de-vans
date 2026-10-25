import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PoliciesApi } from "@/api/endpoints";
import { ConsentCell, ConsentRow, PolicyTypeName } from "@/api/types";
import { dateTime } from "@/theme/format";

type Audience = "customer" | "rider";

const SHORT: Record<PolicyTypeName, string> = {
  CUSTOMER_PRIVACY: "Privacy Policy",
  CUSTOMER_TERMS: "Terms of Service",
  RIDER_PRIVACY: "Privacy Notice",
  RIDER_TERMS: "Rider Agreement",
};

function Cell({ c }: { c: ConsentCell }) {
  if (c.upToDate) {
    return (
      <span className="inline-flex flex-col">
        <span className="chip w-fit bg-emerald-100 text-emerald-700">✓ v{c.acceptedVersion}</span>
        <span className="mt-0.5 text-[11px] text-ink-muted">{c.acceptedAt ? dateTime(c.acceptedAt) : ""}</span>
      </span>
    );
  }
  if (c.acceptedVersion != null) {
    return (
      <span className="inline-flex flex-col">
        <span className="chip w-fit bg-amber-100 text-amber-800">Old v{c.acceptedVersion} (now v{c.currentVersion})</span>
        <span className="mt-0.5 text-[11px] text-ink-muted">{c.acceptedAt ? dateTime(c.acceptedAt) : ""}</span>
      </span>
    );
  }
  return <span className="chip bg-red-50 text-red-600">✗ Not accepted</span>;
}

/** Who has accepted what — every customer or rider, with proof on demand. */
export function ConsentsPage() {
  const [audience, setAudience] = useState<Audience>("customer");
  const [filter, setFilter] = useState<"all" | "accepted" | "pending">("all");
  const [text, setText] = useState("");
  const [proofFor, setProofFor] = useState<ConsentRow | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["consents", audience], queryFn: () => PoliciesApi.consents(audience) });

  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (filter === "accepted" && !r.allAccepted) return false;
      if (filter === "pending" && r.allAccepted) return false;
      return !t || [r.name, r.email, r.phone].some((v) => v?.toLowerCase().includes(t));
    });
  }, [data, filter, text]);

  const total = data?.totalUsers ?? 0;
  const accepted = data?.fullyAccepted ?? 0;
  const types = (data?.rows[0]?.policies ?? []).map((c) => c.type);

  const exportCsv = () => {
    if (!data) return;
    const head = ["Name", "Phone", "Email", "Joined", ...types.flatMap((t) => [`${SHORT[t]} version`, `${SHORT[t]} accepted at`]), "All accepted"];
    const lines = data.rows.map((r) => [
      r.name, r.phone ?? "", r.email ?? "", r.joinedAt,
      ...r.policies.flatMap((c) => [c.acceptedVersion != null ? `v${c.acceptedVersion}` : "", c.acceptedAt ?? ""]),
      r.allAccepted ? "yes" : "no",
    ]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${audience}-policy-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">Policy acceptance</h1>
          <p className="text-sm font-semibold text-ink-muted">Who has agreed to the current policies, with proof of each acceptance.</p>
        </div>
        <button onClick={exportCsv} disabled={!data} className="btn-ghost">⬇ Export CSV</button>
      </div>

      <div className="mb-5 flex gap-2">
        {(["customer", "rider"] as Audience[]).map((a) => (
          <button key={a} onClick={() => setAudience(a)} className={`rounded-full px-4 py-2 text-sm font-bold ${audience === a ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft"}`}>
            {a === "customer" ? "Customers" : "Riders"}
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: `Total ${audience}s`, value: total, style: "text-ink" },
          { label: "Accepted all current", value: accepted, style: "text-emerald-600" },
          { label: "Still to accept", value: total - accepted, style: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{s.label}</p>
            <p className={`text-2xl font-black ${s.style}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {(["all", "accepted", "pending"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${filter === f ? "bg-ink text-white" : "bg-surface text-ink-soft shadow-soft"}`}>
              {f === "all" ? "All" : f === "accepted" ? "Accepted" : "Not accepted"}
            </button>
          ))}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search name, phone, email…" className="input py-2 sm:ml-auto sm:w-72" />
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No {audience}s here.</div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">{audience === "customer" ? "Customer" : "Rider"}</th>
                  <th className="px-4 py-3">Joined</th>
                  {types.map((t) => (
                    <th key={t} className="px-4 py-3">
                      {SHORT[t]} <span className="normal-case text-ink-muted">(v{data?.rows[0].policies.find((c) => c.type === t)?.currentVersion})</span>
                    </th>
                  ))}
                  <th className="px-4 py-3">Proof</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subjectId} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{r.name}</p>
                      <p className="text-xs text-ink-muted">{[r.phone, r.email].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{dateTime(r.joinedAt)}</td>
                    {r.policies.map((c) => <td key={c.type} className="px-4 py-3"><Cell c={c} /></td>)}
                    <td className="px-4 py-3">
                      <button onClick={() => setProofFor(r)} className="btn-ghost px-3 py-1.5 text-xs">View proof</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <div key={r.subjectId} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{r.name}</p>
                    <p className="truncate text-xs text-ink-muted">{[r.phone, r.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button onClick={() => setProofFor(r)} className="btn-ghost shrink-0 px-3 py-2 text-xs">Proof</button>
                </div>
                <div className="mt-3 space-y-2">
                  {r.policies.map((c) => (
                    <div key={c.type} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-ink-soft">{SHORT[c.type]}</span>
                      <Cell c={c} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {proofFor && <ProofModal audience={audience} row={proofFor} onClose={() => setProofFor(null)} />}
    </div>
  );
}

function ProofModal({ audience, row, onClose }: { audience: Audience; row: ConsentRow; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["consent-proof", audience, row.subjectId], queryFn: () => PoliciesApi.proof(audience, row.subjectId) });
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-card sm:rounded-card sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-ink">Proof of acceptance</p>
            <p className="text-sm text-ink-muted">{row.name} · {[row.phone, row.email].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={onClose} className="text-xl text-ink-muted">✕</button>
        </div>
        {isLoading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : !data?.acceptances.length ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-600">No acceptances recorded — this person has not agreed to any policy yet.</p>
        ) : (
          <div className="space-y-3">
            {data.acceptances.map((a) => (
              <div key={a.id} className="rounded-2xl border border-hairline p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-ink">{a.policyTitle} — version {a.version}</p>
                  {a.currentVersion ? <span className="chip bg-emerald-100 text-emerald-700">Current version</span> : <span className="chip bg-canvas text-ink-muted">Older version</span>}
                </div>
                <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="font-bold text-ink-muted">Accepted at</dt><dd className="text-ink">{new Date(a.acceptedAt).toLocaleString("en-GB")}</dd>
                  <dt className="font-bold text-ink-muted">IP address</dt><dd className="font-mono text-ink">{a.ipAddress ?? "—"}</dd>
                  <dt className="font-bold text-ink-muted">Device</dt><dd className="break-words text-ink">{a.userAgent ?? "—"}</dd>
                  <dt className="font-bold text-ink-muted">Text fingerprint</dt><dd className="break-all font-mono text-[11px] text-ink">{a.acceptedSha256}</dd>
                </dl>
                <p className={`mt-2 text-xs font-bold ${a.hashMatches ? "text-emerald-600" : "text-red-600"}`}>
                  {a.hashMatches
                    ? "✓ Verified: the fingerprint matches the published version, so this is exactly the text they agreed to."
                    : "⚠ Fingerprint mismatch — the stored text no longer matches what was accepted."}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
