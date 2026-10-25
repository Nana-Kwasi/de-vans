import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RiderApi, errorMessage } from "../api";
import { useRiderAuth } from "../store";
import { useRiderShell } from "../RiderLayout";
import { JobCard } from "../JobCard";

export function RiderRequestsPage() {
  const online = !!useRiderAuth((s) => s.rider?.online);
  const { available, active, toggleOnline } = useRiderShell();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: RiderApi.accept,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["rider"] });
      navigate(`/rider/jobs/${job.id}`);
    },
    onError: (err) => {
      // 409 = another rider got there first; refresh so it disappears.
      setNotice(errorMessage(err));
      qc.invalidateQueries({ queryKey: ["rider", "available"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black text-ink">Delivery requests</h1>
        <span className="text-xs font-semibold text-ink-muted">Updates every 5s</span>
      </div>

      {!online && (
        <div className="card flex items-center justify-between gap-3 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">You're offline. Go online to accept requests.</p>
          <button onClick={toggleOnline} className="btn-primary shrink-0 px-4 py-2 text-sm">Go online</button>
        </div>
      )}

      {active.length > 0 && (
        <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">
          You have a delivery in progress — see the Delivery tab.
        </div>
      )}

      {notice && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}

      {available.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl">🛵</p>
          <p className="mt-2 font-bold text-ink">No requests right now</p>
          <p className="mt-1 text-sm text-ink-muted">When the kitchen sends out an order it will appear here and your phone will chime.</p>
        </div>
      ) : (
        available.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            action={
              <button
                disabled={!online || accept.isPending}
                onClick={() => {
                  setNotice(null);
                  accept.mutate(job.id);
                }}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                {accept.isPending && accept.variables === job.id ? "Accepting…" : "Accept"}
              </button>
            }
          />
        ))
      )}
    </div>
  );
}
