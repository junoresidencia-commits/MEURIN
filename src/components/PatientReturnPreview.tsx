"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import type { ReturnRequest } from "@/lib/return-request-types";

export function PatientReturnPreview() {
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  useEffect(() => {
    fetch("/api/return-requests")
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setRows(d.requests || []))
      .catch(() => {});
  }, []);
  const open = rows.filter((r) =>
    ["pending_review", "awaiting_patient", "suggested_slot", "awaiting_payment", "confirmed_return", "confirmed_new"].includes(r.status)
  );
  if (open.length === 0) return null;
  const first = open[0];
  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Retornos e solicitações</p>
      <div className="panel mt-2">
        <p className="font-semibold text-[var(--text)]">{first.professionalName}</p>
        <p className="text-sm text-[var(--text-muted)]">
          {first.status === "confirmed_return" || first.status === "confirmed_new" ? "Atendimento" : "Retorno solicitado"} ·{" "}
          {new Date(first.requestedSlotStart).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </p>
        <div className="mt-2"><ReturnStatusBadge status={first.status} /></div>
        <Link href={`/paciente/retorno/${first.id}`} className="btn-gold mt-3 inline-flex">
          {["awaiting_payment", "suggested_slot", "awaiting_patient"].includes(first.status) ? "Continuar" : "Ver solicitação"}
        </Link>
        <Link href="/paciente/atendimentos" className="ml-3 text-sm font-semibold text-[var(--gold)]">Meus atendimentos</Link>
      </div>
    </div>
  );
}
