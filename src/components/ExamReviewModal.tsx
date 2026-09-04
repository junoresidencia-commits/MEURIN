"use client";

import { useMemo, useState } from "react";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";
import { encodePatientParam, toFriendlyMessage } from "@/lib/user-errors";

type Row = { checked: boolean; testKey: string; value: string; unit: string; onConflict: "update" | "keep" };
type GroupState = { id: string; date: string; rows: Row[] };
type ExistingLab = { testKey: string; measuredAt: string };
type InputGroup = { date?: string; labs: { testKey: string; value: number | string; unit?: string }[] };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10);
}
let gid = 0;
function newId(): string {
  gid += 1;
  return `g${gid}_${Date.now()}`;
}
function toRow(l: { testKey: string; value: number | string; unit?: string }): Row {
  return {
    checked: true,
    testKey: l.testKey,
    value: String(l.value).replace(".", ","),
    unit: l.unit || labUnit(l.testKey),
    onConflict: "update",
  };
}

/**
 * Tela obrigatória de conferência dos exames reconhecidos.
 * Suporta VÁRIAS datas: cada bloco tem sua própria data de coleta e seus exames.
 * O médico revisa/edita valores, unidades, nomes e a data, decide o que fazer quando
 * já existe o mesmo exame na mesma data (atualizar/manter) e só então grava — cada
 * resultado vai para o histórico na SUA data, sem apagar os anteriores.
 */
