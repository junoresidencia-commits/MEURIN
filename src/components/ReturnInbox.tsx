"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import type { ReturnRequest } from "@/lib/return-request-types";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ReturnInbox({
  detailBase,
  loginHref,
  title,
  subtitle,
  showPatient,
}: {
  detailBase: string;
  loginHref: string;
  title: string;
  subtitle: string;
  showPatient?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ReturnRequest[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/return-requests?as=professional")
      .then((r) => {
        if (r.status === 401) {
          router.replace(loginHref);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setRows(d.requests || []);
      })
      .catch(() => setError("Não foi possível carregar as solicitações."));
  }, [loginHref, router]);

  const pending = (rows || []).filter((r) =>
    ["pending_review", "awaiting_patient", "suggested_slot", "awaiting_payment"].includes(r.status)
  );

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-8">
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">{title}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {!rows && <p className="mt-6 text-[var(--text-muted)]">Carregando…</p>}
      {rows && pending.length > 0 && (
        <p className="mt-4 text-sm font-semibold text-amber-800">{pending.length} aguardando ação</p>
      )}
      <div className="mt-4 space-y-3">
        {rows && rows.length === 0 && (
          <div className="panel text-sm text-[var(--text-muted)]">Nenhuma solicitação de retorno ainda.</div>
        )}
        {(rows || []).map((r) => (
          <Link key={r.id} href={`${detailBase}/${r.id}`} className="panel block transition hover:border-[var(--border-gold)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--text)]">{showPatient ? r.patientName : r.professionalName}</p>
                <p className="text-sm text-[var(--text-muted)]">Retorno solicitado · {fmt(r.requestedSlotStart)}</p>
                {r.daysSinceLast != null && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {r.withinHabitual ? "🟢 Dentro do período habitual" : "⚠️ Fora do período habitual de 30 dias"} · {r.daysSinceLast} dias
                  </p>
                )}
              </div>
              <ReturnStatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
