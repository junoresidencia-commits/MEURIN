"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_ALERT_LABEL, HD_EXAM_LABEL, HD_SHIFT_LABEL } from "@/lib/hd-labels";

type Detail = {
  patient: { id: string; name: string; notes: string; patientId: string | null };
  row: { shift: "MANHA" | "TARDE" | "NOITE"; machine: string; ward: string; access: string } | null;
  labs: Record<string, number | null>;
  labRows: Array<{ id: string; examCode: string; rawValue: string; unit: string; confidence: number; status: string; collectedAt: string | null }>;
  alerts: Array<{ level: "OK" | "REVISAR" | "CRITICO"; message: string; suggestion: string; code: string }>;
  status: "OK" | "REVISAR" | "CRITICO";
  urr: number | null;
  ktv: number | null;
  trends: Record<string, Array<{ at: string; value: number }>>;
  prescription: Record<string, string> | null;
  suggestion: string;
  review: { decision: string; notes: string } | null;
  files: Array<{ id: string; name: string }>;
};

const TABS = ["Resumo", "Exames", "Prescrição", "Evolução", "Histórico", "Original"] as const;

export default function HdPacientePage() {
  const { id } = useParams<{ id: string }>();
  const { year, month, can } = useHd();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Resumo");
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    const u = new URLSearchParams({ view: "patient", id, year: String(year), month: String(month) });
    fetch(`/api/hemodialise?${u}`).then((r) => r.json()).then((x) => { if (!x.error) setD(x); });
  }, [id, year, month]);

  if (!d) return <p className="text-[var(--text-muted)]">Carregando paciente…</p>;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Paciente</p>
      <h2 className="font-display text-3xl font-extrabold">{d.patient.name}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {d.row ? `${HD_SHIFT_LABEL[d.row.shift]} · ${d.row.ward} · Máq ${d.row.machine} · ${d.row.access || "acesso ?"}` : "Sem posição no mapa"}
        {" · "}
        <span className={d.status === "CRITICO" ? "font-bold text-[var(--danger)]" : d.status === "REVISAR" ? "text-[var(--warn)]" : "text-[var(--green)]"}>
          {HD_ALERT_LABEL[d.status]}
        </span>
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-[var(--gold)] text-white" : "text-[var(--text-muted)]"}`}>{t}</button>
        ))}
      </div>

      {tab === "Resumo" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="panel">
            <p className="font-bold">Exames atuais</p>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(d.labs).filter(([, v]) => v != null).map(([k, v]) => (
                <li key={k}>{HD_EXAM_LABEL[k as keyof typeof HD_EXAM_LABEL] || k}: <strong>{v}</strong></li>
              ))}
            </ul>
            <p className="mt-3 text-sm">URR: {d.urr == null ? "—" : `${d.urr}%`} · Kt/V: {d.ktv == null ? "—" : d.ktv}</p>
          </div>
          <div className="panel">
            <p className="font-bold">Alertas do protocolo</p>
            {d.alerts.length === 0 && <p className="mt-2 text-sm text-[var(--green)]">OK — sem alerta prioritário.</p>}
            {d.alerts.map((a) => (
              <div key={a.code} className="mt-2 text-sm">
                <p className={a.level === "CRITICO" ? "font-bold text-[var(--danger)]" : "font-semibold text-[var(--warn)]"}>{a.message}</p>
                <p className="text-[var(--text-muted)]">{a.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Exames" && (
        <div className="panel mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-xs uppercase text-[var(--text-muted)]"><th className="py-2 text-left">Exame</th><th>Valor</th><th>Confiança</th><th>Status</th></tr></thead>
            <tbody>
              {d.labRows.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{HD_EXAM_LABEL[l.examCode as keyof typeof HD_EXAM_LABEL] || l.examCode}</td>
                  <td>{l.rawValue} {l.unit}</td>
                  <td>{l.confidence}%</td>
                  <td>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Prescrição" && (
        <div className="panel mt-4">
          {!can("view_exams") || !d.prescription ? <p>Prescrição não disponível para este perfil.</p> : (
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {Object.entries(d.prescription).map(([k, v]) => (
                <p key={k}><span className="text-[var(--text-muted)]">{k}:</span> {v || "—"}</p>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
            <p className="font-bold">Situação identificada</p>
            <p>{d.alerts.map((a) => a.message).join(" · ") || "Sem alteração detectada."}</p>
            <p className="mt-2 font-bold">Sugestão do protocolo</p>
            <p>{d.suggestion}</p>
            <p className="mt-2 font-bold">Decisão médica</p>
            <p>{d.review ? `${d.review.decision} — ${d.review.notes || "sem nota"}` : "Ainda não revisado. A IA não altera sozinha."}</p>
          </div>
        </div>
      )}

      {tab === "Evolução" && (
        <div className="panel mt-4 grid gap-3 sm:grid-cols-2">
          {["hb", "p", "pth", "k", "albumin"].map((code) => (
            <div key={code}>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">{HD_EXAM_LABEL[code as keyof typeof HD_EXAM_LABEL]}</p>
              <p className="font-display text-lg font-bold">
                {(d.trends[code] || []).map((t) => t.value).join(" → ") || "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "Histórico" && (
        <div className="panel mt-4 text-sm text-[var(--text-muted)]">
          Até 12 meses de tendência nos exames confirmados. Nada é apagado na auditoria.
        </div>
      )}

      {tab === "Original" && (
        <div className="panel mt-4">
          <p className="font-bold">Ver exame original</p>
          {d.files.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum arquivo original vinculado.</p>}
          <ul className="mt-2 space-y-1">
            {d.files.map((f) => (
              <li key={f.id}><a className="text-[var(--gold)]" href={`/api/hemodialise/arquivo?kind=file&id=${f.id}`} target="_blank" rel="noreferrer">{f.name}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
