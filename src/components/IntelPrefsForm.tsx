"use client";

import { INTEL_MODULE_LABEL, INTEL_MODULES, type IntelligencePrefs, type IntelModule } from "@/lib/intelligence-prefs";

export function IntelPrefsForm({
  prefs,
  onChange,
  saving,
  onSave,
  msg,
}: {
  prefs: IntelligencePrefs;
  onChange: (next: IntelligencePrefs) => void;
  saving?: boolean;
  onSave: () => void;
  msg?: string;
}) {
  function setModule(key: IntelModule, value: boolean) {
    onChange({ ...prefs, applyMode: "review_only", modules: { ...prefs.modules, [key]: value } });
  }

  return (
    <div className="panel grid gap-3">
      <p className="text-sm text-[var(--text-soft)]">
        A inteligência lê a evolução e <b>só sugere</b>. O perfil só muda quando o médico confirma.
        Não há gravação automática.
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--gold)]"
          checked={prefs.enabled}
          onChange={(e) => onChange({ ...prefs, enabled: e.target.checked, applyMode: "review_only" })}
        />
        Sugerir após salvar evolução
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {INTEL_MODULES.map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--gold)]"
              checked={prefs.modules[m] !== false}
              disabled={!prefs.enabled}
              onChange={(e) => setModule(m, e.target.checked)}
            />
            {INTEL_MODULE_LABEL[m]}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--gold)]"
          checked={prefs.allowBackfill}
          onChange={(e) => onChange({ ...prefs, allowBackfill: e.target.checked, applyMode: "review_only" })}
        />
        Permitir reler prontuários (só lista o que revisar — não grava)
      </label>
      <p className="text-xs text-[var(--text-muted)]">Modo: só revisão. Origem atual: {prefs.source === "doctor" ? "médico" : prefs.source === "clinic" ? "clínica" : "padrão"}.</p>
      <div>
        <button type="button" className="btn-gold" onClick={onSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar preferências"}
        </button>
      </div>
      {msg && <p className="text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
