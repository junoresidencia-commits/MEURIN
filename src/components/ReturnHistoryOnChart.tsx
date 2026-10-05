"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import type { ReturnRequest } from "@/lib/return-request-types";

export function ReturnHistoryOnChart({ patientKey }: { patientKey: string }) {
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  useEffect(() => {
    fetch("/api/return-requests")
      .then((r) => r.json())
      .then((d) => {
        const key = patientKey.toLowerCase();
        setRows(
          (d.requests || []).filter(
            (r: ReturnRequest) =>
              r.patientKey.toLowerCase() === key || (r.patientEmail || "").toLowerCase() === key
          )
        );
      })
      .catch(() => {});
  }, [patientKey]);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Solicitações de retorno</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">O paciente solicitou; a classificação oficial é a que você validou.</p>
      <div className="mt-2 space-y-2">
        {rows.slice(0, 8).map((r) => (
          <Link key={r.id} href={`/medicos/solicitacoes/${r.id}`} className="block rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--border-gold)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{new Date(r.requestedSlotStart).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <ReturnStatusBadge status={r.status} />
            </div>
            {r.exceptionalAfter30 && <p className="mt-1 text-[11px] text-amber-800">Autorização excepcional após 30 dias</p>}
            {r.refusalReason && <p className="mt-1 text-[11px] text-red-700">{r.refusalReason}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
