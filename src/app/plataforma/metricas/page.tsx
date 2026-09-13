"use client";

import { useEffect, useState } from "react";

type Data = {
  note: string;
  counts: Record<string, number>;
  clinics: { id: string; name: string; status: string }[];
  auditActions: { action: string; count: number }[];
};

const LABELS: Record<string, string> = {
  create_closing: "Fechamentos gerados",
  pay_closing: "Repasses marcados pagos",
  clinic_checkin: "Check-ins",
  upsert_fee_rule: "Regras de honorário",
  create_clinic: "Clínicas criadas",
  adjust_closing: "Ajustes de fechamento",
};

export default function MetricasPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/metricas")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setData(d);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Métricas de uso</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Qual clínica existe e o que a plataforma registrou. Sem evoluções, exames ou nomes de pacientes.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {data && (
        <>
          <p className="mt-3 text-xs text-[var(--text-muted)]">{data.note}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.auditActions.map((a) => (
              <div key={a.action} className="panel">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{LABELS[a.action] || a.action}</p>
                <p className="font-display text-2xl font-extrabold">{a.count}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-8 font-display text-xl font-bold">Clínicas</h2>
          <div className="mt-2 space-y-2">
            {data.clinics.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma clínica ainda.</p>}
            {data.clinics.map((c) => (
              <div key={c.id} className="panel flex justify-between gap-2">
                <p className="font-bold">{c.name}</p>
                <p className="text-xs font-semibold uppercase text-[var(--gold)]">{c.status}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
