"use client";

import { useState } from "react";
import {
  CLINICAL_FIELDS,
  ESTAGIOS_G,
  CATEGORIAS_A,
  ETIOLOGIAS,
  TRI_OPTIONS,
  etiologiaLabel,
} from "@/lib/clinical-fields";
import { encodePatientParam } from "@/lib/user-errors";

type Detected = { key: string; value: string };
type Row = Detected & { checked: boolean };

const FIELD_BY_KEY = new Map(CLINICAL_FIELDS.map((f) => [f.key, f]));

function displayValue(key: string, value: string): string {
  const f = FIELD_BY_KEY.get(key);
  if (!f) return value;
  if (f.kind === "tri") return TRI_OPTIONS.find((o) => o.value === value)?.label || value;
  if (f.kind === "etiologia") return etiologiaLabel(value);
  if (f.kind === "select") return f.options?.find((o) => o.value === value)?.label || value;
  return value;
}

/**
 * Confirmação dos dados clínicos detectados na evolução antes de alimentar o
 * perfil estruturado (com proveniência "evolução"). Tudo editável.
 */
export function ClinicalReviewModal({
  emailParam,
  detected,
  onClose,
  onSaved,
}: {
  emailParam: string;
  detected: Detected[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(detected.map((d) => ({ ...d, checked: true })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function confirm() {
    setSaving(true);
    setErr("");
    try {
      const changes: Record<string, unknown> = {};
      for (const r of rows) if (r.checked) changes[r.key] = r.value;
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, source: "evolução" }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar no perfil.");
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-display text-lg font-extrabold text-[var(--text)]">Dados clínicos encontrados</p>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-[var(--text-muted)]">×</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-soft)]">
          Foram identificados dados clínicos nesta evolução. Confirme antes de adicionar ao perfil
          estruturado (fonte: <b>evolução</b>). Você pode editar ou desmarcar cada item.
        </p>

        <div className="space-y-2">
          {rows.map((r, i) => {
            const f = FIELD_BY_KEY.get(r.key);
            return (
              <div key={i} className={`space-y-2 rounded-2xl border p-3 ${r.checked ? "border-[var(--border-gold)] bg-[var(--gold-soft)]/40" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--gold)]" checked={r.checked} onChange={(e) => update(i, { checked: e.target.checked })} />
                  <span className="flex-1 text-sm font-semibold text-[var(--text)]">{f?.label || r.key}</span>
                  <span className="text-xs text-[var(--text-muted)]">detectado: {displayValue(r.key, r.value)}</span>
                </div>
                <div className="pl-7">
                  {f?.kind === "tri" && (
                    <div className="flex gap-1">
                      {TRI_OPTIONS.map((o) => (
                        <button key={o.value} type="button" onClick={() => update(i, { value: o.value })} className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-bold ${r.value === o.value ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>{o.label}</button>
                      ))}
                    </div>
                  )}
                  {(f?.kind === "enumG" || f?.kind === "enumA" || f?.kind === "etiologia") && (
                    <select className="input-field !py-2" value={r.value} onChange={(e) => update(i, { value: e.target.value })}>
                      {(f.kind === "enumG" ? ESTAGIOS_G.map((v) => ({ value: v, label: v })) : f.kind === "enumA" ? CATEGORIAS_A.map((v) => ({ value: v, label: v })) : ETIOLOGIAS).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {f?.kind === "select" && (
                    <select className="input-field !py-2" value={r.value} onChange={(e) => update(i, { value: e.target.value })}>
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {f?.kind === "number" && (
                    <input inputMode="decimal" className="input-field !py-2 !w-32" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {err && <p className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>Agora não</button>
          <button type="button" className="btn-gold flex-1" onClick={confirm} disabled={saving}>
            {saving ? "Salvando…" : "Confirmar no perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
