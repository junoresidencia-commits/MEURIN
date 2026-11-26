"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { PesquisaSectionNav } from "@/components/PesquisaSectionNav";
import { ResearchGovernancePanel } from "@/components/ResearchGovernancePanel";
import { AGE_BAND_PRESETS } from "@/lib/patient-age";
import { emptyProtocol, type ResearchConsent, type ResearchProtocol } from "@/lib/research-governance";
import {
  FIRST_VISIT_EXAMS,
  FIRST_VISIT_STUDY_ID,
  VISIT_CERTAINTY_LABEL,
  type ExamAtArrival,
  type ExamStatus,
  type VisitCertainty,
} from "@/lib/first-visit";

type Stats = {
  n: number;
  total: number;
  semExames: number;
  semExamesPct: number;
  investigacaoIncompleta: number;
  investigacaoIncompletaPct: number;
  doencaAvancada: number;
  doencaAvancadaPct: number;
  incerteza: number;
  incertezaPct: number;
  exames: { key: string; label: string; n: number; pct: number }[];
  municipios: Record<string, number>;
  certeza: Record<string, number>;
  drc: Record<string, number>;
  sexo: Record<string, number>;
};

type Row = {
  codigo: string;
  id?: string;
  nome?: string;
  data_primeira_consulta: string;
  certeza: VisitCertainty;
  motivo_certeza: string;
  idade: number | null;
  sexo: string;
  municipio: string;
  motivo: string;
  comorbidades: string;
  pressao_arterial: string | null;
  medicamentos_previos: string;
  diagnostico_inicial: string;
  drc: string;
  estagio_g: string;
  categoria_a: string;
  tfge: number | null;
  creatinina: number | null;
  chegou_sem_exames: string;
  investigacao_incompleta: string;
  doenca_renal_avancada: string;
  exames: ExamAtArrival[];
  certaintyReason: string;
};

type Gate = { ok: boolean; reason: string };

const STATUS_LABEL: Record<ExamStatus, string> = {
  disponivel: "Trouxe",
  solicitado_apos: "Pedido depois",
  nao_apresentado: "Não apresentado",
  sem_registro: "Sem registro",
};

const STATUS_CLASS: Record<ExamStatus, string> = {
  disponivel: "bg-emerald-50 text-emerald-800",
  solicitado_apos: "bg-[var(--gold-soft)] text-[var(--gold)]",
  nao_apresentado: "bg-amber-50 text-amber-800",
  sem_registro: "bg-[var(--bg-soft)] text-[var(--text-muted)]",
};

const CERT_CLASS: Record<VisitCertainty, string> = {
  confirmada: "bg-emerald-50 text-emerald-800",
  provavel: "bg-[var(--gold-soft)] text-[var(--gold)]",
  incerta: "bg-amber-50 text-amber-900",
};

