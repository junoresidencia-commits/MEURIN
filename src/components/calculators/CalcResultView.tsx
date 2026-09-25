"use client";

import { useState } from "react";
import type { CalcResult } from "@/lib/calculators/types";

const STATUS_TONE: Record<CalcResult["status"], string> = {
  ok: "border-[var(--gold)]/40 bg-[var(--gold-soft)]",
  recorded: "border-[var(--gold)]/40 bg-[var(--gold-soft)]",
  missing: "border-amber-300 bg-amber-50",
  not_applicable: "border-[var(--border)] bg-[var(--bg)]",
  needs_clinical: "border-sky-200 bg-sky-50",
};

export function CalcResultView({ result, compact }: { result: CalcResult; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border px-4 py-3 ${STATUS_TONE[result.status]}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{result.title}</p>
      <p className="mt-1 font-display text-lg font-extrabold text-[var(--text)]">{result.headline}</p>
      {!compact && <p className="mt-1 text-sm text-[var(--text-soft)]">{result.explanation}</p>}
      {result.staleWarnings.map((w) => (
        <p key={w} className="mt-2 text-sm font-semibold text-amber-800">{w}</p>
      ))}
      {result.values.length > 0 && !compact && (
        <dl className="mt-3 grid gap-1 text-sm">
          {result.values.map((v) => (
            <div key={v.label} className="flex justify-between gap-3 border-b border-black/5 py-1">
              <dt className="text-[var(--text-muted)]">{v.label}</dt>
              <dd className="text-right font-semibold text-[var(--text)]">
                {v.value}{v.unit ? ` ${v.unit}` : ""}
                {v.date ? <span className="block text-[11px] font-normal text-[var(--text-muted)]">{v.date.slice(0, 10)}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {result.officialUrl && (
        <a href={result.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[var(--gold)]">
          Instrumento / ferramenta oficial →
        </a>
      )}
      <button type="button" className="mt-3 block text-sm font-bold text-[var(--gold)]" onClick={() => setOpen((v) => !v)}>
        {open ? "Ocultar cálculo" : "Como foi calculado?"}
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
          <p><span className="font-semibold text-[var(--text)]">Fórmula:</span> {result.formula}</p>
          <p><span className="font-semibold text-[var(--text)]">Variáveis:</span> {result.values.map((v) => `${v.label}=${v.value}${v.unit ? ` ${v.unit}` : ""}`).join("; ") || "—"}</p>
          <p><span className="font-semibold text-[var(--text)]">População:</span> {result.population}</p>
          <p><span className="font-semibold text-[var(--text)]">Versão:</span> {result.version}</p>
          <p><span className="font-semibold text-[var(--text)]">Fonte:</span> {result.source} · {result.published}</p>
          <p><span className="font-semibold text-[var(--text)]">Limitações:</span> {result.limitations}</p>
          {result.missing.length > 0 && (
            <p><span className="font-semibold text-[var(--text)]">Faltando:</span> {result.missing.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
