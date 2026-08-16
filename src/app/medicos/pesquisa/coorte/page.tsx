"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import {
  RESEARCH_VARS,
  RESEARCH_VARS_BY_KEY,
  RESEARCH_GROUPS,
  OPERATORS_CAT,
  OPERATORS_NUM,
  type Operator,
} from "@/lib/research-fields";

type Filter = { field: string; op: Operator; value: string; value2?: string };
type Stats = {
  n: number;
  idade: { mean: number; median: number; min: number; max: number; n: number } | null;
  tfge: { mean: number; median: number; min: number; max: number; n: number } | null;
  creatinina: { mean: number; median: number; min: number; max: number; n: number } | null;
  rac: { mean: number; median: number; min: number; max: number; n: number } | null;
  sexo: Record<string, number>;
  drc: Record<string, number>;
  estagio_g: Record<string, number>;
  categoria_a: Record<string, number>;
  etiologia_principal: Record<string, number>;
  has: Record<string, number>;
  dm: Record<string, number>;
};
type Result = { count: number; total: number; stats: Stats; patients: Record<string, unknown>[]; anonymize: boolean };

const DEFAULT_EXPORT_VARS = ["idade", "sexo", "drc", "estagio_g", "categoria_a", "etiologia_principal", "has", "dm", "lab_creatinina", "lab_tfge", "lab_rac"];

