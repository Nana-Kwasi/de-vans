import { Link } from "react-router-dom";
import { DeliveryJob } from "@/api/types";
import { money } from "@/theme/format";
import { DELIVERY_LABEL, DELIVERY_STYLE, timeAgo } from "@/theme/delivery";

/** Summary card for a delivery job: fee first (what riders decide on), then the route. */
export function JobCard({ job, action }: { job: DeliveryJob; action?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-black text-ink">{money(job.riderFee)}</p>
          <p className="text-xs font-semibold text-ink-muted">
            Delivery fee · {job.tripKm != null ? `${job.tripKm} km` : "distance unknown"} · {job.itemCount} item{job.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <span className={`chip ${DELIVERY_STYLE[job.status]}`}>{DELIVERY_LABEL[job.status]}</span>
          <p className="mt-1 text-xs font-bold text-ink-muted">{job.orderNumber}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span>🍳</span>
          <div className="min-w-0">
            <p className="font-bold text-ink">{job.pickupName}</p>
            <p className="truncate text-ink-soft">{job.pickupAddress}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span>🏠</span>
          <div className="min-w-0">
            <p className="font-bold text-ink">{job.customerName ?? "Customer"}</p>
            <p className="text-ink-soft">{job.dropoffAddress}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        {job.deliveryTimeNote && <span className="chip bg-canvas text-ink-soft">⏰ {job.deliveryTimeNote}</span>}
        <span className="chip bg-canvas text-ink-muted">Sent {timeAgo(job.dispatchedAt)}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <Link to={`/rider/jobs/${job.id}`} className="btn-ghost flex-1 py-2.5 text-center text-sm">
          Details
        </Link>
        {action}
      </div>
    </div>
  );
}
