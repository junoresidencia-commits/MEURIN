"use client";

import { APP_FEE_LABEL, type AppFeeMode } from "@/lib/platform-fees";

export function AdminFeeFields({
  mode,
  percent,
  fixedReais,
  onMode,
  onPercent,
  onFixed,
  onSave,
}: {
  mode: AppFeeMode;
  percent: string;
  fixedReais: string;
  onMode: (v: AppFeeMode) => void;
  onPercent: (v: string) => void;
  onFixed: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-4">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Como a plataforma cobra esta pessoa</span>
        <select className="input-field" value={mode} onChange={(e) => onMode(e.target.value as AppFeeMode)}>
          {(Object.keys(APP_FEE_LABEL) as AppFeeMode[]).map((k) => (
            <option key={k} value={k}>{APP_FEE_LABEL[k]}</option>
          ))}
        </select>
      </label>
      {mode === "por_atendimento" && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">% de cada consulta</span>
          <input className="input-field" inputMode="numeric" value={percent} onChange={(e) => onPercent(e.target.value)} />
        </label>
      )}
      {mode !== "gratis" && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{mode === "por_entrada" ? "R$ por entrada" : "R$ fixo por atendimento"}</span>
          <input className="input-field" inputMode="decimal" value={fixedReais} onChange={(e) => onFixed(e.target.value)} />
        </label>
      )}
      <div className="flex items-end">
        <button type="button" className="btn-gold text-sm" onClick={onSave}>Salvar cobrança</button>
      </div>
    </div>
  );
}
