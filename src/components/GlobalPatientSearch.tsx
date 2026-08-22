"use client";

import { useEffect, useRef, useState } from "react";
import { PatientQuickSheet } from "./PatientQuickSheet";

type Row = { key: string; name: string; city: string; phone: string; cpf: string | null; isCreated: boolean; lastSlot: string };

export function GlobalPatientSearch({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function fetchRows(query: string) {
    setLoading(true);
    fetch(`/api/doctor/patients/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => setRows(d.patients || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchRows(q), 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q, open]);

  return (
    <>
      <div ref={boxRef} className={`relative ${compact ? "w-full" : "w-full max-w-md"}`}>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 shadow-sm focus-within:border-[var(--gold)]">
          <span aria-hidden className="text-[var(--text-muted)]">🔍</span>
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Buscar paciente por nome, CPF ou telefone…"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar paciente"
          />
          {q && (
            <button type="button" aria-label="Limpar" className="text-[var(--text-muted)]" onClick={() => setQ("")}>×</button>
          )}
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-[110%] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-2 shadow-2xl">
            {!q && <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Pacientes recentes</p>}
            {loading && <p className="px-3 py-3 text-sm text-[var(--text-muted)]">Buscando…</p>}
            {!loading && rows.length === 0 && (
              <p className="px-3 py-3 text-sm text-[var(--text-muted)]">{q ? "Nenhum paciente encontrado." : "Nenhum paciente recente."}</p>
            )}
            {rows.map((r) => (
              <button
                key={r.key}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--gold-soft)]"
                onClick={() => { setSelected(r.key); setOpen(false); }}
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">{r.name}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{[r.city, r.cpf ? `CPF ${r.cpf}` : null].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <span className="text-xs text-[var(--gold)]">Ver →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <PatientQuickSheet patientKey={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
