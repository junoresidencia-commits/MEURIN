"use client";

import { AGE_BAND_PRESETS } from "@/lib/patient-age";
import type { Operator } from "@/lib/research-fields";

export type AgeFilter = { field: string; op: Operator; value: string; value2?: string };

export function AgeBandChips({ onPick }: { onPick: (filter: AgeFilter) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-[var(--text-muted)]">Idade:</span>
      {AGE_BAND_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
          onClick={() => onPick({ field: "idade", op: p.op, value: p.value, value2: p.value2 })}
        >
          {p.label}
        </button>
      ))}
      <span className="text-[11px] text-[var(--text-muted)]">ou faixa personalizada no filtro</span>
    </div>
  );
}
