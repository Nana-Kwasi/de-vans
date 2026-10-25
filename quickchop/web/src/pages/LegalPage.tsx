import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PoliciesApi } from "@/api/endpoints";
import { Markdown } from "@/components/Markdown";
import { BUSINESS_NAME, dateTime } from "@/theme/format";

const DOCS = [
  { slug: "customer-privacy", label: "Privacy Policy" },
  { slug: "customer-terms", label: "Terms of Service" },
  { slug: "rider-privacy", label: "Rider Privacy Notice" },
  { slug: "rider-terms", label: "Rider Agreement" },
];

/** Public policy pages (no sign-in) — the links to give app stores and customers. */
export function LegalPage() {
  const { slug = "customer-privacy" } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["legal", slug], queryFn: () => PoliciesApi.one(slug), retry: false });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/qooka-logo.jpeg" alt={BUSINESS_NAME} className="h-10 w-10 rounded-xl object-cover" />
          <p className="font-black text-ink">{BUSINESS_NAME}</p>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3">
          {DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold ${slug === d.slug ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>
              {d.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {isLoading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : isError || !data ? (
          <p className="text-ink-muted">This document isn't available.</p>
        ) : (
          <article className="card p-6 sm:p-10">
            <h1 className="text-3xl font-black text-ink">{data.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">Version {data.version} · effective {dateTime(data.publishedAt)}</p>
            <Markdown source={data.content} />
          </article>
        )}
      </main>
    </div>
  );
}
