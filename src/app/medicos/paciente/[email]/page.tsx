"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { NEPHRO_LABS, labLabel, labUnit } from "@/lib/labs";

type Lab = { id: string; testKey: string; value: number; unit?: string | null; measuredAt: string };

type HomeRecord = {
  id: string;
  kind: "bp" | "glucose" | "weight" | "symptom";
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  glucoseMgDl?: number | null;
  glucoseContext?: string | null;
  weightKg?: number | null;
  medContext?: string | null;
  symptoms?: string | null;
  note?: string | null;
  measuredAt: string;
};
type FoodLog = { id: string; food: string; meal?: string | null; quantity?: string | null; loggedAt: string };
type Booking = { id: string; status: string; slotStart: string; careReason: string; meetingRoomId: string };
type Patient = { email: string; name: string; city: string; phone: string };
type Note = {
  id: string;
  doctorName: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
  sharedWithPatient: boolean;
  createdAt: string;
};
type Doc = {
  id: string;
  type: "receita" | "exame" | "relatorio";
  title: string;
  sharedWithPatient: boolean;
  createdAt: string;
};

const REASON: Record<string, string> = {
  pressa: "Com pressa",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "2ª opinião",
  outro: "Outro",
};

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "evolucao", label: "Evolução" },
  { id: "exames", label: "Exames" },
  { id: "documentos", label: "Documentos" },
  { id: "sinais", label: "Sinais em casa" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "consultas", label: "Consultas" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const DOC_TYPE_LABEL: Record<Doc["type"], string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  relatorio: "Relatório",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProntuarioPage() {
  const router = useRouter();
  const params = useParams<{ email: string }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<HomeRecord[]>([]);
  const [food, setFood] = useState<FoodLog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [tab, setTab] = useState<Tab>("resumo");

  // Formulário de exame
  const [labTest, setLabTest] = useState<string>("creatinina");
  const [labValue, setLabValue] = useState("");
  const [labDate, setLabDate] = useState("");
  const [labSaving, setLabSaving] = useState(false);
  const [labErr, setLabErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulário de evolução
  const [form, setForm] = useState({ chiefComplaint: "", history: "", assessment: "", plan: "" });
  const [shared, setShared] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // Formulário de documento (receita / exame / relatório)
  const [docType, setDocType] = useState<Doc["type"]>("receita");
  const [docBody, setDocBody] = useState("");
  const [docShared, setDocShared] = useState(true);
  const [docSaving, setDocSaving] = useState(false);
  const [docErr, setDocErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/doctor/patients/${emailParam}`);
    if (res.status === 401) {
      router.replace("/medicos/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Não foi possível carregar o prontuário.");
      setLoading(false);
      return;
    }
    setPatient(data.patient);
    setRecords(data.records || []);
    setFood(data.food || []);
    setBookings(data.bookings || []);
    setNotes(data.notes || []);
    setDocuments(data.documents || []);
    setLabs(data.labs || []);
    setLoading(false);
  }, [emailParam, router]);

  async function saveLab() {
    if (!labValue.trim()) {
      setLabErr("Informe o valor.");
      return;
    }
    setLabSaving(true);
    setLabErr("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testKey: labTest,
          value: labValue,
          measuredAt: labDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setLabValue("");
      setLabDate("");
      await load();
    } catch (e) {
      setLabErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLabSaving(false);
    }
  }

  async function saveDocument() {
    setDocSaving(true);
    setDocErr("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: docType, body: docBody, sharedWithPatient: docShared }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível emitir.");
      setDocBody("");
      await load();
      if (data.document?.id) window.open(`/documento/${data.document.id}`, "_blank");
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setDocSaving(false);
    }
  }

  async function saveNote() {
    setSaving(true);
    setSaveErr("");
    setSaveMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sharedWithPatient: shared }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setForm({ chiefComplaint: "", history: "", assessment: "", plan: "" });
      setSaveMsg("Evolução salva no prontuário." + (shared ? " Liberada ao paciente." : ""));
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const labKeys = Array.from(new Set(labs.map((l) => l.testKey)));
  const bp = records.find((r) => r.kind === "bp");
  const glucose = records.find((r) => r.kind === "glucose");
  const weight = records.find((r) => r.kind === "weight");
  const sinais = records.filter((r) => r.kind !== "symptom");
  const sintomas = records.filter((r) => r.kind === "symptom");

  if (loading) {
    return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando prontuário…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <p className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-[var(--danger)]">
          {error}
        </p>
        <Link href="/medicos/painel" className="btn-ghost mt-6 inline-flex">
          Voltar ao painel
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">
        ← Painel
      </Link>

      <div className="panel mt-3 flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--gold-soft)] text-lg font-extrabold text-[var(--gold)]">
          {patient?.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">{patient?.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {[patient?.city, patient?.email].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Cabeçalho clínico */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="PA (casa)" value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"} unit={bp ? "mmHg" : ""} />
        <Metric label="Glicemia" value={glucose ? String(glucose.glucoseMgDl) : "—"} unit={glucose ? "mg/dL" : ""} />
        <Metric label="Peso" value={weight ? String(weight.weightKg).replace(".", ",") : "—"} unit={weight ? "kg" : ""} />
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "resumo" && (
          <div className="panel space-y-3">
            <p className="text-sm text-[var(--text-soft)]">
              Dados registrados pelo próprio paciente em casa. Registros mais
              recentes de cada tipo:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--text-muted)]">Pressão arterial</span>
                <span className="font-semibold text-[var(--text)]">{bp ? `${bp.systolic}/${bp.diastolic} mmHg · ${fmt(bp.measuredAt)}` : "sem registro"}</span>
              </li>
              <li className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--text-muted)]">Glicemia</span>
                <span className="font-semibold text-[var(--text)]">{glucose ? `${glucose.glucoseMgDl} mg/dL · ${fmt(glucose.measuredAt)}` : "sem registro"}</span>
              </li>
              <li className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--text-muted)]">Peso</span>
                <span className="font-semibold text-[var(--text)]">{weight ? `${String(weight.weightKg).replace(".", ",")} kg · ${fmt(weight.measuredAt)}` : "sem registro"}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--text-muted)]">Últimos sintomas</span>
                <span className="max-w-[60%] text-right font-semibold text-[var(--text)]">{sintomas[0]?.symptoms || "sem registro"}</span>
              </li>
            </ul>
          </div>
        )}

        {tab === "evolucao" && (
          <div className="space-y-4">
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Nova evolução / consulta
              </p>
              <NoteField label="Queixa / motivo" value={form.chiefComplaint} onChange={(v) => setForm((f) => ({ ...f, chiefComplaint: v }))} placeholder="Motivo da consulta / queixa principal" />
              <NoteField label="História e evolução" value={form.history} onChange={(v) => setForm((f) => ({ ...f, history: v }))} textarea placeholder="Evolução clínica, eventos desde a última consulta, exames..." />
              <NoteField label="Avaliação" value={form.assessment} onChange={(v) => setForm((f) => ({ ...f, assessment: v }))} textarea placeholder="Hipótese diagnóstica, estágio, problemas ativos..." />
              <NoteField label="Conduta e plano" value={form.plan} onChange={(v) => setForm((f) => ({ ...f, plan: v }))} textarea placeholder="Medicamentos, exames, orientações, retorno..." />

              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                Liberar um resumo desta evolução para o paciente ver
              </label>

              {saveErr && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{saveErr}</p>}
              {saveMsg && <p className="rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green)]">{saveMsg}</p>}

              <button type="button" className="btn-gold w-full" onClick={saveNote} disabled={saving}>
                {saving ? "Salvando…" : "Salvar evolução"}
              </button>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Evoluções anteriores</p>
            {notes.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma evolução registrada.</p>}
            {notes.map((n) => (
              <div key={n.id} className="panel space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text)]">{fmt(n.createdAt)} · {n.doctorName}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${n.sharedWithPatient ? "bg-[#eaf8f2] text-[#1c8c70]" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                    {n.sharedWithPatient ? "Liberada ao paciente" : "Interna"}
                  </span>
                </div>
                {n.chiefComplaint && <p className="text-sm text-[var(--text-soft)]"><b>Queixa:</b> {n.chiefComplaint}</p>}
                {n.history && <p className="text-sm text-[var(--text-soft)]"><b>História:</b> {n.history}</p>}
                {n.assessment && <p className="text-sm text-[var(--text-soft)]"><b>Avaliação:</b> {n.assessment}</p>}
                {n.plan && <p className="text-sm text-[var(--text-soft)]"><b>Conduta:</b> {n.plan}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "exames" && (
          <div className="space-y-4">
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Adicionar resultado de exame
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Exame</span>
                  <select className="input-field" value={labTest} onChange={(e) => setLabTest(e.target.value)}>
                    {NEPHRO_LABS.map((l) => (
                      <option key={l.key} value={l.key}>{l.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor ({labUnit(labTest)})</span>
                  <input inputMode="decimal" className="input-field" value={labValue} onChange={(e) => setLabValue(e.target.value)} placeholder="Ex.: 1,8" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data do exame</span>
                  <input type="date" className="input-field" value={labDate} onChange={(e) => setLabDate(e.target.value)} />
                </label>
              </div>
              {labErr && <p className="text-sm text-[var(--danger)]">{labErr}</p>}
              <button type="button" className="btn-gold" onClick={saveLab} disabled={labSaving || !labValue.trim()}>
                {labSaving ? "Salvando…" : "Adicionar exame"}
              </button>
            </div>

            {labKeys.length === 0 && <p className="text-[var(--text-muted)]">Nenhum exame registrado ainda.</p>}
            {labKeys.map((key) => {
              const series = labs.filter((l) => l.testKey === key);
              const last = series[series.length - 1];
              return (
                <div key={key} className="panel">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[var(--text)]">{labLabel(key)}</p>
                    <p className="text-sm text-[var(--gold)]">
                      Último: {String(last.value).replace(".", ",")} {labUnit(key)}
                    </p>
                  </div>
                  <LabChart points={series.map((s) => ({ x: s.measuredAt, y: s.value }))} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    {series.map((s) => (
                      <span key={s.id}>
                        {new Date(s.measuredAt).toLocaleDateString("pt-BR")}: <b className="text-[var(--text-soft)]">{String(s.value).replace(".", ",")}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-4">
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Emitir documento
              </p>
              <div className="flex gap-2">
                {(["receita", "exame", "relatorio"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDocType(t)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                      docType === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
                    }`}
                  >
                    {DOC_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <textarea
                className="input-field min-h-[140px]"
                value={docBody}
                onChange={(e) => setDocBody(e.target.value)}
                placeholder={
                  docType === "receita"
                    ? "Um medicamento por linha. Ex.:\nLosartana 50mg — 1 comprimido pela manhã\nDapagliflozina 10mg — 1 comprimido ao dia"
                    : docType === "exame"
                      ? "Um exame por linha. Ex.:\nCreatinina e ureia\nRelação albumina/creatinina (RAC)\nHemograma, potássio, HbA1c"
                      : "Escreva o relatório médico."
                }
              />
              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={docShared} onChange={(e) => setDocShared(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                Liberar para o paciente ver e baixar
              </label>
              {docErr && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{docErr}</p>}
              <button type="button" className="btn-gold w-full" onClick={saveDocument} disabled={docSaving || !docBody.trim()}>
                {docSaving ? "Emitindo…" : "Emitir e abrir PDF"}
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                O documento abre em uma página pronta para imprimir ou salvar em PDF.
              </p>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos emitidos</p>
            {documents.length === 0 && <p className="text-[var(--text-muted)]">Nenhum documento emitido.</p>}
            {documents.map((d) => (
              <a
                key={d.id}
                href={`/documento/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="panel flex items-center justify-between gap-3 transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">{d.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{DOC_TYPE_LABEL[d.type]} · {fmt(d.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--gold)]">Abrir PDF →</span>
              </a>
            ))}
          </div>
        )}

        {tab === "sinais" && (
          <div className="space-y-3">
            {sinais.length === 0 && <p className="text-[var(--text-muted)]">Nenhum sinal registrado em casa.</p>}
            {sinais.map((r) => (
              <div key={r.id} className="panel flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {r.kind === "bp" && `Pressão ${r.systolic}/${r.diastolic} mmHg${r.heartRate ? ` · FC ${r.heartRate}` : ""}`}
                    {r.kind === "glucose" && `Glicemia ${r.glucoseMgDl} mg/dL`}
                    {r.kind === "weight" && `Peso ${String(r.weightKg).replace(".", ",")} kg`}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {[r.glucoseContext, r.medContext, r.note].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{fmt(r.measuredAt)}</span>
              </div>
            ))}
            {sintomas.length > 0 && (
              <>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Sintomas relatados</p>
                {sintomas.map((r) => (
                  <div key={r.id} className="panel">
                    <p className="text-sm text-[var(--text)]">{r.symptoms}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{fmt(r.measuredAt)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "alimentacao" && (
          <div className="space-y-3">
            {food.length === 0 && <p className="text-[var(--text-muted)]">Nenhum alimento registrado.</p>}
            {food.map((f) => (
              <div key={f.id} className="panel flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{f.food}</p>
                  <p className="text-xs text-[var(--text-muted)]">{[f.meal, f.quantity].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{fmt(f.loggedAt)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "consultas" && (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="panel flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{formatSlotLabel(b.slotStart)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{REASON[b.careReason] || "Consulta"}</p>
                </div>
                {b.status === "confirmed" && (
                  <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold">
                    Entrar na sala
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LabChart({ points }: { points: { x: string; y: number }[] }) {
  if (points.length === 0) return null;
  const w = 480;
  const h = 120;
  const p = 22;
  const ys = points.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const n = points.length;
  const xAt = (i: number) => (n === 1 ? w / 2 : p + (i * (w - 2 * p)) / (n - 1));
  const yAt = (v: number) => h - p - ((v - min) / span) * (h - 2 * p);
  const path = points.map((d, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(d.y).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-28 w-full" preserveAspectRatio="none">
      {n > 1 && <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((d, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(d.y)} r="3.5" fill="white" stroke="var(--gold)" strokeWidth="2.5" />
      ))}
    </svg>
  );
}

function NoteField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{label}</span>
      {textarea ? (
        <textarea className="input-field min-h-[90px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className="input-field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-white p-3 text-center shadow-[var(--shadow)]">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{unit}</p>
    </div>
  );
}
