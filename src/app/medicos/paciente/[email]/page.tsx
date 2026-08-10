"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { NEPHRO_LABS, labLabel, labUnit } from "@/lib/labs";
import { LmeWizard } from "@/components/LmeWizard";
import { ClinicalProfileEditor } from "@/components/ClinicalProfileEditor";
import { ClinicalReviewModal } from "@/components/ClinicalReviewModal";
import { extractClinicalFields, type DetectedField } from "@/lib/clinical-extractor";
import { ExamReviewModal } from "@/components/ExamReviewModal";
import { parseLabsFromText } from "@/lib/lab-parser";
import { LogoUploader } from "@/components/LogoUploader";
import { TemplatePicker } from "@/components/TemplatePicker";
import { DocumentComposer } from "@/components/DocumentComposer";

type Lab = { id: string; testKey: string; value: number; unit?: string | null; measuredAt: string };
type Upload = { id: string; name: string; category?: string | null; examDate?: string | null; signedUrl?: string | null };
type Lme = { id: string; cid10?: string | null; createdAt: string; medications: { name: string }[] };

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
  type: string;
  title: string;
  sharedWithPatient: boolean;
  createdAt: string;
  hasPdf?: boolean;
};

const REASON: Record<string, string> = {
  pressa: "Com pressa",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "2ª opinião",
  outro: "Outro",
};

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "perfil", label: "Perfil clínico" },
  { id: "evolucao", label: "Evolução" },
  { id: "exames", label: "Exames" },
  { id: "enviados", label: "Enviados" },
  { id: "lme", label: "LME / CEAF" },
  { id: "documentos", label: "Documentos" },
  { id: "sinais", label: "Sinais em casa" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "consultas", label: "Consultas" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const DOC_TYPE_LABEL: Record<string, string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  relatorio: "Relatório",
  evolucao: "Evolução",
  parecer: "Parecer",
  atestado: "Atestado",
  declaracao: "Declaração",
  encaminhamento: "Encaminhamento",
  orientacao: "Orientações",
  livre: "Documento livre",
  pronto: "Arquivo pronto",
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
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [lmeList, setLmeList] = useState<Lme[]>([]);
  const [tab, setTab] = useState<Tab>("resumo");

  // Formulário de exame
  const [labTest, setLabTest] = useState<string>("creatinina");
  const [labValue, setLabValue] = useState("");
  const [labDate, setLabDate] = useState("");
  const [labSaving, setLabSaving] = useState(false);
  const [labErr, setLabErr] = useState("");

  // Agendamento pelo médico
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptSaving, setApptSaving] = useState(false);
  const [apptErr, setApptErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulário de evolução
  const [form, setForm] = useState({ chiefComplaint: "", history: "", assessment: "", plan: "" });
  const [review, setReview] = useState<{ labs: { testKey: string; value: number | string; unit?: string }[]; date?: string } | null>(null);
  const [clinicalReview, setClinicalReview] = useState<DetectedField[] | null>(null);
  const [shared, setShared] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // Formulário de documento (receita / exame / relatório)
  const [docSeed, setDocSeed] = useState<{ type: string; title: string; body: string } | null>(null);

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
    setUploads(data.uploads || []);
    setLmeList(data.lme || []);
    setLoading(false);
  }, [emailParam, router]);

  async function saveAppointment() {
    if (!apptDate || !apptTime) {
      setApptErr("Informe data e horário.");
      return;
    }
    setApptSaving(true);
    setApptErr("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotStart: `${apptDate}T${apptTime}:00`, careReason: "acompanhamento" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível agendar.");
      setApptDate("");
      setApptTime("");
      await load();
    } catch (e) {
      setApptErr(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setApptSaving(false);
    }
  }

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
      // Leitura automática: detecta exames E dados clínicos escritos na evolução.
      const evolutionText = [form.chiefComplaint, form.history, form.assessment, form.plan].filter(Boolean).join("\n");
      const detected = parseLabsFromText(evolutionText);
      const detectedClinical = extractClinicalFields(evolutionText);
      setForm({ chiefComplaint: "", history: "", assessment: "", plan: "" });
      setSaveMsg("Evolução salva no prontuário." + (shared ? " Liberada ao paciente." : ""));
      await load();
      if (detected.labs.length > 0) {
        setReview({ labs: detected.labs, date: detected.date });
      }
      if (detectedClinical.length > 0) {
        setClinicalReview(detectedClinical);
      }
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
              Informação registrada pelo paciente em casa (com data e horário). Não substitui evolução médica.
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

        {tab === "perfil" && <ClinicalProfileEditor emailParam={emailParam} />}

        {tab === "evolucao" && (
          <div className="space-y-4">
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Nova evolução / consulta
              </p>
              <TemplatePicker
                type="evolucao"
                currentText={form.history}
                onApply={(t) => setForm((f) => ({ ...f, history: t }))}
                patientName={patient?.name}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Evolução</span>
                <textarea
                  className="input-field min-h-[220px]"
                  value={form.history}
                  onChange={(e) => setForm((f) => ({ ...f, history: e.target.value }))}
                  placeholder="Escreva a evolução do jeito que preferir — texto livre."
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                Liberar um resumo desta evolução para o paciente ver
              </label>

              {saveErr && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{saveErr}</p>}
              {saveMsg && <p className="rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green)]">{saveMsg}</p>}

              <button type="button" className="btn-gold w-full" onClick={saveNote} disabled={saving}>
                {saving ? "Salvando…" : "Salvar evolução"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                disabled={!form.history.trim()}
                onClick={() => {
                  const text = [form.chiefComplaint, form.history, form.assessment, form.plan].filter(Boolean).join("\n\n");
                  setDocSeed({ type: "evolucao", title: "Evolução médica", body: text });
                  setTab("documentos");
                }}
              >
                Gerar PDF da evolução / Transformar em documento
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
                {n.history && <p className="whitespace-pre-wrap text-sm text-[var(--text-soft)]">{n.history}</p>}
                {n.assessment && <p className="text-sm text-[var(--text-soft)]"><b>Avaliação:</b> {n.assessment}</p>}
                {n.plan && <p className="text-sm text-[var(--text-soft)]"><b>Conduta:</b> {n.plan}</p>}
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--gold)]"
                  onClick={() => {
                    const text = [n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join("\n\n");
                    setDocSeed({ type: "relatorio", title: "Relatório a partir da evolução", body: text });
                    setTab("documentos");
                  }}
                >
                  Transformar em documento →
                </button>
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

        {tab === "enviados" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-soft)]">Exames e documentos enviados pelo paciente.</p>
            {uploads.length === 0 && <p className="text-[var(--text-muted)]">Nenhum arquivo enviado.</p>}
            {uploads.map((u) => (
              <div key={u.id} className="panel flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text)]">{u.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {[u.category, u.examDate ? new Date(u.examDate).toLocaleDateString("pt-BR") : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {u.signedUrl && (
                  <a href={u.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[var(--gold)]">
                    Abrir
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "lme" && (
          <div className="space-y-4">
            {/* Kit CEAF — checklist */}
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Kit CEAF — checklist</p>
              <ul className="mt-2 space-y-1 text-sm">
                <ChecklistItem ok={lmeList.length > 0} label="LME preenchida" />
                <ChecklistItem ok={documents.some((d) => d.type === "receita")} label="Receita médica" />
                <ChecklistItem ok={documents.some((d) => d.type === "relatorio")} label="Relatório médico" />
                <ChecklistItem ok={labs.length > 0} label="Exames laboratoriais lançados" />
                <ChecklistItem ok={uploads.length > 0} label="Documentos/exames anexados" />
              </ul>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                A liberação depende da análise do serviço responsável e dos critérios vigentes.
              </p>
            </div>

            {/* Assistente de LME em 8 etapas */}
            <LmeWizard emailParam={emailParam} patientName={patient?.name} onCreated={load} />

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">LMEs geradas</p>
            {lmeList.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma LME ainda.</p>}
            {lmeList.map((l) => (
              <a key={l.id} href={`/lme/${l.id}`} target="_blank" rel="noopener noreferrer" className="panel flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{l.medications.map((m) => m.name).join(", ") || "LME"}</p>
                  <p className="text-xs text-[var(--text-muted)]">CID {l.cid10 || "—"} · {fmt(l.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--gold)]">Abrir PDF →</span>
              </a>
            ))}
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-4">
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Identidade visual</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Logo pequena nos documentos legados. Para o receituário completo (PDF/imagem), use{" "}
                <a href="/medicos/configuracoes/documentos" className="font-semibold text-[var(--gold)]">
                  Meus Papéis Timbrados
                </a>
                .
              </p>
              <div className="mt-3">
                <LogoUploader />
              </div>
            </div>

            <DocumentComposer
              patientKey={emailParam}
              patientName={patient?.name}
              initialType={docSeed?.type || "receita"}
              initialTitle={docSeed?.title || ""}
              initialBody={docSeed?.body || ""}
              onSaved={() => {
                setDocSeed(null);
                load();
              }}
            />

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos no prontuário</p>
            {documents.length === 0 && <p className="text-[var(--text-muted)]">Nenhum documento emitido.</p>}
            {documents.map((d) => (
              <div key={d.id} className="panel flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{d.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {DOC_TYPE_LABEL[d.type] || d.type} · {fmt(d.createdAt)} ·{" "}
                    {d.sharedWithPatient ? "visível ao paciente" : "somente prontuário"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/documento/${d.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    Visualizar
                  </a>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      const action = d.sharedWithPatient ? "unshare" : "share";
                      if (action === "share" && !confirm("Este documento ficará disponível na área do paciente.")) return;
                      await fetch("/api/doctor/documents/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action, documentId: d.id }),
                      });
                      await load();
                    }}
                  >
                    {d.sharedWithPatient ? "Remover da área do paciente" : "Disponibilizar ao paciente"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "sinais" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-soft)]">
              Informação registrada pelo paciente — distinta da evolução profissional.
            </p>
            {sinais.length === 0 && <p className="text-[var(--text-muted)]">Nenhum sinal registrado em casa.</p>}
            {sinais.map((r) => (
              <div key={r.id} className="panel flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
                    Informação registrada pelo paciente
                  </p>
                  <p className="mt-1 font-semibold text-[var(--text)]">
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
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Sintomas relatados pelo paciente</p>
                {sintomas.map((r) => (
                  <div key={r.id} className="panel">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
                      Informação registrada pelo paciente
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">{r.symptoms}</p>
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
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Agendar consulta</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data</span>
                  <input type="date" className="input-field" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Horário</span>
                  <input type="time" className="input-field" value={apptTime} onChange={(e) => setApptTime(e.target.value)} />
                </label>
              </div>
              {apptErr && <p className="text-sm text-[var(--danger)]">{apptErr}</p>}
              <button type="button" className="btn-gold" onClick={saveAppointment} disabled={apptSaving}>
                {apptSaving ? "Agendando…" : "Agendar consulta"}
              </button>
            </div>
            {bookings.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma consulta ainda.</p>}
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

      {review && (
        <ExamReviewModal
          emailParam={emailParam}
          initialLabs={review.labs}
          initialDate={review.date}
          existingLabs={labs.map((l) => ({ testKey: l.testKey, measuredAt: l.measuredAt }))}
          source="evolução"
          onClose={() => setReview(null)}
          onSaved={async () => {
            await load();
            setTab("exames");
          }}
        />
      )}

      {/* Depois dos exames, confirma os dados clínicos detectados (perfil estruturado). */}
      {!review && clinicalReview && (
        <ClinicalReviewModal
          emailParam={emailParam}
          detected={clinicalReview}
          onClose={() => setClinicalReview(null)}
          onSaved={async () => { await load(); }}
        />
      )}
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${ok ? "bg-[#eaf8f2] text-[#1c8c70]" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
        {ok ? "✓" : "•"}
      </span>
      <span className={ok ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{label}</span>
    </li>
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

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-white p-3 text-center shadow-[var(--shadow)]">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{unit}</p>
    </div>
  );
}
