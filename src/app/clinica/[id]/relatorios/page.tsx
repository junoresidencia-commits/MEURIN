"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clinicReportXlsxBytes } from "@/lib/clinic-official-report-xlsx";
import { defaultOfficialDestination, money, periodLabel, reportFileSlug } from "@/lib/official-report";
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
type Resultado = {
  receitaBrutaCents: number;
  despesaTotalCents: number;
  resultadoCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  receitas: { consultasCents: number; procedimentosCents: number; outrosCents: number };
  despesas: { materiaisCents: number; funcionariosCents: number; manutencaoCents: number; taxasCents: number; outrosCents: number };
};

function sit(status: string) {
  if (status === "paid") return "Quitado";
  if (status === "partial") return "Parcial";
  if (status === "courtesy") return "Cortesia";
  return "Pendente";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ClinicaRelatoriosPage() {
  const params = useParams<{ id: string }>();
  const initial = reportRangeFor("mes");
  const [clinic, setClinic] = useState<ClinicId>({ name: "", legalName: "", cnpj: "", city: "" });
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [period, setPeriod] = useState<ReportPeriodKey>("mes");
  const [destination, setDestination] = useState(defaultOfficialDestination(""));
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Encounter[]>([]);
  const [err, setErr] = useState("");
  const [view, setView] = useState<"tabela" | "oficial" | "painel" | "resultado">("tabela");
  const [savingId, setSavingId] = useState(false);
  const [idMsg, setIdMsg] = useState("");
  const [fileMsg, setFileMsg] = useState("");
  const [busy, setBusy] = useState<"xlsx" | "pdf" | "print" | "">("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

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

  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    fetch(`/api/clinica/${params.id}/resultado-operacional?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.receitaBrutaCents != null) setResultado(d);
      })
      .catch(() => {});
  }, [params.id, from, to]);

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

  function fileBase() {
    return `prestacao-contas-${reportFileSlug(clinic.name || "clinica") || "clinica"}-${from}-${to}`;
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function workbookInput() {
    return {
      destination,
      periodLabel: periodLabel(from, to),
      issuedAt: new Date().toLocaleString("pt-BR"),
      clinic: {
        name: clinic.name,
        legalName: clinic.legalName || clinic.name,
        cnpj: clinic.cnpj || "—",
        city: clinic.city || "—",
      },
      totals: {
        appointments: summary?.count || 0,
        billedCents: summary?.producedCents || 0,
        receivedCents: summary?.receivedCents || 0,
        pendingCents: summary?.pendingCents || 0,
        clinicCents: summary?.clinicShareCents || 0,
        doctorCents: summary?.doctorShareCents || 0,
      },
      byDoctor: (summary?.byDoctor || []).map((d) => ({
        doctorName: d.doctorName,
        crm: d.doctorCrm || "—",
        appointments: d.count,
        billedCents: d.producedCents,
        receivedCents: d.receivedCents,
        pendingCents: d.pendingCents,
        clinicCents: d.clinicShareCents,
        doctorCents: d.doctorShareCents,
        feeCents: d.feeCents,
        clinicSharePercent: d.clinicSharePercent,
      })),
      rows: chronological.map((r, i) => {
        const d = new Date(r.attendedAt);
        return {
          n: i + 1,
          date: d.toLocaleDateString("pt-BR"),
          time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          patientName: r.patientName || "Não informado",
          doctorName: r.doctorName,
          crm: r.doctorCrm || "—",
          billedCents: r.feeCents,
          receivedCents: r.receivedCents,
          clinicCents: r.clinicShareCents,
          doctorCents: r.doctorShareCents,
          paymentLabel: sit(r.paymentStatus),
        };
      }),
      notes: notes.trim() || undefined,
    };
  }

  function downloadCsv() {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, `${fileBase()}.csv`);
    setFileMsg("CSV baixado.");
  }

  function downloadExcel() {
    setBusy("xlsx");
    setFileMsg("");
    setErr("");
    try {
      const bytes = clinicReportXlsxBytes(workbookInput());
      saveBlob(
        new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${fileBase()}.xlsx`,
      );
      setFileMsg("Planilha Excel baixada. Abra no computador ou no app da planilha.");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Não foi possível montar a planilha.");
    } finally {
      setBusy("");
    }
  }

  async function openPdf() {
    setBusy("pdf");
    setFileMsg("");
    setErr("");
    try {
      const q = new URLSearchParams({ from, to, format: "pdf", destination });
      if (notes.trim()) q.set("notes", notes.trim().slice(0, 4000));
      const res = await fetch(`/api/clinica/${params.id}/relatorio-oficial?${q}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Não foi possível gerar o PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) saveBlob(blob, `${fileBase()}.pdf`);
      setFileMsg(opened ? "PDF aberto. Use Imprimir nessa aba." : "PDF baixado.");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setBusy("");
    }
  }

  function printReport() {
    setBusy("print");
    setFileMsg("");
    const rowsHtml = chronological.length
      ? chronological
          .map((r, i) => {
            const d = new Date(r.attendedAt);
            return `<tr>
              <td>${i + 1}</td>
              <td>${d.toLocaleDateString("pt-BR")}</td>
              <td>${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>${r.patientName || "Não informado"}</td>
              <td>${r.doctorName}</td>
              <td>${r.doctorCrm || "—"}</td>
              <td>${money(r.feeCents)}</td>
              <td>${money(r.receivedCents)}</td>
              <td>${sit(r.paymentStatus)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="9">Sem atendimentos no período.</td></tr>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${clinic.name || "Relatório"}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 16px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p, td, th { font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #f3f3f3; }
        @page { size: A4; margin: 12mm; }
      </style></head><body>
      <h1>Prestação de contas de atendimentos</h1>
      <p><b>${clinic.legalName || clinic.name}</b> · CNPJ ${clinic.cnpj || "—"} · ${clinic.city || ""}</p>
      <p>Destinatário: ${escapeHtml(destination)}<br/>Período: ${periodLabel(from, to)} · ${summary?.count || 0} atendimento(s) · ${money(summary?.producedCents || 0)}</p>
      ${notes.trim() ? `<p><b>Observações:</b> ${escapeHtml(notes.trim()).replace(/\n/g, "<br/>")}</p>` : ""}
      <table><thead><tr><th>Nº</th><th>Data</th><th>Hora</th><th>Paciente</th><th>Médico</th><th>CRM</th><th>Valor</th><th>Recebido</th><th>Sit.</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <p>Clínica ${money(summary?.clinicShareCents || 0)} · Honorários ${money(summary?.doctorShareCents || 0)} · Pendente ${money(summary?.pendingCents || 0)}</p>
      <script>window.addEventListener("load", function () { window.print(); });</script>
      </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      setView("tabela");
      window.setTimeout(() => window.print(), 50);
      setFileMsg("Imprima esta tela (Ctrl+P). A tabela já está visível.");
      setBusy("");
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setBusy("");
    setFileMsg("Tabela aberta para imprimir. Se o diálogo não aparecer, use Ctrl+P na nova aba.");
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
      setIdMsg("Dados da unidade salvos.");
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
          Lista grande: mande a planilha Excel — uma tabela só, a prefeitura e a gestora abrem no computador. O PDF oficial é para protocolar com assinatura, quando a lista cabe em poucas páginas.
        </p>

        <form onSubmit={saveIdentity} className="panel mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Dados da unidade no documento</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Razão social, CNPJ e município são opcionais. Se preencher, entram no cabeçalho do PDF e da planilha.
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
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observações (opcional)</span>
            <textarea
              className="input-field min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
              placeholder="Se quiser escrever algo no relatório, escreva aqui. Senão, deixe em branco."
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-gold min-h-12" onClick={downloadExcel} disabled={busy === "xlsx"}>
            {busy === "xlsx" ? "Montando planilha…" : "Baixar Excel"}
          </button>
          <button type="button" className="btn-ghost min-h-12" onClick={printReport} disabled={busy === "print"}>
            {busy === "print" ? "Abrindo impressão…" : "Imprimir tabela"}
          </button>
          <button type="button" className="btn-ghost min-h-12" onClick={openPdf} disabled={busy === "pdf"}>
            {busy === "pdf" ? "Gerando PDF…" : "PDF para protocolar"}
          </button>
          <button type="button" className="btn-ghost min-h-12" onClick={downloadCsv} disabled={!csv}>
            CSV
          </button>
        </div>
        {fileMsg && <p className="mt-3 text-sm text-[var(--text-soft)]">{fileMsg}</p>}
        {summary && summary.count >= 30 && (
          <p className="mt-3 text-sm text-amber-800">
            {summary.count} atendimentos neste período. A planilha Excel evita dezenas de páginas de PDF.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("tabela")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              view === "tabela" ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            Tabela
          </button>
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
          <button
            type="button"
            onClick={() => setView("resultado")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              view === "resultado" ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            Resultado operacional
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
      </div>

      {view === "tabela" && summary && (
        <div className="clinic-print-area mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{clinic.name}</p>
              <h2 className="font-display text-2xl font-extrabold">Tabela de produção</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {periodLabel(from, to)} · {summary.count} atendimento{summary.count === 1 ? "" : "s"} · {money(summary.producedCents)}
              </p>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Clínica {money(summary.clinicShareCents)} · honorários {money(summary.doctorShareCents)} · pendente {money(summary.pendingCents)}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="sticky top-0 bg-[var(--gold-soft)]">
                <tr className="text-[11px] uppercase text-[var(--text-muted)]">
                  <th className="px-3 py-2">Nº</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">Médico</th>
                  <th className="px-3 py-2">CRM</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Recebido</th>
                  <th className="px-3 py-2">Clínica</th>
                  <th className="px-3 py-2">Honorário</th>
                  <th className="px-3 py-2">Sit.</th>
                </tr>
              </thead>
              <tbody>
                {chronological.map((r, i) => {
                  const d = new Date(r.attendedAt);
                  return (
                    <tr key={r.id} className="border-t border-[var(--border)] even:bg-[var(--bg)]">
                      <td className="px-3 py-1.5">{i + 1}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{d.toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-1.5">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-3 py-1.5 font-semibold">{r.patientName || "Não informado"}</td>
                      <td className="px-3 py-1.5">{r.doctorName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{r.doctorCrm || "—"}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{money(r.feeCents)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{money(r.receivedCents)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{money(r.clinicShareCents)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{money(r.doctorShareCents)}</td>
                      <td className="px-3 py-1.5">{sit(r.paymentStatus)}</td>
                    </tr>
                  );
                })}
                {chronological.length === 0 && (
                  <tr><td colSpan={11} className="px-3 py-4 text-[var(--text-muted)]">Sem atendimentos no período.</td></tr>
                )}
              </tbody>
              {chronological.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[var(--text)] font-bold">
                    <td className="px-3 py-2" colSpan={6}>Total</td>
                    <td className="px-3 py-2 whitespace-nowrap">{money(summary.producedCents)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{money(summary.receivedCents)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{money(summary.clinicShareCents)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{money(summary.doctorShareCents)}</td>
                    <td className="px-3 py-2">{summary.pendingCents ? money(summary.pendingCents) : "—"}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

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

          {notes.trim() ? (
            <>
              <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">5. Observações</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{notes.trim()}</p>
              <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">6. Assinaturas</h3>
            </>
          ) : (
            <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">5. Assinaturas</h3>
          )}
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

      {view === "resultado" && resultado && (
        <div className="mt-6 print:hidden">
          <h2 className="font-display text-2xl font-extrabold">Resultado operacional</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Receita bruta − despesas = resultado. O repasse médico/clínica continua o das regras já cadastradas.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="panel">
              <p className="text-xs font-bold uppercase text-[var(--gold)]">Receitas</p>
              <p className="mt-2 text-sm">Consultas {money(resultado.receitas.consultasCents)}</p>
              <p className="text-sm">Procedimentos {money(resultado.receitas.procedimentosCents)}</p>
              <p className="text-sm">Outros recebimentos {money(resultado.receitas.outrosCents)}</p>
            </div>
            <div className="panel">
              <p className="text-xs font-bold uppercase text-[var(--gold)]">Despesas</p>
              <p className="mt-2 text-sm">Materiais {money(resultado.despesas.materiaisCents)}</p>
              <p className="text-sm">Funcionários/prestadores {money(resultado.despesas.funcionariosCents)}</p>
              <p className="text-sm">Manutenção {money(resultado.despesas.manutencaoCents)}</p>
              <p className="text-sm">Taxas {money(resultado.despesas.taxasCents)}</p>
              <p className="text-sm">Outros {money(resultado.despesas.outrosCents)}</p>
            </div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Receita bruta</p><p className="font-display text-2xl font-extrabold">{money(resultado.receitaBrutaCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Despesas</p><p className="font-display text-2xl font-extrabold">{money(resultado.despesaTotalCents)}</p></div>
            <div className="panel sm:col-span-2"><p className="text-xs uppercase text-[var(--text-muted)]">Resultado operacional</p><p className="font-display text-2xl font-extrabold">{money(resultado.resultadoCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Parte da clínica</p><p className="font-display text-2xl font-extrabold">{money(resultado.clinicShareCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Parte dos médicos</p><p className="font-display text-2xl font-extrabold">{money(resultado.doctorShareCents)}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-gold" href={`/api/clinica/${params.id}/resultado-operacional?from=${from}&to=${to}&format=xlsx`}>
              Baixar Excel
            </a>
            <a className="btn-ghost" href={`/api/clinica/${params.id}/resultado-operacional?from=${from}&to=${to}&format=pdf`} target="_blank" rel="noreferrer">
              Baixar PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}