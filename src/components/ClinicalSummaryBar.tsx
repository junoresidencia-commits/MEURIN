"use client";

import { buildClinicalSummary, formatMedicationLines } from "@/lib/clinical-summary";

export function ClinicalSummaryBar({
  age,
  data,
  labs,
}: {
  age?: number | null;
  data: Record<string, unknown>;
  labs: { testKey: string; value: number; unit?: string | null; measuredAt?: string | null }[];
}) {
  const lines = buildClinicalSummary({ age, data, labs });
  const meds = formatMedicationLines(data.medicamentos_em_uso);
  if (!lines.length) return null;
  return (
    <section className="mt-4 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Resumo clínico</p>
      <div className="mt-1 space-y-0.5 text-sm leading-snug text-[var(--text)]">
        {lines.filter((l) => !l.startsWith("Em uso:")).map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {meds.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Medicações</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-[var(--text)]">
            {meds.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
