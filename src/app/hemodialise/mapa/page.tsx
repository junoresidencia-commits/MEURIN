"use client";

import { useEffect, useMemo, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_SHIFT_LABEL, monthLabel } from "@/lib/hd-labels";
import type { HdMapField } from "@/lib/hd-types";

type Row = {
  id: string;
  patientName: string;
  shift: "MANHA" | "TARDE" | "NOITE";
  ward: string;
  machine: string;
  access: string;
  heparin: string;
  time: string;
  capillary: string;
  epo: string;
  iron: string;
  sevelamer: string;
  calcitriol: string;
  cinacalcet: string;
  paricalcitol: string;
  notes: string;
  weekdayGroup: string;
};

const COLS: Array<{ k: HdMapField | "patientName"; h: string }> = [
  { k: "machine", h: "Máquina" },
  { k: "patientName", h: "Paciente" },
  { k: "access", h: "Acesso" },
  { k: "heparin", h: "Heparina" },
  { k: "time", h: "Tempo" },
  { k: "capillary", h: "Capilar" },
  { k: "epo", h: "EPO" },
  { k: "iron", h: "Ferro" },
  { k: "sevelamer", h: "Sevelâmer" },
  { k: "calcitriol", h: "Calcitriol" },
  { k: "cinacalcet", h: "Cinacalcete" },
  { k: "paricalcitol", h: "Paricalcitol" },
  { k: "notes", h: "Observação" },
];

export default function HdMapaPage() {
  const { year, month, shift, q, can } = useHd();
  const [rows, setRows] = useState<Row[]>([]);
  const [closed, setClosed] = useState(false);
  const [edit, setEdit] = useState<{ id: string; field: HdMapField } | null>(null);
  const [draft, setDraft] = useState("");
  const [just, setJust] = useState("");
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const u = new URLSearchParams({ view: "map", year: String(year), month: String(month), shift, q });
    const d = await fetch(`/api/hemodialise?${u}`).then((r) => r.json());
    setRows(d.rows || []);
    setClosed(Boolean(d.closed));
  }
  useEffect(() => { load(); }, [year, month, shift, q]);

  async function save(id: string, field: HdMapField, value: string) {
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_map", rowId: id, field, value, justification: just || undefined }),
    });
    const d = await r.json();
    if (d.error) setMsg(d.error);
    else {
      setEdit(null);
      setMsg("Salvo.");
      await load();
    }
  }

  async function importMap() {
    if (!file) return;
    const fd = new FormData();
    fd.set("intent", "import_map");
    fd.set("file", file);
    const r = await fetch("/api/hemodialise/arquivo", { method: "POST", body: fd });
    const d = await r.json();
    setMsg(d.error || `Importados ${d.imported} pacientes · ${d.linked} já existiam no Meu Rim.`);
    await load();
  }

  const qs = `year=${year}&month=${month}`;
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const k = `${r.shift}|${r.ward}|${r.weekdayGroup}`;
      map.set(k, [...(map.get(k) || []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Mapa da Hemodiálise</h2>
          <p className="text-sm text-[var(--text-muted)]">Clique na célula, edite e pressione Enter. {closed ? "Mês fechado — justificativa obrigatória." : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href={`/api/hemodialise/arquivo?kind=xlsx&${qs}`}>XLSX</a>
          <a className="btn-ghost" href={`/api/hemodialise/arquivo?kind=xlsx&${qs}`}>Exportar original</a>
          <a className="btn-ghost" href={`/api/hemodialise/arquivo?kind=pdf&${qs}`}>PDF</a>
          <button type="button" className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      {(can("manage_config") || can("edit_prescription")) && (
        <div className="panel mt-4 flex flex-wrap items-center gap-2">
          <p className="font-semibold">Importar Mapa</p>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button type="button" className="btn-gold" onClick={importMap} disabled={!file}>Importar Sala Branca</button>
        </div>
      )}

      {closed && (
        <label className="mt-3 block text-sm">
          Justificativa (mês fechado)
          <input className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2" value={just} onChange={(e) => setJust(e.target.value)} />
        </label>
      )}
      {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}

      <div className="mt-4 space-y-8 print:text-xs">
        {groups.map(([key, list]) => {
          const [s, ward] = key.split("|");
          return (
            <section key={key} className="overflow-x-auto">
              <p className="mb-2 text-sm font-bold text-[var(--gold)]">{HD_SHIFT_LABEL[s as Row["shift"]]} · {ward} · {monthLabel(year, month)}</p>
              <table className="min-w-[1100px] w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--gold-soft)]">
                    {COLS.map((c) => <th key={c.k} className="border border-[var(--border)] px-2 py-1.5 font-semibold">{c.h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.sort((a, b) => Number(a.machine) - Number(b.machine)).map((r) => (
                    <tr key={r.id}>
                      {COLS.map((c) => {
                        const val = String((r as unknown as Record<string, string>)[c.k] ?? "");
                        const editable = c.k !== "patientName";
                        const active = edit?.id === r.id && edit.field === c.k;
                        return (
                          <td
                            key={c.k}
                            className="border border-[var(--border)] px-1.5 py-1 align-top"
                            onClick={() => {
                              if (!editable) return;
                              setEdit({ id: r.id, field: c.k as HdMapField });
                              setDraft(val);
                            }}
                          >
                            {active ? (
                              <input
                                autoFocus
                                className="w-full rounded border border-[var(--gold)] px-1 py-0.5"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => save(r.id, c.k as HdMapField, draft)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    save(r.id, c.k as HdMapField, draft);
                                  }
                                  if (e.key === "Escape") setEdit(null);
                                }}
                              />
                            ) : (
                              val || <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
