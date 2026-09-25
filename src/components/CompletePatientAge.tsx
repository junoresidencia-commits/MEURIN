"use client";

import { useEffect, useState } from "react";

type Gap = { id: string; name: string; birthdate: string | null; ageYears: number | null; ageReportedAt: string | null };
type Draft = { birthdate: string; ageYears: string; ageReportedAt: string };

export function CompletePatientAge({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Gap[] | null>(null);
  const [total, setTotal] = useState(0);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/doctor/patients/missing-age")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar."))))
      .then((d) => {
        const list = (d.patients || []) as Gap[];
        setRows(list);
        setTotal(d.total || 0);
        setDraft(Object.fromEntries(list.map((p) => [p.id, { birthdate: "", ageYears: "", ageReportedAt: "" }])));
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Erro"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set(id: string, patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save() {
    const items = (rows || [])
      .map((p) => {
        const d = draft[p.id];
        if (!d) return null;
        if (d.birthdate) return { id: p.id, birthdate: d.birthdate };
        if (d.ageYears.trim()) return { id: p.id, ageYears: d.ageYears, ageReportedAt: d.ageReportedAt || undefined };
        return null;
      })
      .filter(Boolean);
    if (items.length === 0) { setMsg("Preencha ao menos um paciente."); return; }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/doctor/patients/missing-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setMsg(`${data.saved} paciente(s) atualizado(s).`);
      load();
      onSaved?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const missing = rows?.length ?? 0;

  return (
    <div className="mt-4">
      <button type="button" className="btn-ghost text-sm" onClick={() => setOpen((v) => !v)}>
        {open ? "Fechar" : "Completar dados dos pacientes"}
        {rows && missing > 0 ? ` (${missing} sem idade)` : ""}
      </button>
      {open && (
        <div className="panel mt-3 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Completar dados dos pacientes</p>
          <p className="text-sm text-[var(--text-muted)]">
            Somente quem está sem idade. Prefira a data de nascimento; se não houver, informe a idade (e o mês, se souber).
            {total ? ` ${missing} de ${total} sem idade.` : ""}
          </p>
          {rows === null && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
          {rows && rows.length === 0 && (
            <p className="text-sm text-[var(--text-soft)]">Todos os pacientes já têm idade ou data de nascimento.</p>
          )}
          {rows && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((p) => {
                const d = draft[p.id] || { birthdate: "", ageYears: "", ageReportedAt: "" };
                const preferBirth = Boolean(d.birthdate);
                return (
                  <div key={p.id} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <p className="font-semibold text-[var(--text)] sm:col-span-2">{p.name}</p>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de nascimento</span>
                      <input type="date" className="input-field" value={d.birthdate} onChange={(e) => set(p.id, { birthdate: e.target.value })} />
                    </label>
                    {!preferBirth && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Idade (anos)</span>
                          <input inputMode="numeric" className="input-field" placeholder="ex.: 64" value={d.ageYears} onChange={(e) => set(p.id, { ageYears: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Em (mês/ano)</span>
                          <input type="month" className="input-field" value={d.ageReportedAt} onChange={(e) => set(p.id, { ageReportedAt: e.target.value })} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {msg && <p className="text-sm text-[var(--text-soft)]">{msg}</p>}
          {rows && rows.length > 0 && (
            <button type="button" className="btn-gold" disabled={busy} onClick={save}>
              {busy ? "Salvando…" : "Salvar preenchidos"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
