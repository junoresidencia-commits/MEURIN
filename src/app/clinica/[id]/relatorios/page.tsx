"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { defaultOfficialDestination, money, periodLabel } from "@/lib/official-report";
import { reportRangeFor, type ReportPeriodKey } from "@/lib/report-period";

const PERIODS: { key: ReportPeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ano", label: "Este ano" },
];

type DoctorRow = {
  doctorId: string;
  doctorName: string;
  doctorCrm?: string;
  count: number;
  producedCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  receivedCents: number;
  pendingCents: number;
  feeCents: number | null;
  clinicSharePercent: number | null;
};
type Encounter = {
  id: string;
  doctorName: string;
  doctorCrm?: string;
  patientName: string | null;
  feeCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  receivedCents: number;
  paymentStatus: string;
  attendedAt: string;
};
type Summary = {
  count: number;
  producedCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  receivedCents: number;
  pendingCents: number;
  byDoctor: DoctorRow[];
};
type ClinicId = {
  name: string;
  legalName: string;
  cnpj: string;
  city: string;
};

function sit(status: string) {
  if (status === "paid") return "Quitado";
  if (status === "partial") return "Parcial";
  if (status === "courtesy") return "Cortesia";
  return "Pendente";
}

export default function ClinicaRelatoriosPage() {
  const params = useParams<{ id: string }>();
  const initial = reportRangeFor("mes");
  const [clinic, setClinic] = useState<ClinicId>({ name: "", legalName: "", cnpj: "", city: "" });
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [period, setPeriod] = useState<ReportPeriodKey>("mes");
  const [destination, setDestination] = useState(defaultOfficialDestination(""));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Encounter[]>([]);
  const [err, setErr] = useState("");
  const [view, setView] = useState<"oficial" | "painel">("oficial");
  const [savingId, setSavingId] = useState(false);
  const [idMsg, setIdMsg] = useState("");

  function applyPeriod(key: ReportPeriodKey) {
    const r = reportRangeFor(key);
    setPeriod(key);
    setFrom(r.from);
    setTo(r.to);
  }

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/me`)
      .then((r) => r.json())
      .then((d) => {
        const next = {
          name: d.clinic?.name || "Clínica",
          legalName: d.clinic?.legalName || "",
          cnpj: d.clinic?.cnpj || "",
          city: d.clinic?.city || "",
        };
        setClinic(next);
        setDestination(defaultOfficialDestination(next.city));
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    fetch(`/api/clinica/${params.id}/producao?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível montar o relatório.");
        setSummary(d.summary || null);
        setRows(d.encounters || []);
        if (d.clinic) {
          setClinic((prev) => ({
            name: d.clinic.name || prev.name,
            legalName: d.clinic.legalName || prev.legalName,
            cnpj: d.clinic.cnpj || prev.cnpj,
            city: d.clinic.city || prev.city,
          }));
        }
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [params.id, from, to]);

  const missing = [!clinic.legalName && "razão social", !clinic.cnpj && "CNPJ", !clinic.city && "município"].filter(Boolean);
  const chronological = useMemo(
    () => [...rows].sort((a, b) => a.attendedAt.localeCompare(b.attendedAt)),
    [rows],
  );

  const csv = useMemo(() => {
    if (!summary) return "";
    const head = "N;Data;Hora;Paciente;Médico;CRM;Valor;Recebido;Clínica;Honorário;Situação";
    const body = chronological.map((r, i) => {
      const d = new Date(r.attendedAt);
      return [
        i + 1,
        d.toLocaleDateString("pt-BR"),
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        r.patientName || "Não informado",
        r.doctorName,
        r.doctorCrm || "",
        (r.feeCents / 100).toFixed(2),
        (r.receivedCents / 100).toFixed(2),
        (r.clinicShareCents / 100).toFixed(2),
        (r.doctorShareCents / 100).toFixed(2),
        sit(r.paymentStatus),
      ].join(";");
    });
    return [head, ...body].join("\n");
  }, [summary, chronological]);

  function downloadCsv() {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestacao-contas-${clinic.name || "clinica"}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPdf() {
    const q = new URLSearchParams({ from, to, format: "pdf", destination });
    window.open(`/api/clinica/${params.id}/relatorio-oficial?${q}`, "_blank", "noopener,noreferrer");
  }

  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault();
    setSavingId(true);
    setIdMsg("");
    try {
      const r = await fetch(`/api/clinica/${params.id}/identificacao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clinic),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não salvou.");
      setClinic({
        name: d.clinic.name,
        legalName: d.clinic.legalName || "",
        cnpj: d.clinic.cnpj || "",
        city: d.clinic.city || "",
      });
      if (d.clinic.city) setDestination(defaultOfficialDestination(d.clinic.city));
      setIdMsg("Dados da unidade salvos. Já entram no PDF da prefeitura.");
    } catch (error) {
      setIdMsg(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSavingId(false);
    }
  }

  return (
    <div>
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Relatórios</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Documento oficial para Prefeitura e Secretaria de Saúde: cabeçalho da unidade, CRM, relação nominal e assinaturas. O painel interno continua disponível para o dia a dia.
        </p>

        <form onSubmit={saveIdentity} className="panel mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Dados da unidade no documento</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Razão social, CNPJ e município aparecem no PDF protocolado. Sem isso o órgão devolve o relatório.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome fantasia</span>
              <input className="input-field" value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Razão social</span>
              <input className="input-field" value={clinic.legalName} onChange={(e) => setClinic({ ...clinic, legalName: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CNPJ</span>
              <input className="input-field" value={clinic.cnpj} onChange={(e) => setClinic({ ...clinic, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Município</span>
              <input className="input-field" value={clinic.city} onChange={(e) => setClinic({ ...clinic, city: e.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-ghost min-h-11" disabled={savingId}>
              {savingId ? "Salvando…" : "Salvar dados da unidade"}
            </button>
            {idMsg && <p className="text-sm text-[var(--text-soft)]">{idMsg}</p>}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPeriod(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                period === p.key
                  ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]"
                  : "border-[var(--border)] text-[var(--text-soft)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">De</span>
            <input
              className="input-field"
              type="date"
              value={from}
              onChange={(e) => {
                setPeriod("livre");
                setFrom(e.target.value);
              }}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Até</span>
            <input
              className="input-field"
              type="date"
              value={to}
              onChange={(e) => {
                setPeriod("livre");
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Destinatário</span>
            <input className="input-field" value={destination} onChange={(e) => setDestination(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-gold min-h-12" onClick={openPdf}>
            PDF para a Prefeitura
          </button>
          <button type="button" className="btn-ghost min-h-12" onClick={() => window.print()}>
            Imprimir / salvar em papel
          </button>
          <button type="button" className="btn-ghost min-h-12" onClick={downloadCsv} disabled={!csv}>
            Planilha (CSV)
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setView("oficial")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              view === "oficial" ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            Documento oficial
          </button>
          <button
            type="button"
            onClick={() => setView("painel")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              view === "painel" ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            Painel interno
          </button>
        </div>
        {missing.length > 0 && (
          <p className="mt-3 text-sm text-amber-800">
            Falta {missing.join(", ")} no cabeçalho. Preencha acima antes de mandar para a prefeitura.
          </p>
        )}
        {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
      </div>

      {view === "oficial" && summary && (
        <article className="official-sheet mt-6 bg-white print:mt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Meu Rim</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold uppercase leading-tight">
            Prestação de contas de atendimentos
          </h2>
          <p className="text-sm text-[var(--text-muted)]">Relatório oficial de produção assistencial</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">Destinatário:</span> {destination}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Período de competência:</span> {periodLabel(from, to)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Documento CLINICA-{params.id.slice(0, 8).toUpperCase()}-{from.replaceAll("-", "")}-{to.replaceAll("-", "")}
          </p>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">1. Identificação da unidade</h3>
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-[var(--text-muted)]">Nome fantasia</dt><dd className="font-semibold">{clinic.name || "—"}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Razão social</dt><dd className="font-semibold">{clinic.legalName || clinic.name || "—"}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">CNPJ</dt><dd className="font-semibold">{clinic.cnpj || "—"}</dd></div>
            <div><dt className="text-xs text-[var(--text-muted)]">Município</dt><dd className="font-semibold">{clinic.city || "—"}</dd></div>
          </dl>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">2. Resumo da produção</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Atendimentos</p><p className="font-display text-xl font-extrabold">{summary.count}</p></div>
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Valor total</p><p className="font-display text-xl font-extrabold">{money(summary.producedCents)}</p></div>
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Recebido</p><p className="font-display text-xl font-extrabold">{money(summary.receivedCents)}</p></div>
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Pendente</p><p className="font-display text-xl font-extrabold">{money(summary.pendingCents)}</p></div>
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Retenção clínica</p><p className="font-display text-xl font-extrabold">{money(summary.clinicShareCents)}</p></div>
            <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[11px] uppercase text-[var(--text-muted)]">Honorários</p><p className="font-display text-xl font-extrabold">{money(summary.doctorShareCents)}</p></div>
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">3. Produção por profissional</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Médico</th>
                  <th className="py-2 pr-3">CRM</th>
                  <th className="py-2 pr-3">Nº</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2">Honorário</th>
                </tr>
              </thead>
              <tbody>
                {summary.byDoctor.map((d) => (
                  <tr key={d.doctorId} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-semibold">{d.doctorName}</td>
                    <td className="py-2 pr-3">{d.doctorCrm || "—"}</td>
                    <td className="py-2 pr-3">{d.count}</td>
                    <td className="py-2 pr-3">{money(d.producedCents)}</td>
                    <td className="py-2 pr-3">{money(d.clinicShareCents)}</td>
                    <td className="py-2">{money(d.doctorShareCents)}</td>
                  </tr>
                ))}
                {summary.byDoctor.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-[var(--text-muted)]">Nenhum atendimento no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">4. Relação nominal de atendimentos</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase text-[var(--text-muted)]">
                  <th className="py-2 pr-2">Nº</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Hora</th>
                  <th className="py-2 pr-2">Paciente</th>
                  <th className="py-2 pr-2">Médico / CRM</th>
                  <th className="py-2 pr-2">Valor</th>
                  <th className="py-2">Sit.</th>
                </tr>
              </thead>
              <tbody>
                {chronological.map((r, i) => {
                  const d = new Date(r.attendedAt);
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)]">
                      <td className="py-1.5 pr-2">{i + 1}</td>
                      <td className="py-1.5 pr-2">{d.toLocaleDateString("pt-BR")}</td>
                      <td className="py-1.5 pr-2">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1.5 pr-2 font-semibold">{r.patientName || "Não informado"}</td>
                      <td className="py-1.5 pr-2">{r.doctorName} · {r.doctorCrm || "—"}</td>
                      <td className="py-1.5 pr-2">{money(r.feeCents)}</td>
                      <td className="py-1.5">{sit(r.paymentStatus)}</td>
                    </tr>
                  );
                })}
                {chronological.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-[var(--text-muted)]">Sem atendimentos no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">5. Declaração</h3>
          <p className="mt-2 text-sm leading-relaxed">
            A unidade {clinic.legalName || clinic.name || "clínica"} declara, para os devidos fins junto à Prefeitura Municipal, Secretaria Municipal de Saúde e demais órgãos de controle, que os atendimentos relacionados neste documento foram efetivamente realizados no período de competência indicado.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
            Os valores correspondem à produção assistencial e ao rateio contratual. Este relatório não substitui nota fiscal, RPA, recibo de honorários, SISAB/e-SUS ou faturamento de convênio.
          </p>

          <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">6. Assinaturas</h3>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <div>
              <div className="border-t border-[var(--text)] pt-2 text-sm">Gestora / responsável administrativo</div>
            </div>
            <div>
              <div className="border-t border-[var(--text)] pt-2 text-sm">Responsável técnico / médico</div>
            </div>
          </div>
          <p className="mt-6 text-sm text-[var(--text-muted)]">
            Local e data: {clinic.city || "________________"}, ____/____/________ · Carimbo da unidade / CNPJ
          </p>
        </article>
      )}

      {view === "painel" && summary && (
        <div className="mt-6 print:hidden">
          <h2 className="font-display text-2xl font-extrabold">Painel interno</h2>
          <p className="text-sm text-[var(--text-muted)]">Conferência do caixa. O documento da prefeitura é a outra aba.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Atendimentos</p><p className="font-display text-2xl font-extrabold">{summary.count}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produção</p><p className="font-display text-2xl font-extrabold">{money(summary.producedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Recebido</p><p className="font-display text-2xl font-extrabold">{money(summary.receivedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Clínica</p><p className="font-display text-2xl font-extrabold">{money(summary.clinicShareCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Médicos</p><p className="font-display text-2xl font-extrabold">{money(summary.doctorShareCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Pendente</p><p className="font-display text-2xl font-extrabold">{money(summary.pendingCents)}</p></div>
          </div>
          <h3 className="mt-8 font-display text-xl font-bold">Por médico</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Médico</th>
                  <th className="py-2 pr-3">CRM</th>
                  <th className="py-2 pr-3">Consultas</th>
                  <th className="py-2 pr-3">Valor / %</th>
                  <th className="py-2 pr-3">Produção</th>
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2 pr-3">Médico</th>
                  <th className="py-2">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {summary.byDoctor.map((d) => (
                  <tr key={d.doctorId} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-semibold">{d.doctorName}</td>
                    <td className="py-2 pr-3">{d.doctorCrm || "—"}</td>
                    <td className="py-2 pr-3">{d.count}</td>
                    <td className="py-2 pr-3">{d.feeCents != null ? `${money(d.feeCents)} · ${d.clinicSharePercent ?? 0}%` : "—"}</td>
                    <td className="py-2 pr-3">{money(d.producedCents)}</td>
                    <td className="py-2 pr-3">{money(d.clinicShareCents)}</td>
                    <td className="py-2 pr-3">{money(d.doctorShareCents)}</td>
                    <td className="py-2">{money(d.pendingCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}