export function ExamReviewModal({
  emailParam,
  groups,
  initialLabs,
  initialDate,
  existingLabs = [],
  source,
  onClose,
  onSaved,
}: {
  emailParam: string;
  /** Preferencial: blocos já separados por data (parseLabGroups). */
  groups?: InputGroup[];
  /** Compatibilidade: um único bloco (fluxo antigo). */
  initialLabs?: { testKey: string; value: number | string; unit?: string }[];
  initialDate?: string;
  existingLabs?: ExistingLab[];
  source?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const initialGroups: GroupState[] = useMemo(() => {
    const src: InputGroup[] = groups && groups.length ? groups : [{ date: initialDate, labs: initialLabs || [] }];
    return src.map((g) => ({ id: newId(), date: g.date || todayIso(), rows: g.labs.map(toRow) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [gs, setGs] = useState<GroupState[]>(initialGroups);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Por data: exames que já existem no histórico (para avisar de duplicidade/conflito).
  const existingByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of existingLabs) {
      const d = dayOf(l.measuredAt);
      if (!map.has(d)) map.set(d, new Set());
      map.get(d)!.add(l.testKey);
    }
    return map;
  }, [existingLabs]);
  const existingOn = (date: string) => existingByDate.get(date) ?? new Set<string>();

  function patchGroup(id: string, patch: Partial<GroupState>) {
    setGs((arr) => arr.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }
  function patchRow(gId: string, i: number, patch: Partial<Row>) {
    setGs((arr) => arr.map((g) => (g.id === gId ? { ...g, rows: g.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : g)));
  }
  function removeRow(gId: string, i: number) {
    setGs((arr) => arr.map((g) => (g.id === gId ? { ...g, rows: g.rows.filter((_, j) => j !== i) } : g)));
  }
  function addRow(gId: string) {
    setGs((arr) => arr.map((g) => (g.id === gId ? { ...g, rows: [...g.rows, toRow({ testKey: "creatinina", value: "" })] } : g)));
  }
  function addGroup() {
    setGs((arr) => [...arr, { id: newId(), date: todayIso(), rows: [toRow({ testKey: "creatinina", value: "" })] }]);
  }
  function removeGroup(gId: string) {
    setGs((arr) => (arr.length > 1 ? arr.filter((g) => g.id !== gId) : arr));
  }

  const selectedValid = gs.reduce(
    (n, g) => n + g.rows.filter((r) => r.checked && Number.isFinite(Number(r.value.replace(",", ".")))).length,
    0
  );

  async function confirm() {
    setSaving(true);
    setErr("");
    try {
      const results = gs.flatMap((g) =>
        g.rows
          .filter((r) => r.checked)
          .map((r) => ({
            testKey: r.testKey,
            value: r.value,
            unit: r.unit,
            measuredAt: g.date,
            onConflict: existingOn(g.date).has(r.testKey) ? r.onConflict : undefined,
          }))
      );
      if (results.length === 0) {
        setErr("Selecione ao menos um exame.");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, origin: source || "evolução" }),
      });
      const raw = await res.text().catch(() => "");
      let data: { error?: string } = {};
      if (raw.trim()) {
        try { data = JSON.parse(raw) as { error?: string }; } catch { data = {}; }
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar os exames.");
      await onSaved();
      onClose();
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível salvar os exames. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  const totalDates = gs.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-display text-lg font-extrabold text-[var(--text)]">Exames encontrados</p>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-[var(--text-muted)]">×</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-soft)]">
          {totalDates > 1
            ? `Foram encontradas ${totalDates} datas de exames. Confira cada data antes de adicionar ao histórico — cada resultado é salvo na sua própria data, sem apagar os anteriores.`
            : "Confira antes de adicionar ao histórico — você pode editar valores, unidades, nomes, a data da coleta, excluir ou incluir exames."}
        </p>

        <div className="space-y-4">
          {gs.map((g) => {
            const exSet = existingOn(g.date);
            const validCount = g.rows.filter((r) => r.checked && Number.isFinite(Number(r.value.replace(",", ".")))).length;
            return (
              <div key={g.id} className="rounded-[20px] border border-[var(--border)] p-3">
                <div className="mb-2 flex items-end justify-between gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data da coleta</span>
                    <input type="date" className="input-field" value={g.date} onChange={(e) => patchGroup(g.id, { date: e.target.value })} />
                  </label>
                  <span className="pb-2 text-xs text-[var(--text-muted)]">{validCount} exame(s)</span>
                  {gs.length > 1 && (
                    <button type="button" className="pb-2 text-xs font-semibold text-[var(--danger)]" onClick={() => removeGroup(g.id)}>Remover data</button>
                  )}
                </div>

                <div className="space-y-2">
                  {g.rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum exame nesta data.</p>}
                  {g.rows.map((r, i) => {
                    const conflict = exSet.has(r.testKey);
                    return (
                      <div key={i} className={`space-y-2 rounded-2xl border p-3 ${r.checked ? "border-[var(--border-gold)] bg-[var(--gold-soft)]/40" : "border-[var(--border)]"}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--gold)]" checked={r.checked} onChange={(e) => patchRow(g.id, i, { checked: e.target.checked })} />
                          <select className="input-field min-h-[44px] flex-1 !py-2 font-semibold" value={r.testKey} onChange={(e) => patchRow(g.id, i, { testKey: e.target.value, unit: labUnit(e.target.value) })}>
                            {NEPHRO_LABS.map((l) => (
                              <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                          </select>
                          <button type="button" className="shrink-0 px-1 text-xl text-[var(--danger)]" onClick={() => removeRow(g.id, i)} aria-label="Remover">×</button>
                        </div>
                        <div className="flex items-center gap-2 pl-7">
                          <label className="text-xs font-semibold text-[var(--text-muted)]">Valor</label>
                          <input inputMode="decimal" className="input-field min-h-[44px] !w-28 !px-3 !py-2 text-center text-base font-bold text-[var(--text)]" value={r.value} onChange={(e) => patchRow(g.id, i, { value: e.target.value })} placeholder="0" />
                          <input className="input-field min-h-[44px] !w-28 !px-3 !py-2 text-center text-sm text-[var(--text-soft)]" value={r.unit} onChange={(e) => patchRow(g.id, i, { unit: e.target.value })} placeholder="unidade" />
                        </div>
                        {conflict && r.checked && (
                          <div className="ml-7 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--warn)]/10 px-2 py-1.5 text-xs text-[var(--text-soft)]">
                            <span>Já existe nesta data:</span>
                            <button type="button" onClick={() => patchRow(g.id, i, { onConflict: "update" })} className={`rounded-full px-2 py-1 font-bold ${r.onConflict === "update" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>Atualizar</button>
                            <button type="button" onClick={() => patchRow(g.id, i, { onConflict: "keep" })} className={`rounded-full px-2 py-1 font-bold ${r.onConflict === "keep" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>Manter</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button type="button" className="mt-2 text-sm font-semibold text-[var(--gold)]" onClick={() => addRow(g.id)}>+ Adicionar exame nesta data</button>
              </div>
            );
          })}
        </div>

        <button type="button" className="mt-3 text-sm font-semibold text-[var(--gold)]" onClick={addGroup}>+ Adicionar outra data</button>

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
