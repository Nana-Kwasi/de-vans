import { useQuery } from "@tanstack/react-query";
import { ReviewsApi } from "@/api/endpoints";
import { Review } from "@/api/types";
import { dateTime } from "@/theme/format";
import { Stars } from "@/components/Stars";

export function ReviewsPage() {
  const { data: reviews, isLoading } = useQuery({ queryKey: ["reviews"], queryFn: ReviewsApi.list });

  const list = reviews ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black text-ink">Reviews & ratings</h1>

      {list.length > 0 && (
        <div className="card mb-6 flex flex-wrap items-center gap-6 p-6">
          <div>
            <p className="text-4xl font-black text-ink">{avg.toFixed(1)}</p>
            <Stars value={Math.round(avg)} size="text-xl" />
          </div>
          <div className="text-sm font-semibold text-ink-muted">
            Based on {list.length} review{list.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading…</p>
      ) : !list.length ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No reviews yet. ⭐</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r: Review) => (
            <div key={r.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Stars value={r.rating} size="text-lg" />
                {r.orderNumber && <span className="chip bg-canvas text-ink-soft">{r.orderNumber}</span>}
              </div>
              {r.comment ? (
                <p className="text-sm text-ink">{r.comment}</p>
              ) : (
                <p className="text-sm italic text-ink-muted">No comment left.</p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm">
                <span className="font-bold text-ink">{r.name ?? "Customer"}</span>
                <span className="text-ink-muted">{dateTime(r.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
