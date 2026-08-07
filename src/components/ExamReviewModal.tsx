"use client";

import { useMemo, useState } from "react";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";

type Row = { checked: boolean; testKey: string; value: string; unit: string; onConflict: "update" | "keep" };
type ExistingLab = { testKey: string; measuredAt: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Tela obrigatória de conferência dos exames reconhecidos na evolução.
 * O médico revisa/edita valores, unidades, nomes e a DATA DA COLETA, decide o
 * que fazer quando já existe o mesmo exame na mesma data (atualizar/manter) e só
 * então grava — alimentando os gráficos laboratoriais já existentes.
 */
export function ExamReviewModal({
  emailParam,
  initialLabs,
  initialDate,
  existingLabs = [],
  source,
  onClose,
  onSaved,
}: {
  emailParam: string;
  initialLabs: { testKey: string; value: number | string; unit?: string }[];
  initialDate?: string;
  existingLabs?: ExistingLab[];
  source?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialLabs.map((l) => ({
      checked: true,
      testKey: l.testKey,
      value: String(l.value).replace(".", ","),
      unit: l.unit || labUnit(l.testKey),
      onConflict: "update",
    }))
  );
  const [date, setDate] = useState(initialDate || todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Conjunto de exames que já existem na data escolhida (para avisar de duplicidade).
  const existingOnDate = useMemo(() => {
    const set = new Set<string>();
    for (const l of existingLabs) if (dayOf(l.measuredAt) === date) set.add(l.testKey);
    return set;
  }, [existingLabs, date]);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function changeKey(i: number, key: string) {
    update(i, { testKey: key, unit: labUnit(key) });
  }

  const selectedValid = rows.filter((r) => r.checked && Number.isFinite(Number(r.value.replace(",", ".")))).length;

  async function confirm() {
    setSaving(true);
    setErr("");
    try {
      const results = rows
        .filter((r) => r.checked)
        .map((r) => ({
          testKey: r.testKey,
          value: r.value,
          unit: r.unit,
          measuredAt: date,
          onConflict: existingOnDate.has(r.testKey) ? r.onConflict : undefined,
        }));
      if (results.length === 0) {
        setErr("Selecione ao menos um exame.");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/doctor/patients/${emailParam}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, origin: source || "evolução", measuredAt: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
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
          <p className="font-display text-lg font-extrabold text-[var(--text)]">Exames encontrados</p>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-[var(--text-muted)]">×</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-soft)]">
          Foram encontrados resultados laboratoriais nesta evolução. Confira antes de adicionar ao
          histórico — você pode editar valores, unidades, nomes, a data da coleta, excluir ou incluir exames.
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data da coleta (dos exames)</span>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">Nenhum exame. Adicione manualmente abaixo.</p>
          )}
          {rows.map((r, i) => {
            const conflict = existingOnDate.has(r.testKey);
            return (
              <div key={i} className={`space-y-2 rounded-2xl border p-3 ${r.checked ? "border-[var(--border-gold)] bg-[var(--gold-soft)]/40" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--gold)]" checked={r.checked} onChange={(e) => update(i, { checked: e.target.checked })} />
                  <select className="input-field min-h-[44px] flex-1 !py-2 font-semibold" value={r.testKey} onChange={(e) => changeKey(i, e.target.value)}>
                    {NEPHRO_LABS.map((l) => (
                      <option key={l.key} value={l.key}>{l.label}</option>
                    ))}
                  </select>
                  <button type="button" className="shrink-0 px-1 text-xl text-[var(--danger)]" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remover">×</button>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Valor</label>
                  <input inputMode="decimal" className="input-field min-h-[44px] !w-28 !px-3 !py-2 text-center text-base font-bold text-[var(--text)]" value={r.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="0" />
                  <input className="input-field min-h-[44px] !w-28 !px-3 !py-2 text-center text-sm text-[var(--text-soft)]" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} placeholder="unidade" />
                </div>
                {conflict && r.checked && (
                  <div className="ml-7 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--warn)]/10 px-2 py-1.5 text-xs text-[var(--text-soft)]">
                    <span>Já existe nesta data:</span>
                    <button type="button" onClick={() => update(i, { onConflict: "update" })} className={`rounded-full px-2 py-1 font-bold ${r.onConflict === "update" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>Atualizar</button>
                    <button type="button" onClick={() => update(i, { onConflict: "keep" })} className={`rounded-full px-2 py-1 font-bold ${r.onConflict === "keep" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>Manter</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-3 text-sm font-semibold text-[var(--gold)]"
          onClick={() => setRows((rs) => [...rs, { checked: true, testKey: "creatinina", value: "", unit: labUnit("creatinina"), onConflict: "update" }])}
        >
          + Adicionar exame
        </button>

        {err && <p className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn-gold flex-1" onClick={confirm} disabled={saving || selectedValid === 0}>
            {saving ? "Salvando…" : `Confirmar e salvar${selectedValid ? ` (${selectedValid})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
