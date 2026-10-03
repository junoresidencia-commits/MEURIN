"use client";

import { formatMedicationLines } from "@/lib/clinical-summary";
import { labLabel, labUnit } from "@/lib/labs";
import { HomeVitalsCharts, SeriesChart, type HomeVital } from "@/components/HomeVitalsCharts";

type Lab = { testKey: string; value: number; unit?: string | null; measuredAt: string };
type Note = {
  id: string;
  doctorName: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
  createdAt: string;
};

const LAB_CHARTS: { key: string; color: string; refs?: { y: number; label: string; color: string }[] }[] = [
  { key: "tfge", color: "#087b82", refs: [{ y: 60, label: "60", color: "#e4a32e" }, { y: 30, label: "30", color: "#c04b46" }] },
  { key: "creatinina", color: "#0d5b67" },
  { key: "potassio", color: "#c04b46", refs: [{ y: 5.5, label: "5,5", color: "#c04b46" }, { y: 3.5, label: "3,5", color: "#087b82" }] },
  { key: "hemoglobina", color: "#7758c6", refs: [{ y: 10, label: "10", color: "#e4a32e" }] },
  { key: "rac", color: "#1a9a78" },
];

function labPoints(labs: Lab[], key: string) {
  return labs
    .filter((l) => l.testKey === key)
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .map((l) => ({ x: l.measuredAt, y: l.value }));
}

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

export function DoctorSummaryEvolution({
  records,
  labs,
  notes,
  profile,
}: {
  records: HomeVital[];
  labs: Lab[];
  notes: Note[];
  profile: Record<string, unknown>;
}) {
  const meds = formatMedicationLines(profile.medicamentos_em_uso);
  const renal = LAB_CHARTS.map((c) => ({ ...c, points: labPoints(labs, c.key) })).filter((c) => c.points.length > 0);
  const hasHome = records.some((r) => r.kind === "bp" || r.kind === "glucose" || r.kind === "weight");

  return (
    <div className="space-y-4">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Como o paciente evolui</p>
        <p className="text-sm text-[var(--text-soft)]">
          O que importa é a tendência ao longo do tempo — não um dia isolado. Cada ponto é uma data real.
        </p>
      </div>

      {hasHome && <HomeVitalsCharts records={records} />}

      {renal.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {renal.map((c) => {
            const last = c.points[c.points.length - 1];
            return (
              <div key={c.key} className="rounded-2xl border border-[var(--border)] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">{labLabel(c.key)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{c.points.length} registro{c.points.length === 1 ? "" : "s"}</p>
                  </div>
                  <p className="text-right text-sm font-extrabold text-[var(--text)]">
                    {String(last.y).replace(".", ",")}
                    {labUnit(c.key) ? <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">{labUnit(c.key)}</span> : null}
                    <span className="block text-[11px] font-normal text-[var(--text-muted)]">{shortDate(last.x)}</span>
                  </p>
                </div>
                <SeriesChart unit={labUnit(c.key) || undefined} series={[{ label: labLabel(c.key), color: c.color, points: c.points }]} refs={c.refs} />
                {c.points.length === 1 && (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Só uma data ainda. O gráfico cresce conforme entram novos exames.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasHome && renal.length === 0 && (
        <p className="panel text-sm text-[var(--text-muted)]">
          Ainda não há série no tempo. Quando o paciente registrar em casa ou você lançar exames em datas diferentes, o gráfico aparece aqui.
        </p>
      )}

      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicações em uso</p>
        {meds.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--text)]">
            {meds.map((m) => <li key={m}>{m}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhuma medicação informada. O paciente pode cadastrar na área dele; você também edita no Perfil.
          </p>
        )}
      </div>

      {notes.length > 0 && (
        <div className="panel space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Evoluções clínicas</p>
          {notes.slice(0, 4).map((n) => (
            <div key={n.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
              <p className="text-xs text-[var(--text-muted)]">{shortDate(n.createdAt)} · {n.doctorName}</p>
              <p className="mt-1 text-sm text-[var(--text)]">
                {[n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join(" — ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
