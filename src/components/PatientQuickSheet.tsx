"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReferToCareTeam } from "@/components/ReferToCareTeam";

type Lab = { value: number; unit: string | null; date: string; trend: "up" | "down" | "flat" | null } | null;
type Summary = {
  patient: { name: string; city: string; age: number | null; sex: string | null };
  drc: { g: string | null; a: string | null };
  labs: { tfge: Lab; tfge_cistatina: Lab; creatinina: Lab; rac: Lab; proteinuria_24h: Lab; potassio: Lab; hemoglobina: Lab };
  vitals: { pa: { text: string; date: string } | null; peso: { value: number; date: string } | null };
  lastConsultation: string | null;
  nextConsultation: string | null;
  alerts: { level: "urgente" | "importante" | "atencao"; text: string; date: string }[];
};

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const trendArrow = (t: Lab extends null ? never : "up" | "down" | "flat" | null) => (t === "up" ? "↑" : t === "down" ? "↓" : t === "flat" ? "→" : "");
const alertColor = { urgente: "#e86761", importante: "#e08a2e", atencao: "#e4a32e" } as const;
const alertEmoji = { urgente: "🔴", importante: "🟠", atencao: "🟡" } as const;

function LabCell({ label, lab }: { label: string; lab: Lab }) {
  if (!lab) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="font-display text-lg leading-tight text-[var(--text)]">
        {lab.value}
        {lab.trend ? <span className="ml-1 text-sm text-[var(--gold)]">{trendArrow(lab.trend)}</span> : null}
        {lab.unit ? <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">{lab.unit}</span> : null}
      </p>
      <p className="text-[11px] text-[var(--text-muted)]">{fmtDate(lab.date)}</p>
    </div>
  );
}

export function PatientQuickSheet({ patientKey, onClose }: { patientKey: string; onClose: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    fetch(`/api/doctor/patients/${encodeURIComponent(patientKey)}/summary`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar o resumo."))))
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [patientKey]);

  const sexLabel = data?.patient.sex ? (/^(f|fem|mulher)/i.test(data.patient.sex) ? "Feminino" : /^(m|masc|homem)/i.test(data.patient.sex) ? "Masculino" : data.patient.sex) : null;

  return (
    <div className="fixed inset-0 z-[60] flex sm:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mt-auto max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--bg)] p-5 shadow-2xl sm:mt-0 sm:max-h-none sm:h-full sm:w-[420px] sm:rounded-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">Resumo rápido</p>
            <h2 className="font-display text-2xl text-[var(--text)]">{data?.patient.name || "Paciente"}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {[data?.patient.age != null ? `${data.patient.age} anos` : null, sexLabel, data?.patient.city].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <button type="button" className="btn-ghost px-3 py-1 text-sm" onClick={onClose}>Fechar</button>
        </div>

        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
        {!data && !error && <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando resumo…</p>}

        {data && (
          <>
            {(data.drc.g || data.drc.a) && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-1 text-sm font-semibold text-[var(--gold)]">
                DRC {data.drc.g || ""} {data.drc.a || ""}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <LabCell label="TFGe" lab={data.labs.tfge || data.labs.tfge_cistatina} />
              <LabCell label="Creatinina" lab={data.labs.creatinina} />
              <LabCell label="RAC" lab={data.labs.rac} />
              <LabCell label="Proteinúria 24h" lab={data.labs.proteinuria_24h} />
              <LabCell label="Potássio" lab={data.labs.potassio} />
              <LabCell label="Hemoglobina" lab={data.labs.hemoglobina} />
              {data.vitals.pa && (
                <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">PA</p>
                  <p className="font-display text-lg leading-tight text-[var(--text)]">{data.vitals.pa.text} <span className="text-xs font-normal text-[var(--text-muted)]">mmHg</span></p>
                  <p className="text-[11px] text-[var(--text-muted)]">{fmtDate(data.vitals.pa.date)}</p>
                </div>
              )}
              {data.vitals.peso && (
                <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Peso</p>
                  <p className="font-display text-lg leading-tight text-[var(--text)]">{data.vitals.peso.value} <span className="text-xs font-normal text-[var(--text-muted)]">kg</span></p>
                  <p className="text-[11px] text-[var(--text-muted)]">{fmtDate(data.vitals.peso.date)}</p>
                </div>
              )}
            </div>

            {(!data.labs.tfge && !data.labs.creatinina && !data.labs.rac && !data.labs.potassio && !data.vitals.pa) && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Ainda não há exames/registros para exibir.</p>
            )}

            {data.alerts.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Alertas</p>
                <ul className="mt-2 space-y-1.5">
                  {data.alerts.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: alertColor[a.level] }}>
                      <span aria-hidden>{alertEmoji[a.level]}</span>
                      <span className="text-[var(--text-soft)]"><strong className="capitalize" style={{ color: alertColor[a.level] }}>{a.level}</strong> — {a.text} <span className="text-[var(--text-muted)]">({fmtDate(a.date)})</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              <span>Última consulta: {data.lastConsultation ? fmtDate(data.lastConsultation) : "—"}</span>
              <span>Próxima consulta: {data.nextConsultation ? fmtDate(data.nextConsultation) : "—"}</span>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Encaminhar para a equipe</p>
              <p className="mt-0.5 mb-2 text-xs text-[var(--text-muted)]">O nome deste paciente aparece na área da profissional.</p>
              <ReferToCareTeam emailParam={patientKey} patientName={data.patient.name} compact />
            </div>

            <Link href={`/medicos/paciente/${encodeURIComponent(patientKey)}`} className="btn-gold mt-5 block text-center">
              Abrir prontuário →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
