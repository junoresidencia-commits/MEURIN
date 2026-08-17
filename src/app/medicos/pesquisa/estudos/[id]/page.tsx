"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import {
  RESEARCH_VARS, RESEARCH_VARS_BY_KEY, RESEARCH_GROUPS,
  OPERATORS_CAT, OPERATORS_NUM, type Operator,
} from "@/lib/research-fields";
import { STUDY_TYPE_LABEL, STUDY_STATUS_LABEL, STUDY_STATUSES, type StudyLite } from "../../studyMeta";

type Filter = { field: string; op: Operator; value: string; value2?: string };
type NumStats = { n: number; mean: number; sd: number; median: number; q1: number; q3: number; min: number; max: number };
type TableRow =
  | { key: string; label: string; type: "num"; unit?: string; num: NumStats | null }
  | { key: string; label: string; type: "cat" | "text"; cat: Record<string, number> };
type Quality = { key: string; label: string; type: string; available: number; total: number; pct: number };
type Analysis = { n: number; total: number; variables: string[]; table1: TableRow[]; quality: Quality[]; results: string; patients: Record<string, unknown>[] };

const num = (x: number) => String(x).replace(".", ",");

export default function EstudoDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ready, setReady] = useState(false);
  const [study, setStudy] = useState<StudyLite | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickVars, setPickVars] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      loadStudy();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  async function loadStudy() {
    const res = await fetch(`/api/pesquisa/studies/${id}`);
    if (!res.ok) { setNotFound(true); return; }
    const data = await res.json();
    setStudy(data.study);
    setFilters(data.study.filters || []);
    setVariables(data.study.variables || []);
    loadAnalysis();
  }
  async function loadAnalysis() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pesquisa/studies/${id}/analysis`);
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  }
  async function save(patch: Record<string, unknown>, recompute = false) {
    setSaving(true);
    try {
      const res = await fetch(`/api/pesquisa/studies/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (res.ok) { const d = await res.json(); setStudy(d.study); if (recompute) await loadAnalysis(); }
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(i: number, patch: Partial<Filter>) {
    setFilters((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function setField(i: number, field: string) {
    const def = RESEARCH_VARS_BY_KEY.get(field);
    const op: Operator = def?.type === "num" ? ">" : "=";
    const value = def?.type === "cat" && def.options?.[0] ? def.options[0].value : "";
    updateFilter(i, { field, op, value, value2: "" });
  }

  const grouped = useMemo(() => RESEARCH_GROUPS.map((g) => ({ g, vars: RESEARCH_VARS.filter((v) => v.group === g) })), []);

  function buildRows(): (string | number)[][] {
    if (!analysis) return [];
    const cols = ["codigo", ...analysis.variables];
    const header = cols.map((c) => (c === "codigo" ? "Código" : RESEARCH_VARS_BY_KEY.get(c)?.label || c));
    const rows = analysis.patients.map((p) => cols.map((c) => { const v = p[c]; return v === null || v === undefined ? "" : (v as string | number); }));
    return [header, ...rows];
  }
  function exportCsv() {
    const rows = buildRows();
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "estudo-anonimizado.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function exportXlsx() {
    const rows = buildRows();
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estudo");
    XLSX.writeFile(wb, "estudo-anonimizado.xlsx");
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  if (notFound) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Estudo não encontrado. <Link className="text-[var(--gold)]" href="/medicos/pesquisa/estudos">Voltar</Link></div>;
  if (!study) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando estudo…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href="/medicos/pesquisa/estudos" className="hover:underline">Estudos</Link> › {STUDY_TYPE_LABEL[study.type]}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/medicos/pesquisa/estudos/${id}/graficos`} className="btn-ghost text-sm">Gráficos</Link>
            <Link href={`/medicos/pesquisa/estudos/${id}/comparar`} className="btn-ghost text-sm">Comparar grupos (estatística)</Link>
          </div>

          {/* Cabeçalho editável */}
          <div className="panel mt-2 space-y-3">
            <input
              className="input-field text-lg font-bold"
              value={study.title}
              onChange={(e) => setStudy({ ...study, title: e.target.value })}
              onBlur={(e) => save({ title: e.target.value })}
              placeholder="Título do estudo"
            />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Pergunta</span>
              <textarea
                className="input-field min-h-[60px]"
                value={study.question}
                onChange={(e) => setStudy({ ...study, question: e.target.value })}
                onBlur={(e) => save({ question: e.target.value }, true)}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                Status
                <select className="input-field !w-auto !py-2" value={study.status} onChange={(e) => save({ status: e.target.value })}>
                  {STUDY_STATUSES.map((s) => <option key={s} value={s}>{STUDY_STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              {saving && <span className="text-xs text-[var(--text-muted)]">salvando…</span>}
            </div>
          </div>

          {/* Critérios (filtros) */}
          <div className="panel mt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Critérios de inclusão (E)</p>
            {filters.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sem filtros — inclui todos os seus pacientes.</p>}
            {filters.map((f, i) => {
              const def = RESEARCH_VARS_BY_KEY.get(f.field);
              const ops = def?.type === "num" ? OPERATORS_NUM : OPERATORS_CAT;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className="input-field !w-auto flex-1 !py-2" value={f.field} onChange={(e) => setField(i, e.target.value)}>
                    {grouped.map(({ g, vars }) => (
                      <optgroup key={g} label={g}>
                        {vars.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <select className="input-field !w-auto !py-2" value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as Operator })}>
                    {ops.map((o) => <option key={o} value={o}>{o === "!=" ? "≠" : o}</option>)}
                  </select>
                  {def?.type === "cat" && def.options ? (
                    <select className="input-field !w-auto flex-1 !py-2" value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })}>
                      {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input className="input-field !w-24 !py-2" value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })} placeholder="valor" />
                  )}
                  {f.op === "entre" && <input className="input-field !w-24 !py-2" value={f.value2 ?? ""} onChange={(e) => updateFilter(i, { value2: e.target.value })} placeholder="e" />}
                  <button type="button" className="px-1 text-lg text-[var(--danger)]" onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}>×</button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setFilters((fs) => [...fs, { field: "drc", op: "=", value: "sim" }])}>+ Adicionar critério</button>
              <button type="button" className="btn-gold" onClick={() => save({ filters, variables }, true)} disabled={saving || loading}>Salvar e recalcular</button>
            </div>
          </div>

          {/* Variáveis do estudo */}
          <div className="panel mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Variáveis ({variables.length || "padrão"})</p>
              <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setPickVars((v) => !v)}>{pickVars ? "Fechar" : "Escolher variáveis"}</button>
            </div>
            {pickVars && (
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--border)] p-3">
                {grouped.map(({ g, vars }) => (
                  <div key={g} className="mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{g}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map((v) => {
                        const on = variables.includes(v.key);
                        return (
                          <button key={v.key} type="button" onClick={() => setVariables((xs) => on ? xs.filter((x) => x !== v.key) : [...xs, v.key])} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-gold mt-2" onClick={() => save({ variables, filters }, true)} disabled={saving}>Salvar variáveis e recalcular</button>
              </div>
            )}
            {variables.length === 0 && <p className="text-xs text-[var(--text-muted)]">Usando o conjunto padrão (idade, sexo, DRC, estágio, HAS, DM, creatinina, TFGe, RAC).</p>}
          </div>

          {/* Resultados */}
          {loading && <p className="mt-4 text-sm text-[var(--text-muted)]">Calculando…</p>}
          {analysis && (
            <>
              <div className="panel mt-4">
                <p className="font-display text-2xl text-[var(--text)]">{analysis.n} paciente(s) incluído(s)</p>
                <p className="text-sm text-[var(--text-muted)]">de {analysis.total} no seu banco</p>
              </div>

              {/* Qualidade do banco */}
              <div className="panel mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Qualidade do banco (completude)</p>
                <div className="mt-2 grid gap-1.5">
                  {analysis.quality.map((q) => (
                    <div key={q.key} className="flex items-center gap-2 text-sm">
                      <span className="w-48 shrink-0 truncate text-[var(--text-soft)]">{q.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                        <div className={`h-full ${q.pct >= 70 ? "bg-emerald-500" : q.pct >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${q.pct}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs text-[var(--text-muted)]">{q.available}/{q.total} · {num(q.pct)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabela 1 */}
              <div className="panel mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Tabela 1 — características</p>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="py-1.5 font-semibold text-[var(--text)]">Pacientes</td>
                      <td className="py-1.5 text-right text-[var(--text-soft)]">{analysis.n}</td>
                    </tr>
                    {analysis.table1.map((r) => (
                      <tr key={r.key} className="border-b border-[var(--border)] align-top">
                        <td className="py-1.5 pr-3 text-[var(--text-soft)]">{r.label}{r.type === "num" && r.unit ? ` (${r.unit})` : ""}</td>
                        <td className="py-1.5 text-right text-[var(--text)]">
                          {r.type === "num"
                            ? (r.num ? <span>{num(r.num.mean)} ± {num(r.num.sd)} <span className="text-[var(--text-muted)]">(mediana {num(r.num.median)} [{num(r.num.q1)}–{num(r.num.q3)}]; n={r.num.n})</span></span> : <span className="text-[var(--text-muted)]">sem dados</span>)
                            : (
                              <span className="inline-flex flex-wrap justify-end gap-x-3">
                                {Object.entries(r.cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                  <span key={k}>{k}: <b>{v}</b> ({analysis.n ? num(Math.round((v / analysis.n) * 1000) / 10) : 0}%)</span>
                                ))}
                              </span>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resultados (texto determinístico a partir dos dados) */}
              <div className="panel mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Resultados (a partir dos dados reais)</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Texto gerado apenas com os números da coorte. Revise e edite antes de usar.</p>
                <textarea className="input-field mt-2 min-h-[160px] font-mono text-[13px]" defaultValue={analysis.results} />
              </div>

              {/* Exportação */}
              <div className="panel mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exportar banco (anonimizado — P0001…)</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-gold" onClick={exportXlsx} disabled={analysis.n === 0}>Exportar XLSX</button>
                  <button type="button" className="btn-ghost" onClick={exportCsv} disabled={analysis.n === 0}>Exportar CSV</button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Sem nome/CPF/CNS/contato. A anonimização não substitui consentimento nem aprovação ética (CEP/CONEP quando aplicável).</p>
              </div>

              {/* Pacote completo para produção científica externa */}
              <div className="panel mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Preparar para análise externa / artigo</p>
                <p className="text-sm text-[var(--text-soft)]">
                  Gera um pacote <b>.zip</b> com o banco em <b>CSV, Excel, R, Python e SPSS</b>, além de dicionário de variáveis
                  (tipo, unidade, codificação, valores, ausentes, fórmulas e definições), resumo do estudo, estatística/Tabela 1,
                  qualidade do banco, metodologia, fluxograma, dados longitudinais e gráficos (SVG). Pronto para entregar a um estatístico.
                </p>
                <a
                  href={analysis.n === 0 ? undefined : `/api/pesquisa/studies/${id}/package`}
                  className={`btn-gold w-fit ${analysis.n === 0 ? "pointer-events-none opacity-60" : ""}`}
                >
                  Baixar pacote (.zip)
                </a>
                <p className="text-xs text-[var(--text-muted)]">A produção textual (artigo/abstract/revisão) é feita fora da plataforma, a partir deste pacote.</p>
              </div>
            </>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
