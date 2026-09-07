"use client";

import { buildClinicalSummary } from "@/lib/clinical-summary";

export function ClinicalSummaryBar({
  age,
  data,
  labs,
}: {
  age?: number | null;
  data: Record<string, unknown>;
  labs: { testKey: string; value: number; unit?: string | null }[];
}) {
  const lines = buildClinicalSummary({ age, data, labs });
  if (!lines.length) return null;
  return (
    <section className="mt-4 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Resumo clínico</p>
      <div className="mt-1 space-y-0.5 text-sm leading-snug text-[var(--text)]">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </section>
  );
}