export default function PrimeiraConsultaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [certeza, setCerteza] = useState("");
  const [drc, setDrc] = useState("");
  const [anonymize, setAnonymize] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [patients, setPatients] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [protocol, setProtocol] = useState<ResearchProtocol>(emptyProtocol(FIRST_VISIT_STUDY_ID, ""));
  const [consents, setConsents] = useState<ResearchConsent[]>([]);
  const [gate, setGate] = useState<Gate>({ ok: false, reason: "" });

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
    });
  }, [router]);

  const loadGov = useCallback(async () => {
    const res = await fetch("/api/pesquisa/primeira-consulta/governance");
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setProtocol(d.protocol || emptyProtocol(FIRST_VISIT_STUDY_ID, ""));
      setConsents(d.consents || []);
      setGate(d.export || { ok: false, reason: "" });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      if (municipio) q.set("municipio", municipio);
      if (idadeMin) q.set("idadeMin", idadeMin);
      if (idadeMax) q.set("idadeMax", idadeMax);
      if (diagnostico) q.set("diagnostico", diagnostico);
      if (certeza) q.set("certeza", certeza);
      if (drc) q.set("drc", drc);
      q.set("anonymize", anonymize ? "1" : "0");
      const res = await fetch(`/api/pesquisa/primeira-consulta?${q}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível montar a coorte.");
      setStats(d.stats);
      setPatients(d.patients || []);
      if (d.export) setGate(d.export);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [from, to, municipio, idadeMin, idadeMax, diagnostico, certeza, drc, anonymize]);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadGov();
    // Primeira carga e troca de anonimização; os demais filtros usam “Aplicar”.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, anonymize, loadGov]);

  function pickAge(id: string) {
    const p = AGE_BAND_PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (p.op === ">=" || p.op === ">") {
      setIdadeMin(p.value);
      setIdadeMax("");
    } else if (p.op === "<") {
      setIdadeMin("");
      setIdadeMax(p.value);
    } else {
      setIdadeMin(p.value);
      setIdadeMax(p.value2 || "");
    }
  }

  function exportRows(): (string | number)[][] {
    const examCols = FIRST_VISIT_EXAMS.flatMap((e) => [
      `${e.label} (status)`,
      `${e.label} (data)`,
      `${e.label} (resultado)`,
      `${e.label} (alterado)`,
    ]);
    const header = [
      "Código",
      "Data 1ª consulta",
      "Certeza",
      "Motivo da certeza",
      "Idade",
      "Sexo",
      "Município",
      "Motivo",
      "Comorbidades",
      "PA",
      "Medicamentos prévios",
      "Diagnóstico inicial",
      "DRC",
      "Estágio G",
      "Categoria A",
      "TFGe",
      "Creatinina",
      "Chegou sem exames",
      "Investigação incompleta",
      "Doença renal avançada",
      ...examCols,
    ];
    const rows = patients.map((p) => {
      const examCells = FIRST_VISIT_EXAMS.flatMap((e) => {
        const x = p.exames?.find((i) => i.key === e.key);
        return [
          x ? STATUS_LABEL[x.status] : "",
          x?.measuredAt ? String(x.measuredAt).slice(0, 10) : "",
          x?.value || "",
          x?.altered == null ? "" : x.altered ? "sim" : "nao",
        ];
      });
      return [
        p.codigo,
        p.data_primeira_consulta,
        VISIT_CERTAINTY_LABEL[p.certeza] || p.certeza,
        p.motivo_certeza || p.certaintyReason,
        p.idade ?? "",
        p.sexo,
        p.municipio,
        p.motivo,
        p.comorbidades,
        p.pressao_arterial || "",
        p.medicamentos_previos,
        p.diagnostico_inicial,
        p.drc,
        p.estagio_g,
        p.categoria_a,
        p.tfge ?? "",
        p.creatinina ?? "",
        p.chegou_sem_exames,
        p.investigacao_incompleta,
        p.doenca_renal_avancada,
        ...examCells,
      ];
    });
    return [header, ...rows];
  }

  async function allowExport(format: string, rowCount: number) {
    const res = await fetch("/api/pesquisa/primeira-consulta/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, rowCount }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Exportação bloqueada pela governança.");
  }

  async function exportCsv() {
    try {
      const rows = exportRows();
      await allowExport("csv", Math.max(0, rows.length - 1));
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "primeira-consulta-anonimizado.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Exportação bloqueada.");
    }
  }

  async function exportXlsx() {
    try {
      const rows = exportRows();
      await allowExport("xlsx", Math.max(0, rows.length - 1));
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Primeira consulta");
      XLSX.writeFile(wb, "primeira-consulta-anonimizado.xlsx");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Exportação bloqueada.");
    }
  }

  const municipios = useMemo(() => Object.keys(stats?.municipios || {}).sort(), [stats]);
  const selected = patients.find((p) => p.codigo === open) || null;

  if (!ready) return <div className="mx-auto max-w-6xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">
            <Link href="/medicos/pesquisa" className="hover:underline">Pesquisa Científica</Link> › Primeira Consulta
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Primeira Consulta</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
            Uma linha por paciente: só o primeiro atendimento com você, sem retornos e sem misturar clínicas.
            Os exames são os que o paciente <strong>trouxe na chegada</strong> — pedidos depois do nefrologista ficam separados.
            Dados posteriores do prontuário não substituem esta fotografia.
          </p>
          <PesquisaSectionNav />

          <div className="panel space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Filtros</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">De</span>
                <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Até</span>
                <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Município</span>
                <input className="input-field" list="municipios-pc" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Todos" />
                <datalist id="municipios-pc">
                  {municipios.map((m) => <option key={m} value={m} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Diagnóstico</span>
                <input className="input-field" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="DRC, G4, HAS…" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Idade mín.</span>
                <input className="input-field" inputMode="numeric" value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Idade máx.</span>
                <input className="input-field" inputMode="numeric" value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Certeza</span>
                <select className="input-field" value={certeza} onChange={(e) => setCerteza(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="provavel">Provável</option>
                  <option value="incerta">Incerta</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">DRC</span>
                <select className="input-field" value={drc} onChange={(e) => setDrc(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="sim">Confirmada</option>
                  <option value="nao">Não</option>
                  <option value="desconhecido">Desconhecido</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">Idade:</span>
              {AGE_BAND_PRESETS.map((p) => (
                <button key={p.id} type="button" className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--gold)] hover:text-[var(--gold)]" onClick={() => pickAge(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
                Códigos anonimizados na tela (exportação sempre sem nome)
              </label>
              <button type="button" className="btn-gold" onClick={load} disabled={loading}>{loading ? "Atualizando…" : "Aplicar filtros"}</button>
            </div>
            {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          </div>

          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric n={stats.n} sub={`de ${stats.total}`} label="Pacientes (1ª consulta)" />
              <Metric n={`${stats.semExamesPct}%`} sub={`${stats.semExames} pacientes`} label="Chegaram sem exames" />
              <Metric n={`${stats.investigacaoIncompletaPct}%`} sub={`${stats.investigacaoIncompleta} pacientes`} label="Investigação incompleta" />
              <Metric n={`${stats.doencaAvancadaPct}%`} sub={`${stats.doencaAvancada} pacientes`} label="Doença renal avançada" />
            </div>
          )}

          {stats && (
            <div className="panel mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Percentual que chegou com cada exame</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Só conta o que estava disponível na primeira consulta — não o que foi pedido depois.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {stats.exames.map((e) => (
                  <div key={e.key}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[var(--text-soft)]">{e.label}</span>
                      <span className="text-[var(--text-muted)]">{e.pct}% · {e.n}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                      <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(100, e.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {stats.incerteza > 0 && (
                <p className="mt-3 text-xs text-amber-800">
                  {stats.incertezaPct}% ({stats.incerteza}) sem confirmação de que o atendimento foi realmente a primeira consulta.
                </p>
              )}
            </div>
          )}

          <div className="panel mt-4 overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Tabela individualizada</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost text-sm" onClick={exportCsv}>Exportar CSV</button>
                <button type="button" className="btn-gold text-sm" onClick={exportXlsx}>Exportar Excel</button>
              </div>
            </div>
            {patients.length === 0 && !loading && (
              <p className="text-sm text-[var(--text-muted)]">Nenhum paciente neste recorte. Cadastros e consultas deste médico entram automaticamente.</p>
            )}
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Idade / sexo</th>
                  <th className="py-2 pr-3">Município</th>
                  <th className="py-2 pr-3">Diagnóstico</th>
                  <th className="py-2 pr-3">Exames na chegada</th>
                  <th className="py-2 pr-3">Certeza</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const brought = (p.exames || []).filter((e) => e.status === "disponivel").length;
                  return (
                    <tr key={p.codigo} className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--gold-soft)]/40" onClick={() => setOpen(open === p.codigo ? null : p.codigo)}>
                      <td className="py-2 pr-3 font-semibold text-[var(--text)]">
                        {anonymize ? p.codigo : (p.nome || p.codigo)}
                        {!anonymize && p.nome ? <span className="block text-[10px] font-normal text-[var(--text-muted)]">{p.codigo}</span> : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(p.data_primeira_consulta)}</td>
                      <td className="py-2 pr-3">{p.idade ?? "—"} · {p.sexo}</td>
                      <td className="py-2 pr-3">{p.municipio || "—"}</td>
                      <td className="py-2 pr-3 max-w-[220px] truncate" title={p.diagnostico_inicial}>{p.diagnostico_inicial}</td>
                      <td className="py-2 pr-3">
                        {p.chegou_sem_exames === "sim" ? "nenhum" : `${brought} exame(s)`}
                        {p.investigacao_incompleta === "sim" ? <span className="ml-1 text-[11px] text-amber-800">incompleta</span> : null}
                        {p.doenca_renal_avancada === "sim" ? <span className="ml-1 text-[11px] text-[var(--danger)]">avançada</span> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CERT_CLASS[p.certeza]}`}>
                          {p.certeza === "incerta" ? "Incerta" : p.certeza === "confirmada" ? "Confirmada" : "Provável"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="panel mt-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Ficha da primeira consulta</p>
                  <p className="font-display text-xl font-extrabold text-[var(--text)]">{anonymize ? selected.codigo : (selected.nome || selected.codigo)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{selected.certaintyReason || selected.motivo_certeza}</p>
                </div>
                <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(null)}>Fechar</button>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <Fact label="Data" value={fmtDate(selected.data_primeira_consulta)} />
                <Fact label="Idade / sexo" value={`${selected.idade ?? "—"} · ${selected.sexo}`} />
                <Fact label="Município" value={selected.municipio || "—"} />
                <Fact label="Motivo do encaminhamento" value={selected.motivo} />
                <Fact label="Comorbidades" value={selected.comorbidades} />
                <Fact label="Pressão arterial" value={selected.pressao_arterial || "sem registro"} />
                <Fact label="Medicamentos prévios" value={selected.medicamentos_previos} />
                <Fact label="Diagnóstico inicial" value={selected.diagnostico_inicial} />
                <Fact label="Função renal" value={`DRC ${selected.drc} · ${selected.estagio_g} · ${selected.categoria_a}${selected.tfge != null ? ` · TFGe ${selected.tfge}` : ""}`} />
              </dl>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exames com os quais chegou</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-2 pr-3">Exame</th>
                      <th className="py-2 pr-3">Na 1ª consulta</th>
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Resultado</th>
                      <th className="py-2 pr-3">Alterado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.exames || []).map((e) => (
                      <tr key={e.key} className="border-t border-[var(--border)]">
                        <td className="py-2 pr-3 font-semibold">{e.label}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{e.measuredAt ? fmtDate(e.measuredAt) : "—"}</td>
                        <td className="py-2 pr-3">{e.value || "—"}{e.unit ? ` ${e.unit}` : ""}</td>
                        <td className="py-2 pr-3">{e.altered == null ? "—" : e.altered ? "sim" : "não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ResearchGovernancePanel
            studyId={FIRST_VISIT_STUDY_ID}
            protocol={protocol}
            consents={consents}
            gate={gate}
            onRefresh={loadGov}
            apiBase="/api/pesquisa/primeira-consulta"
          />
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function Metric({ n, sub, label }: { n: number | string; sub?: string; label: string }) {
  return (
    <div className="panel text-center">
      <p className="font-display text-3xl font-extrabold text-[var(--text)]">{n}</p>
      {sub ? <p className="text-[11px] text-[var(--text-muted)]">{sub}</p> : null}
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--text-soft)]">{value}</dd>
    </div>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}