export default function CoortePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([{ field: "drc", op: "=", value: "sim" }]);
  const [anonymize, setAnonymize] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportVars, setExportVars] = useState<string[]>(DEFAULT_EXPORT_VARS);
  const [pickVars, setPickVars] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
    });
  }, [router]);

  function updateFilter(i: number, patch: Partial<Filter>) {
    setFilters((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function setField(i: number, field: string) {
    const def = RESEARCH_VARS_BY_KEY.get(field);
    const op: Operator = def?.type === "num" ? ">" : "=";
    const value = def?.type === "cat" && def.options?.[0] ? def.options[0].value : "";
    updateFilter(i, { field, op, value, value2: "" });
  }

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/pesquisa/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, anonymize }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
    } finally {
      setLoading(false);
    }
  }

  function buildRows(): (string | number)[][] {
    if (!result) return [];
    const cols = [
      "codigo",
      ...(result.anonymize ? [] : ["nome"]),
      ...exportVars,
    ];
    const header = cols.map((c) => (c === "codigo" ? "Código" : c === "nome" ? "Nome" : RESEARCH_VARS_BY_KEY.get(c)?.label || c));
    const rows = result.patients.map((p) =>
      cols.map((c) => {
        const v = p[c];
        return v === null || v === undefined ? "" : (v as string | number);
      })
    );
    return [header, ...rows];
  }

  function exportCsv() {
    const rows = buildRows();
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `coorte-meu-rim.csv`);
  }
  async function exportXlsx() {
    const rows = buildRows();
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coorte");
    XLSX.writeFile(wb, "coorte-meu-rim.xlsx");
  }
  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grouped = useMemo(() => RESEARCH_GROUPS.map((g) => ({ g, vars: RESEARCH_VARS.filter((v) => v.group === g) })), []);

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--gold)]"><Link href="/medicos/pesquisa" className="hover:underline">Pesquisa Científica</Link> › Coorte</p>
              <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Construtor de coortes</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Consulta os dados estruturados dos seus pacientes. Não altera o prontuário. Campo vazio = desconhecido.
              </p>
            </div>
            <Link href="/medicos/pesquisa/dicionario" className="btn-ghost">Dicionário de dados</Link>
          </div>

          {/* Filtros */}
          <div className="panel mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Filtros (todos combinados com E)</p>
            {filters.map((f, i) => {
              const def = RESEARCH_VARS_BY_KEY.get(f.field);
              const ops = def?.type === "num" ? OPERATORS_NUM : OPERATORS_CAT;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className="input-field !w-auto flex-1 !py-2" value={f.field} onChange={(e) => setField(i, e.target.value)}>
                    {grouped.map(({ g, vars }) => (
                      <optgroup key={g} label={g}>
                        {vars.map((v) => (
                          <option key={v.key} value={v.key}>{v.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select className="input-field !w-auto !py-2" value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as Operator })}>
                    {ops.map((o) => (
                      <option key={o} value={o}>{o === "!=" ? "≠" : o === "entre" ? "entre" : o}</option>
                    ))}
                  </select>
                  {def?.type === "cat" && def.options ? (
                    <select className="input-field !w-auto flex-1 !py-2" value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })}>
                      {def.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input-field !w-24 !py-2" value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })} placeholder="valor" />
                  )}
                  {f.op === "entre" && (
                    <input className="input-field !w-24 !py-2" value={f.value2 ?? ""} onChange={(e) => updateFilter(i, { value2: e.target.value })} placeholder="e" />
                  )}
                  <button type="button" className="px-1 text-lg text-[var(--danger)]" onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))} aria-label="Remover filtro">×</button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setFilters((fs) => [...fs, { field: "idade", op: ">", value: "18" }])}>
                + Adicionar filtro
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
              <button type="button" className="btn-gold" onClick={run} disabled={loading}>
                {loading ? "Buscando…" : "Buscar coorte"}
              </button>
              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
                Anonimizar (remover nome e identificadores)
              </label>
            </div>
          </div>

          {result && (
            <>
              <div className="panel mt-6">
                <p className="font-display text-2xl text-[var(--text)]">{result.count} paciente(s) na coorte</p>
                <p className="text-sm text-[var(--text-muted)]">de {result.total} com perfil no seu banco</p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <StatNum title="Idade (anos)" s={result.stats.idade} />
                  <StatNum title="TFGe (mL/min/1,73m²)" s={result.stats.tfge} />
                  <StatNum title="Creatinina (mg/dL)" s={result.stats.creatinina} />
                  <StatNum title="RAC (mg/g)" s={result.stats.rac} />
                  <StatDist title="Sexo" d={result.stats.sexo} />
                  <StatDist title="DRC" d={result.stats.drc} />
                  <StatDist title="Estágio (G)" d={result.stats.estagio_g} />
                  <StatDist title="Albuminúria (A)" d={result.stats.categoria_a} />
                  <StatDist title="Etiologia principal" d={result.stats.etiologia_principal} />
                  <StatDist title="HAS" d={result.stats.has} />
                  <StatDist title="DM" d={result.stats.dm} />
                </div>
              </div>

              <div className="panel mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exportar {result.anonymize ? "(anonimizado)" : "(identificado)"}</p>
                  <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setPickVars((v) => !v)}>
                    {pickVars ? "Fechar variáveis" : "Escolher variáveis"}
                  </button>
                </div>
                {pickVars && (
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--border)] p-3">
                    {grouped.map(({ g, vars }) => (
                      <div key={g} className="mb-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{g}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vars.map((v) => {
                            const on = exportVars.includes(v.key);
                            return (
                              <button key={v.key} type="button" onClick={() => setExportVars((xs) => on ? xs.filter((x) => x !== v.key) : [...xs, v.key])} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-gold" onClick={exportXlsx} disabled={result.count === 0}>Exportar XLSX</button>
                  <button type="button" className="btn-ghost" onClick={exportCsv} disabled={result.count === 0}>Exportar CSV</button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  A exportação anonimizada gera um código de pesquisa (MR-000001…) e não inclui nome/CPF/contato. A anonimização do arquivo não substitui consentimento nem aprovação ética.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function StatNum({ title, s }: { title: string; s: { mean: number; median: number; min: number; max: number; n: number } | null }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
      {s ? (
        <p className="mt-1 text-sm text-[var(--text-soft)]">média {String(s.mean).replace(".", ",")} · mediana {String(s.median).replace(".", ",")} · {String(s.min).replace(".", ",")}–{String(s.max).replace(".", ",")} · n={s.n}</p>
      ) : (
        <p className="mt-1 text-sm text-[var(--text-muted)]">sem dados</p>
      )}
    </div>
  );
}
function StatDist({ title, d }: { title: string; d: Record<string, number> }) {
  const entries = Object.entries(d).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">sem dados</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-[var(--text-soft)]">
          {entries.map(([k, v]) => (
            <span key={k}>{k}: <b className="text-[var(--text)]">{v}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}
