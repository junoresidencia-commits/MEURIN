"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClinicalSummaryBar } from "@/components/ClinicalSummaryBar";
import { encodePatientParam, toFriendlyMessage } from "@/lib/user-errors";
import { formatSlotLabel } from "@/lib/scheduling-client";

type Lab = { value: number; unit: string | null; date: string };
type Note = {
  createdAt: string;
  doctorName: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

type Summary = {
  patient: { name: string; city?: string | null; age?: number | null; sex?: string | null };
  drc: { g: string | null; a: string | null };
  labs: Record<string, Lab | null>;
  vitals: {
    pa: { text: string; date: string } | null;
    peso: { value: number; date: string } | null;
  };
  lastConsultation: string | null;
  lastNote: Note | null;
  alerts: { level: "urgente" | "importante" | "atencao"; text: string; date: string }[];
};

function shortDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function labLine(lab?: Lab | null) {
  if (!lab) return "—";
  const unit = lab.unit ? ` ${lab.unit}` : "";
  return `${String(lab.value).replace(".", ",")}${unit} · ${shortDate(lab.date)}`;
}

export function ConsultChartPanel({ patientEmail }: { patientEmail: string }) {
  const key = encodePatientParam(patientEmail);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({ chiefComplaint: "", plan: "" });

  const load = useCallback(async () => {
    try {
      const [sumRes, profRes] = await Promise.all([
        fetch(`/api/doctor/patients/${key}/summary`),
        fetch(`/api/doctor/patients/${key}/profile`),
      ]);
      const sum = await sumRes.json();
      const prof = await profRes.json();
      if (!sumRes.ok) throw new Error(sum.error || "Não foi possível abrir o prontuário.");
      setSummary(sum);
      setProfile(prof.profile || {});
      setError("");
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível abrir o prontuário."));
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chiefComplaint.trim() && !form.plan.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${key}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint: form.chiefComplaint.trim(),
          plan: form.plan.trim(),
          sharedWithPatient: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gravar a evolução.");
      setForm({ chiefComplaint: "", plan: "" });
      setSaveMsg("Evolução gravada.");
      await load();
    } catch (err) {
      setSaveMsg(toFriendlyMessage(err, "Não foi possível gravar a evolução."));
    } finally {
      setSaving(false);
    }
  }

  const labsForBar = Object.entries(summary?.labs || {})
    .filter(([, v]) => v)
    .map(([testKey, v]) => ({
      testKey,
      value: v!.value,
      unit: v!.unit,
      measuredAt: v!.date,
    }));

  const chartHref = `/medicos/paciente/${key}`;

  return (
    <aside className="panel flex max-h-[min(72vh,760px)] flex-col overflow-hidden !p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
            Prontuário na consulta
          </p>
          <h2 className="font-display mt-1 text-xl text-[var(--text)]">
            {summary?.patient.name || "Paciente"}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {[
              summary?.patient.age != null ? `${summary.patient.age} anos` : null,
              summary?.patient.city,
              summary?.drc.g ? `DRC ${summary.drc.g}${summary.drc.a ? summary.drc.a : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link href={chartHref} className="text-xs font-bold text-[var(--gold)] underline">
          Completo
        </Link>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary?.alerts?.length ? (
        <ul className="mt-3 space-y-1">
          {summary.alerts.map((a) => (
            <li
              key={a.text}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                a.level === "urgente"
                  ? "bg-red-50 text-red-800"
                  : a.level === "importante"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-[var(--gold-soft)] text-[var(--text)]"
              }`}
            >
              {a.text}
            </li>
          ))}
        </ul>
      ) : null}

      {summary && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <p><span className="text-[var(--text-muted)]">TFGe</span><br />{labLine(summary.labs.tfge)}</p>
          <p><span className="text-[var(--text-muted)]">Creatinina</span><br />{labLine(summary.labs.creatinina)}</p>
          <p><span className="text-[var(--text-muted)]">Potássio</span><br />{labLine(summary.labs.potassio)}</p>
          <p><span className="text-[var(--text-muted)]">Hemoglobina</span><br />{labLine(summary.labs.hemoglobina)}</p>
          <p><span className="text-[var(--text-muted)]">PA</span><br />{summary.vitals.pa ? `${summary.vitals.pa.text} · ${shortDate(summary.vitals.pa.date)}` : "—"}</p>
          <p><span className="text-[var(--text-muted)]">Peso</span><br />{summary.vitals.peso ? `${summary.vitals.peso.value} kg · ${shortDate(summary.vitals.peso.date)}` : "—"}</p>
        </div>
      )}

      {summary && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ClinicalSummaryBar age={summary.patient.age} data={profile} labs={labsForBar} />
          {summary.lastNote && (
            <section className="mt-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
                Última evolução · {shortDate(summary.lastNote.createdAt)}
              </p>
              <p className="mt-1 text-sm text-[var(--text)]">
                {[summary.lastNote.chiefComplaint, summary.lastNote.assessment, summary.lastNote.plan]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            </section>
          )}
          {summary.lastConsultation && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Última consulta: {formatSlotLabel(summary.lastConsultation)}
            </p>
          )}
        </div>
      )}

      <form onSubmit={(e) => void saveNote(e)} className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Evolução agora</p>
        <textarea
          className="input-field !min-h-[64px] text-sm"
          placeholder="Queixa / o que o paciente relata"
          value={form.chiefComplaint}
          onChange={(e) => setForm((f) => ({ ...f, chiefComplaint: e.target.value }))}
        />
        <textarea
          className="input-field !min-h-[64px] text-sm"
          placeholder="Conduta / plano"
          value={form.plan}
          onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
        />
        <button type="submit" className="btn-gold !min-h-[44px] w-full !text-sm" disabled={saving}>
          {saving ? "Gravando…" : "Gravar evolução"}
        </button>
        {saveMsg && <p className="text-xs text-[var(--gold-light)]">{saveMsg}</p>}
      </form>
    </aside>
  );
}
