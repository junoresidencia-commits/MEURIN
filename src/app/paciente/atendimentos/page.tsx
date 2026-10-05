"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import type { ReturnRequest, ReturnRequestStatus } from "@/lib/return-request-types";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const NEXT: ReturnRequestStatus[] = ["confirmed_return", "confirmed_new"];
const OPEN: ReturnRequestStatus[] = ["pending_review", "awaiting_patient", "suggested_slot"];
const ATTN: ReturnRequestStatus[] = ["awaiting_payment", "suggested_slot", "awaiting_patient"];

export default function MeusAtendimentosPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReturnRequest[] | null>(null);

  useEffect(() => {
    fetch("/api/return-requests").then(async (r) => {
      if (r.status === 401) {
        router.replace("/paciente/entrar?next=/paciente/atendimentos");
        return;
      }
      const d = await r.json();
      setRows(d.requests || []);
    });
  }, [router]);

  const next = useMemo(
    () => (rows || []).filter((r) => NEXT.includes(r.status)).sort((a, b) => a.requestedSlotStart.localeCompare(b.requestedSlotStart))[0],
    [rows]
  );
  const solicita = useMemo(() => (rows || []).filter((r) => OPEN.includes(r.status)), [rows]);
  const atencao = useMemo(() => (rows || []).filter((r) => ATTN.includes(r.status)), [rows]);
  const historico = useMemo(
    () => (rows || []).filter((r) => ["refused", "refused_deadline", "cancelled", "closed"].includes(r.status)),
    [rows]
  );

  return (
    <div className="mx-auto max-w-lg px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Início</Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Meus atendimentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">O paciente solicita o retorno. O profissional valida. Só então o horário é confirmado.</p>

      {!rows && <p className="mt-6 text-[var(--text-muted)]">Carregando…</p>}

      <section className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Próximo atendimento</p>
        {next ? (
          <div className="panel mt-2">
            <p className="font-semibold">{next.professionalName}</p>
            <p className="text-sm text-[var(--text-muted)]">{next.convertedToNew ? "Nova consulta" : "Retorno"} · {fmt(next.requestedSlotStart)}</p>
            <div className="mt-2"><ReturnStatusBadge status={next.status} /></div>
            <Link className="btn-gold mt-3 inline-flex" href={`/paciente/retorno/${next.id}`}>Abrir atendimento</Link>
          </div>
        ) : (
          <div className="panel mt-2 text-sm text-[var(--text-muted)]">Nenhum atendimento confirmado no momento.
            <Link href="/agendar" className="mt-3 block font-semibold text-[var(--gold)]">Agendar atendimento</Link>
          </div>
        )}
      </section>

      <section className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Solicitações</p>
        <div className="mt-2 space-y-2">
          {solicita.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma solicitação em andamento.</p>}
          {solicita.map((r) => (
            <div key={r.id} className="panel">
              <p className="font-semibold">{r.professionalName}</p>
              <p className="text-sm text-[var(--text-muted)]">Retorno solicitado · {fmt(r.requestedSlotStart)}</p>
              <div className="mt-2"><ReturnStatusBadge status={r.status} /></div>
              <Link className="btn-ghost mt-3 inline-flex" href={`/paciente/retorno/${r.id}`}>Ver solicitação</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Precisa da sua atenção</p>
        <div className="mt-2 space-y-2">
          {atencao.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nada pendente com você.</p>}
          {atencao.map((r) => (
            <div key={r.id} className="panel">
              <p className="font-semibold">{r.professionalName}</p>
              <p className="text-sm text-[var(--text-muted)]">{r.convertedToNew ? "Nova consulta" : "Retorno"} · {fmt(r.requestedSlotStart)}</p>
              <div className="mt-2"><ReturnStatusBadge status={r.status} /></div>
              <Link className="btn-gold mt-3 inline-flex" href={`/paciente/retorno/${r.id}`}>Continuar</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Histórico</p>
        <div className="mt-2 space-y-2">
          {historico.length === 0 && rows && <p className="text-sm text-[var(--text-muted)]">Nenhuma solicitação anterior.</p>}
          {historico.map((r) => (
            <Link key={r.id} href={`/paciente/retorno/${r.id}`} className="panel block">
              <p className="font-semibold">{r.professionalName}</p>
              <p className="text-sm text-[var(--text-muted)]">{fmt(r.requestedSlotStart)}</p>
              <div className="mt-2"><ReturnStatusBadge status={r.status} /></div>
            </Link>
          ))}
        </div>
      </section>
      <PatientNav />
    </div>
  );
}
