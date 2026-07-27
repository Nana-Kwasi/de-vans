import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SupportApi } from "@/api/endpoints";
import { SupportStatus, SupportTicket } from "@/api/types";
import { dateTime } from "@/theme/format";

const FILTERS: { label: string; value?: SupportStatus }[] = [
  { label: "All" },
  { label: "Open", value: "OPEN" },
  { label: "Resolved", value: "RESOLVED" },
];

export function SupportPage() {
  const [filter, setFilter] = useState<SupportStatus | undefined>(undefined);
  const qc = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support", filter],
    queryFn: () => SupportApi.list(filter),
    refetchInterval: 20000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) => SupportApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support"] }),
  });

  const openCount = tickets?.filter((t) => t.status === "OPEN").length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Support & issues</h1>
        {!!openCount && <span className="chip bg-amber-100 text-amber-700">{openCount} open</span>}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter === f.value ? "bg-brand text-white" : "bg-surface text-ink-soft shadow-soft hover:bg-canvas"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="font-semibold text-ink-muted">Loading tickets…</p>
      ) : !tickets?.length ? (
        <div className="card p-10 text-center font-semibold text-ink-muted">No support tickets here. 🎉</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onToggle={() => mutation.mutate({ id: t.id, status: t.status === "OPEN" ? "RESOLVED" : "OPEN" })}
              busy={mutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, onToggle, busy }: { ticket: SupportTicket; onToggle: () => void; busy: boolean }) {
  const open = ticket.status === "OPEN";
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="chip bg-brand-soft text-brand">{ticket.category}</span>
          {ticket.orderNumber && <span className="chip bg-canvas text-ink-soft">{ticket.orderNumber}</span>}
        </div>
        <span className={`chip ${open ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
          {ticket.status}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-ink">{ticket.message}</p>

      <div className="mt-4 border-t border-hairline pt-3 text-sm text-ink-soft">
        <p className="font-bold text-ink">{ticket.name ?? "Customer"}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
          {ticket.email && <a href={`mailto:${ticket.email}`} className="hover:text-brand">✉️ {ticket.email}</a>}
          {ticket.phone && <a href={`tel:${ticket.phone}`} className="hover:text-brand">📞 {ticket.phone}</a>}
          <span>🕒 {dateTime(ticket.createdAt)}</span>
        </div>
      </div>

      <button onClick={onToggle} disabled={busy} className={`mt-4 w-full py-2 text-sm ${open ? "btn-primary" : "btn-ghost"}`}>
        {open ? "Mark resolved" : "Reopen"}
      </button>
    </div>
  );
}
