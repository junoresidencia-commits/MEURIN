"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { reportRangeFor, type ReportPeriodKey } from "@/lib/report-period";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

export default function ClinicaRelatoriosPage() {
  const params = useParams<{ id: string }>();
  const [clinic, setClinic] = useState("");
  const initial = reportRangeFor("mes");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [period, setPeriod] = useState<ReportPeriodKey>("mes");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Encounter[]>([]);
  const [err, setErr] = useState("");

  function applyPeriod(key: ReportPeriodKey) {
    const r = reportRangeFor(key);
    setPeriod(key);
    setFrom(r.from);
    setTo(r.to);
  }

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/me`)
      .then((r) => r.json())
      .then((d) => setClinic(d.clinic?.name || "Clínica"))
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
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [params.id, from, to]);

  const csv = useMemo(() => {
    if (!summary) return "";
    const head = "Médico;Consultas;Valor vigente; % clínica;Produção;Clínica;Médico;Recebido;Pendente";
    const body = summary.byDoctor.map((d) =>
      [
        d.doctorName,
        d.count,
        d.feeCents != null ? (d.feeCents / 100).toFixed(2) : "",
        d.clinicSharePercent ?? "",
        (d.producedCents / 100).toFixed(2),
        (d.clinicShareCents / 100).toFixed(2),
        (d.doctorShareCents / 100).toFixed(2),
        (d.receivedCents / 100).toFixed(2),
        (d.pendingCents / 100).toFixed(2),
      ].join(";")
    );
    return [head, ...body].join("\n");
  }, [summary]);

  function downloadCsv() {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${clinic || "clinica"}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Relatórios</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Produção e repasse por médico nesta clínica. O valor de cada um é o desta unidade — não o de outra cidade.
        </p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
          <button type="button" className="btn-gold mt-6 min-h-12" onClick={() => window.print()}>Imprimir</button>
          <button type="button" className="btn-ghost mt-6 min-h-12" onClick={downloadCsv} disabled={!csv}>Baixar CSV</button>
        </div>
        {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
      </div>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{clinic}</p>
        <h2 className="font-display text-2xl font-extrabold">Relatório de produção</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {from ? new Date(from + "T12:00:00").toLocaleDateString("pt-BR") : "início"} até{" "}
          {to ? new Date(to + "T12:00:00").toLocaleDateString("pt-BR") : "hoje"}
        </p>
      </div>

      {summary && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Atendimentos</p><p className="font-display text-2xl font-extrabold">{summary.count}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produção</p><p className="font-display text-2xl font-extrabold">{brl(summary.producedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Recebido</p><p className="font-display text-2xl font-extrabold">{brl(summary.receivedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Clínica</p><p className="font-display text-2xl font-extrabold">{brl(summary.clinicShareCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Médicos</p><p className="font-display text-2xl font-extrabold">{brl(summary.doctorShareCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Pendente</p><p className="font-display text-2xl font-extrabold">{brl(summary.pendingCents)}</p></div>
          </div>

          <h3 className="mt-8 font-display text-xl font-bold">Por médico</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Médico</th>
                  <th className="py-2 pr-3">Consultas</th>
                  <th className="py-2 pr-3">Valor / %</th>
                  <th className="py-2 pr-3">Produção</th>
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2 pr-3">Médico</th>
                  <th className="py-2 pr-3">Recebido</th>
                  <th className="py-2">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {summary.byDoctor.map((d) => (
                  <tr key={d.doctorId} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-semibold">{d.doctorName}</td>
                    <td className="py-2 pr-3">{d.count}</td>
                    <td className="py-2 pr-3">
                      {d.feeCents != null ? `${brl(d.feeCents)} · ${d.clinicSharePercent ?? 0}%` : "—"}
                    </td>
                    <td className="py-2 pr-3">{brl(d.producedCents)}</td>
                    <td className="py-2 pr-3">{brl(d.clinicShareCents)}</td>
                    <td className="py-2 pr-3">{brl(d.doctorShareCents)}</td>
                    <td className="py-2 pr-3">{brl(d.receivedCents)}</td>
                    <td className="py-2">{brl(d.pendingCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 font-display text-xl font-bold">Atendimentos</h3>
          <div className="mt-2 space-y-2">
            {rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum atendimento no período.</p>}
            {rows.map((r) => (
              <div key={r.id} className="panel flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-bold">{r.patientName || r.id.slice(0, 8)}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {r.doctorName} · {new Date(r.attendedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {brl(r.feeCents)} · clínica {brl(r.clinicShareCents)} · médico {brl(r.doctorShareCents)} · recebido {brl(r.receivedCents)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
