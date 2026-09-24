"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { monthLabel } from "@/lib/hd-labels";

type Month = { id: string; year: number; month: number; status: string; patients: number; reviews: number; labs: number; closedAt: string | null; closedByName: string | null };
type Log = { id: string; actorName: string; action: string; entity: string; before: string | null; after: string | null; justification: string | null; createdAt: string };

export default function HdHistoricoPage() {
  const { can } = useHd();
  const [months, setMonths] = useState<Month[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    fetch("/api/hemodialise?view=history").then((r) => r.json()).then((d) => setMonths(d.months || []));
    if (can("view_audit")) {
      fetch("/api/hemodialise?view=audit").then((r) => r.json()).then((d) => setLogs(d.logs || []));
    }
  }, [can]);

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Histórico</h2>
      <p className="text-sm text-[var(--text-muted)]">O mês anterior serve de base para o seguinte. Auditoria nunca é apagada.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--text-muted)]">
              <th className="px-2 py-2 text-left">Mês</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Pacientes</th>
              <th className="px-2 py-2 text-left">Revisões</th>
              <th className="px-2 py-2 text-left">Exames</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.id} className="border-t border-[var(--border)]">
                <td className="px-2 py-2 font-semibold">{monthLabel(m.year, m.month)}</td>
                <td className="px-2 py-2">{m.status === "closed" ? `Fechado${m.closedByName ? ` por ${m.closedByName}` : ""}` : "Aberto"}</td>
                <td className="px-2 py-2">{m.patients}</td>
                <td className="px-2 py-2">{m.reviews}</td>
                <td className="px-2 py-2">{m.labs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can("view_audit") && (
        <div className="panel mt-6">
          <p className="font-display text-lg font-bold">Auditoria</p>
          <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto text-sm">
            {logs.map((l) => (
              <div key={l.id} className="border-t border-[var(--border)] pt-2">
                <p><strong>{l.actorName}</strong> · {l.action} · {l.entity} · {new Date(l.createdAt).toLocaleString("pt-BR")}</p>
                {l.justification && <p className="text-[var(--text-muted)]">Justificativa: {l.justification}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
