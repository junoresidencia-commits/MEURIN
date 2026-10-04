"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClinicalSummaryBar } from "@/components/ClinicalSummaryBar";
import { encodePatientParam, toFriendlyMessage } from "@/lib/user-errors";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";

type Lab = { value: number; unit: string | null; date: string };
type Note = {
  id?: string;
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

const QUICK_LABS = [
  "creatinina",
  "potassio",
  "ureia",
  "hemoglobina",
  "sodio",
  "rac",
  "tfge",
];

export const ConsultChartPanel = memo(function ConsultChartPanel({ patientEmail }: { patientEmail: string }) {
  const key = encodePatientParam(patientEmail);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({ history: "", plan: "" });
  const [labTest, setLabTest] = useState("creatinina");
  const [labValue, setLabValue] = useState("");
  const [labSaving, setLabSaving] = useState(false);
  const [labMsg, setLabMsg] = useState("");

  const formRef = useRef(form);
  formRef.current = form;
  const noteIdRef = useRef<string | null>(null);
  const persistLock = useRef(false);
  const dirtyRef = useRef(false);

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

  const persistNote = useCallback(async () => {
    const history = formRef.current.history.trim();
    const plan = formRef.current.plan.trim();
    if (!history && !plan) return;
    if (persistLock.current) {
      dirtyRef.current = true;
      return;
    }
    persistLock.current = true;
    setSaving(true);
    try {
      const payload = {
        id: noteIdRef.current || undefined,
        history,
        plan,
        sharedWithPatient: true,
      };
      const res = await fetch(`/api/doctor/patients/${key}/notes`, {
        method: noteIdRef.current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gravar a evolução.");
      if (data.note?.id) noteIdRef.current = data.note.id;
      setSaveMsg("Salvo no prontuário");
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              lastNote: {
                id: data.note.id,
                createdAt: data.note.createdAt,
                doctorName: data.note.doctorName,
                history: data.note.history,
                plan: data.note.plan,
                chiefComplaint: data.note.chiefComplaint,
              },
            }
          : prev
      );
    } catch (err) {
      setSaveMsg(toFriendlyMessage(err, "Não foi possível gravar a evolução."));
    } finally {
      persistLock.current = false;
      setSaving(false);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void persistNote();
      }
    }
  }, [key]);

  useEffect(() => {
    if (!form.history.trim() && !form.plan.trim()) return;
    const timer = setTimeout(() => {
      void persistNote();
    }, 1200);
    return () => clearTimeout(timer);
  }, [form.history, form.plan, persistNote]);

  useEffect(() => {
    const flush = () => {
      void persistNote();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persistNote]);

  async function saveLab(e: React.FormEvent) {
    e.preventDefault();
    if (!labValue.trim()) return;
    setLabSaving(true);
    setLabMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${key}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testKey: labTest, value: labValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o exame.");
      setLabValue("");
      if (data.egfr?.value != null) {
        setLabMsg(`Exame gravado. TFGe ${String(data.egfr.value).replace(".", ",")} mL/min.`);
      } else if (data.egfrSkipped) {
        setLabMsg(`Exame gravado. ${data.egfrSkipped}`);
      } else {
        setLabMsg("Exame gravado no prontuário.");
      }
      await load();
    } catch (err) {
      setLabMsg(toFriendlyMessage(err, "Não foi possível salvar o exame."));
    } finally {
      setLabSaving(false);
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
  const labOptions = [
    ...NEPHRO_LABS.filter((l) => QUICK_LABS.includes(l.key)),
    ...NEPHRO_LABS.filter((l) => !QUICK_LABS.includes(l.key)),
  ];

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

      {summary &&
        (summary.labs.tfge ||
          summary.labs.creatinina ||
          summary.labs.potassio ||
          summary.labs.hemoglobina ||
          summary.vitals.pa ||
          summary.vitals.peso) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {summary.labs.tfge && <p><span className="text-[var(--text-muted)]">TFGe</span><br />{labLine(summary.labs.tfge)}</p>}
          {summary.labs.creatinina && <p><span className="text-[var(--text-muted)]">Creatinina</span><br />{labLine(summary.labs.creatinina)}</p>}
          {summary.labs.potassio && <p><span className="text-[var(--text-muted)]">Potássio</span><br />{labLine(summary.labs.potassio)}</p>}
          {summary.labs.hemoglobina && <p><span className="text-[var(--text-muted)]">Hemoglobina</span><br />{labLine(summary.labs.hemoglobina)}</p>}
          {summary.vitals.pa && <p><span className="text-[var(--text-muted)]">PA</span><br />{summary.vitals.pa.text} · {shortDate(summary.vitals.pa.date)}</p>}
          {summary.vitals.peso && <p><span className="text-[var(--text-muted)]">Peso</span><br />{summary.vitals.peso.value} kg · {shortDate(summary.vitals.peso.date)}</p>}
        </div>
      )}

      {summary && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ClinicalSummaryBar age={summary.patient.age} data={profile} labs={labsForBar} />
          {summary.lastNote && (
            <section className="mt-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
                No prontuário · {shortDate(summary.lastNote.createdAt)}
              </p>
              <p className="mt-1 text-sm text-[var(--text)]">
                {[summary.lastNote.history, summary.lastNote.chiefComplaint, summary.lastNote.assessment, summary.lastNote.plan]
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

      <form onSubmit={(e) => void saveLab(e)} className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Exame agora</p>
        <div className="flex gap-2">
          <select
            className="input-field !min-h-[42px] flex-1 !px-3 !text-xs"
            value={labTest}
            onChange={(e) => setLabTest(e.target.value)}
          >
            {labOptions.map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
          <input
            inputMode="decimal"
            className="input-field !min-h-[42px] w-24 !px-3 !text-sm"
            placeholder={labUnit(labTest) || "valor"}
            value={labValue}
            onChange={(e) => setLabValue(e.target.value)}
          />
          <button type="submit" className="btn-ghost !min-h-[42px] !px-3 !text-xs" disabled={labSaving || !labValue.trim()}>
            {labSaving ? "…" : "Salvar"}
          </button>
        </div>
        {labMsg && <p className="text-xs text-[var(--gold-light)]">{labMsg}</p>}
      </form>

      <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Evolução agora</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {saving ? "Salvando…" : saveMsg || "Grava sozinho no prontuário"}
          </p>
        </div>
        <textarea
          className="input-field !min-h-[88px] text-sm"
          placeholder="Vai escrevendo o que o paciente fala"
          value={form.history}
          onChange={(e) => setForm((f) => ({ ...f, history: e.target.value }))}
        />
        <textarea
          className="input-field !min-h-[64px] text-sm"
          placeholder="Conduta / plano"
          value={form.plan}
          onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
        />
        <button
          type="button"
          className="btn-gold !min-h-[44px] w-full !text-sm"
          disabled={saving || (!form.history.trim() && !form.plan.trim())}
          onClick={() => void persistNote()}
        >
          {saving ? "Salvando…" : "Gravar agora"}
        </button>
      </div>
    </aside>
  );
});
