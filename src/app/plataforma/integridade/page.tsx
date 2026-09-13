"use client";

import { useEffect, useState } from "react";

type Counts = Record<string, number>;
const LABELS: Record<string, string> = {
  doctors: "Médicos",
  patients: "Pacientes",
  bookings: "Consultas / agendamentos",
  clinicalNotes: "Evoluções",
  documents: "Documentos",
  labResults: "Exames",
  clinics: "Clínicas (novas)",
  memberships: "Vínculos clínica",
  roleAssignments: "Papéis extras",
};

export default function IntegridadePage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [at, setAt] = useState("");
  const [dropped, setDropped] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/integrity")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setCounts(d.counts || null);
        setAt(d.at || "");
        setDropped(Array.isArray(d.dropped) ? d.dropped : []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Integridade do sistema</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Somente leitura. Se alguma contagem clínica diminuir após uma migration, a migration deve ser abortada.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {dropped.length > 0 && (
        <p className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          Queda em relação ao último snapshot: {dropped.join(" · ")}
        </p>
      )}
      {at && <p className="mt-2 text-xs text-[var(--text-muted)]">Atualizado em {new Date(at).toLocaleString("pt-BR")}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {counts && Object.entries(LABELS).map(([k, label]) => (
          <div key={k} className="panel">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
            <p className="font-display text-2xl font-extrabold">{counts[k] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
