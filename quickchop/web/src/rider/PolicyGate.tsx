import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PolicyStatus } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { RiderApi, errorMessage } from "./api";

/**
 * Shown instead of the rider portal until the current Rider Agreement and Privacy Notice
 * are accepted. Acceptance is recorded on the server with time, IP, device and a
 * fingerprint of the exact text.
 */
export function PolicyGate({ statuses }: { statuses: PolicyStatus[] }) {
  const qc = useQueryClient();
  const pending = statuses.filter((s) => !s.accepted);
  const [open, setOpen] = useState<string | null>(pending[0]?.policy.id ?? null);
  const [agreed, setAgreed] = useState(false);
  const updated = statuses.some((s) => s.accepted) || pending.some((s) => s.policy.version > 1);

  const accept = useMutation({
    mutationFn: () => RiderApi.acceptPolicies(pending.map((s) => s.policy.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rider"] }),
    onError: (e) => window.alert(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-ink">{updated ? "We've updated our terms" : "Before you start"}</h1>
        <p className="mt-1 text-sm text-ink-soft">Please read and accept the following to use the rider portal.</p>
      </div>

      {pending.map((s) => {
        const expanded = open === s.policy.id;
        return (
          <div key={s.policy.id} className="card overflow-hidden">
            <button onClick={() => setOpen(expanded ? null : s.policy.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
              <span>
                <span className="block font-black text-ink">{s.policy.title}</span>
                <span className="text-xs text-ink-muted">Version {s.policy.version}{s.policy.changeSummary && s.policy.version > 1 ? ` · ${s.policy.changeSummary}` : ""}</span>
              </span>
              <span className="text-xl text-ink-muted">{expanded ? "−" : "+"}</span>
            </button>
            {expanded && (
              <div className="max-h-[50vh] overflow-y-auto border-t border-hairline px-4 pb-4">
                <Markdown source={s.policy.content} />
              </div>
            )}
          </div>
        );
      })}

      <label className="card flex cursor-pointer items-start gap-3 p-4">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-brand" />
        <span className="text-sm text-ink">
          I have read and agree to the {pending.map((s) => s.policy.title).join(" and ")}.
        </span>
      </label>

      <button disabled={!agreed || accept.isPending} onClick={() => accept.mutate()} className="btn-primary w-full py-3.5 text-base disabled:opacity-40">
        {accept.isPending ? "Saving…" : "Accept and continue"}
      </button>
    </div>
  );
}
