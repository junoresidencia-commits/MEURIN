"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EncounterWorkflow, WorkflowItem } from "@/lib/document-workflow/types";

type Props = {
  patientKey: string;
};

const FILTERS: { id: string; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendentes", label: "Pendentes" },
  { id: "assinados", label: "Assinados" },
  { id: "receita", label: "Receitas" },
  { id: "relatorio", label: "Relatórios" },
  { id: "exame", label: "Exames" },
  { id: "lme", label: "LME" },
  { id: "ter", label: "TER" },
];

export function DocumentWorkflowPanel({ patientKey }: Props) {
  const [wf, setWf] = useState<EncounterWorkflow | null>(null);
  const [assistant, setAssistant] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    let alive = true;
    fetch(`/api/document-workflow?patient=${encodeURIComponent(patientKey)}`, { credentials: "include" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar a documentação.");
        if (!alive) return;
        setWf(d.workflow);
        setAssistant(d.flags?.assistantEnabled !== false);
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Erro"))
      .finally(() => {});
    return () => {
      alive = false;
    };
  }, [patientKey]);

  if (!assistant) return null;
  if (err) {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
        {err}
      </div>
    );
  }
  if (!wf) {
    return <p className="text-sm text-[var(--text-muted)]">Conferindo documentação do atendimento…</p>;
  }

  const visible = wf.items.filter((i) => {
    if (filter === "todos") return true;
    if (filter === "pendentes") return i.status === "pending" || i.status === "warning";
    if (filter === "assinados") return i.status === "ok";
    return i.definitionId === filter;
  });

  const resolveHref = wf.missing[0]?.href;

  return (
    <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--gold)]">
        {wf.canFinalizeEncounter ? "Documentação finalizada" : "Documentos do atendimento"}
      </p>
      <h2 className="font-display text-lg font-extrabold text-[var(--text)]">
        {wf.canFinalizeEncounter ? "Tudo pronto" : wf.summary}
      </h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        O Meu Rim identifica LME, TER, receita e relatórios a partir da conduta. Pesquisa científica não bloqueia o atendimento.
      </p>
      <ul className="mt-3 space-y-1.5">
        {visible.map((i) => (
          <WorkflowRow key={i.id} item={i} />
        ))}
      </ul>
      {visible.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">Nada neste filtro.</p>}
      {wf.consents.some((c) => c.category === "pesquisa") && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Recusar pesquisa não impede consulta, LME nem receita.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "btn-gold text-xs" : "btn-ghost text-xs"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!wf.canFinalizeEncounter && resolveHref && (
        <Link href={resolveHref} className="btn-gold mt-3 inline-block text-sm">
          Resolver e finalizar
        </Link>
      )}
    </div>
  );
}

function WorkflowRow({ item }: { item: WorkflowItem }) {
  const mark = item.status === "ok" ? "✓" : item.status === "warning" || item.status === "pending" ? "⚠" : "·";
  const tone =
    item.status === "ok"
      ? "Assinado / completo"
      : item.status === "warning"
        ? "Atenção"
        : item.status === "pending"
          ? "Pendente"
          : "Informação";
  const inner = (
    <>
      <span className="w-5 font-extrabold" aria-hidden>
        {mark}
      </span>
      <span className="flex-1">
        {item.label}
        <span className="sr-only"> — {tone}</span>
        {item.detail ? <span className="block text-[11px] font-normal text-[var(--text-muted)]">{item.detail}</span> : null}
      </span>
    </>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-[var(--text)]">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-[var(--text)]">{inner}</div>;
}
