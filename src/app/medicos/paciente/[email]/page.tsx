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
import { parseLabGroups, type ParsedLabGroup } from "@/lib/lab-parser";
import { labCollisionDay, persistLabDate } from "@/lib/lab-dates";
import { TemplatePicker } from "@/components/TemplatePicker";
import { AttendanceControl } from "@/components/AttendanceControl";
import { ReturnPicker } from "@/components/ReturnPicker";
import { PatientLmeField } from "@/components/PatientCnsField";
import { PatientEditForm } from "@/components/PatientEditForm";
import { guessSexFromName } from "@/lib/sex-guess";
import { CareTeamPatientCard, CareTimeline } from "@/components/CareTeamPatientCard";
import { SharePatientWithDoctor } from "@/components/SharePatientWithDoctor";
import { PdModule } from "@/components/PdModule";
import { encodePatientParam, postJson, toFriendlyMessage } from "@/lib/user-errors";

type Lab = { id: string; testKey: string; value: number; unit?: string | null; measuredAt: string };
type Upload = { id: string; name: string; category?: string | null; examDate?: string | null; signedUrl?: string | null };
type Lme = { id: string; cid10?: string | null; createdAt: string; medications: { name: string }[] };

function sameLabValue(a: number, b: number) {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

/** Falta data ou já existe o mesmo exame na data com valor diferente → médico confere no modal. */
function groupsNeedReview(
  groups: ParsedLabGroup[],
  existing: { testKey: string; value: number; measuredAt: string }[]
): boolean {
  if (groups.some((g) => !g.date)) return true;
  for (const g of groups) {
    const day = g.date!;
    for (const lab of g.labs) {
      const hit = existing.find((l) => l.testKey === lab.testKey && labCollisionDay(l.measuredAt) === day);
      if (hit && !sameLabValue(hit.value, lab.value)) return true;
    }
  }
  return false;
}

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
type Patient = { email: string; name: string; city: string; phone: string; birthdate?: string | null; sex?: string | null; cns?: string | null; cpf?: string | null; motherName?: string | null; isCreated?: boolean };
type Note = {
  id: string;
  doctorName: string;
  doctorSpecialty?: string | null;
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
  { id: "evolucao", label: "Evolução clínica" },
  { id: "exames", label: "Exames" },
  { id: "resumo", label: "Resumo" },
  { id: "perfil", label: "Perfil clínico" },
  { id: "documentos", label: "Documentos" },
  { id: "lme", label: "LME / CEAF" },
  { id: "enviados", label: "Enviados" },
  { id: "sinais", label: "Sinais em casa" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "timeline", label: "Linha do tempo" },
  { id: "equipe", label: "Equipe assistente" },
  { id: "encaminhamentos", label: "Encaminhamentos" },
  { id: "consultas", label: "Consultas" },
  { id: "pesquisa", label: "Pesquisa" },
] as const;
type Tab = (typeof TABS)[number]["id"] | "dp";

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
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [lmeList, setLmeList] = useState<Lme[]>([]);
  const [tab, setTab] = useState<Tab>("evolucao");
  const [isPd, setIsPd] = useState(false);
  const [egfrInfo, setEgfrInfo] = useState("");
  useEffect(() => {
    fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/profile`).then((r) => r.json()).then((d) => {
      const v = d.profile?.dialise_peritoneal;
      setIsPd(v === true || v === "sim");
    }).catch(() => {});
  }, [emailParam]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TABS.some((x) => x.id === t) || t === "dp")) setTab(t as Tab);
  }, []);

  // Formulário de exame
  const [labTest, setLabTest] = useState<string>("creatinina");
  const [labValue, setLabValue] = useState("");
  const [labDate, setLabDate] = useState("");
  const [labSaving, setLabSaving] = useState(false);
  const [labErr, setLabErr] = useState("");

  // Importar exames de texto colado (laudo/prontuário antigo com várias datas)
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importSaving, setImportSaving] = useState(false);

  // Agendamento pelo médico
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptSaving, setApptSaving] = useState(false);
  const [apptErr, setApptErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulário de evolução
  const [form, setForm] = useState({ chiefComplaint: "", history: "", assessment: "", plan: "" });
  const [review, setReview] = useState<{ groups: ParsedLabGroup[]; source?: string } | null>(null);
  const [clinicalReview, setClinicalReview] = useState<DetectedField[] | null>(null);
  const [shared, setShared] = useState(true);
  const [editingPatient, setEditingPatient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // Formulário de documento (receita / exame / relatório)
  // Documentos usam o papel timbrado salvo (compositor). hasLetterhead controla a orientação.
  const [hasLetterhead, setHasLetterhead] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}`);
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
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/appointments`, {
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
      const data = await postJson<{ egfr?: { value?: number }; egfrSkipped?: string }>(
        `/api/doctor/patients/${encodePatientParam(emailParam)}/labs`,
        {
          testKey: labTest,
          value: labValue,
          measuredAt: labDate ? persistLabDate(labDate) : undefined,
        },
        "Não foi possível salvar o exame. Tente novamente."
      );
      // TFGe automática (CKD-EPI): confirma o cálculo ou avisa que falta idade/sexo.
      if (data.egfr && data.egfr.value != null) setEgfrInfo(`TFGe calculada automaticamente: ${String(data.egfr.value).replace(".", ",")} mL/min/1,73m² (CKD-EPI).`);
      else if (data.egfrSkipped) setEgfrInfo(data.egfrSkipped);
      else setEgfrInfo("");
      setLabValue("");
      setLabDate("");
      await load();
    } catch (e) {
      setLabErr(toFriendlyMessage(e, "Não foi possível salvar o exame. Tente novamente."));
    } finally {
      setLabSaving(false);
    }
  }

  async function tryAutoSaveLabs(
    groups: ParsedLabGroup[],
    source: string
  ): Promise<{ ok: true; count: number; duplicate: number } | { ok: false; reason: "review" | "empty" }> {
    const usable = groups.filter((g) => g.labs.length > 0);
    if (usable.length === 0) return { ok: false, reason: "empty" };
    if (groupsNeedReview(usable, labs)) return { ok: false, reason: "review" };

    const results = usable.flatMap((g) =>
      g.labs.map((l) => ({
        testKey: l.testKey,
        value: l.value,
        unit: l.unit,
        measuredAt: persistLabDate(g.date!),
      }))
    );

    try {
      const data = await postJson<{ count?: number; conflicts?: unknown[]; duplicate?: number }>(
        `/api/doctor/patients/${encodePatientParam(emailParam)}/labs`,
        { results, origin: source },
        "Não foi possível salvar os exames. Tente novamente."
      );
      if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
        return { ok: false, reason: "review" };
      }
      return {
        ok: true,
        count: typeof data.count === "number" ? data.count : results.length,
        duplicate: typeof data.duplicate === "number" ? data.duplicate : 0,
      };
    } catch (e) {
      console.error("[exames] auto-gravação", e);
      return { ok: false, reason: "review" };
    }
  }

  function examSaveSummary(count: number, duplicate: number, identified: number): string {
    if (count > 0) return `${count} exame(s) identificados e lançados no histórico.`;
    if (duplicate > 0) return "Os exames já estavam no histórico nesta data.";
    return `${identified} exame(s) identificados.`;
  }

  async function saveNote() {
    setSaving(true);
    setSaveErr("");
    setSaveMsg("");
    try {
      await postJson(
        `/api/doctor/patients/${encodePatientParam(emailParam)}/notes`,
        { ...form, sharedWithPatient: shared },
        "Não foi possível salvar a evolução. Tente novamente."
      );
      // Leitura automática: detecta exames (em VÁRIAS datas) E dados clínicos na evolução.
      const evolutionText = [form.chiefComplaint, form.history, form.assessment, form.plan].filter(Boolean).join("\n");
      const groups = parseLabGroups(evolutionText);
      const detectedClinical = extractClinicalFields(evolutionText);
      setForm({ chiefComplaint: "", history: "", assessment: "", plan: "" });
      let examNote = "";
      if (groups.length > 0) {
        const auto = await tryAutoSaveLabs(groups, "evolução");
        if (!auto.ok && auto.reason === "review") {
          setReview({ groups });
        } else if (auto.ok) {
          const identified = groups.reduce((n, g) => n + g.labs.length, 0);
          examNote = " " + examSaveSummary(auto.count, auto.duplicate, identified);
          setImportMsg(examSaveSummary(auto.count, auto.duplicate, identified));
          setTab("exames");
        }
      }
      setSaveMsg("Evolução salva no prontuário." + (shared ? " Liberada ao paciente." : "") + examNote);
      try {
        await load();
      } catch (reloadErr) {
        console.error("[evolucao] recarregar prontuário", reloadErr);
      }
      if (detectedClinical.length > 0) {
        setClinicalReview(detectedClinical);
      }
    } catch (e) {
      setSaveErr(toFriendlyMessage(e, "Não foi possível salvar a evolução. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  async function removeLme(id: string) {
    if (!window.confirm("Excluir esta LME? Esta ação não pode ser desfeita.")) return;
    const res = await fetch("/api/doctor/lme", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) await load();
    else window.alert("Não foi possível excluir a LME.");
  }

  async function removeDocument(id: string) {
    if (!window.confirm("Excluir este documento? Esta ação não pode ser desfeita.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else window.alert("Não foi possível excluir o documento.");
  }

  async function importFromText() {
    setImportErr("");
    setImportMsg("");
    const groups = parseLabGroups(importText);
    if (groups.length === 0) {
      setImportErr("Nenhum exame reconhecido no texto. Verifique se há nomes de exames e valores.");
      return;
    }
    setImportSaving(true);
    try {
      const auto = await tryAutoSaveLabs(groups, "importação (texto)");
      if (!auto.ok) {
        setReview({ groups, source: "importação (texto)" });
        setImportText("");
        return;
      }
      const identified = groups.reduce((n, g) => n + g.labs.length, 0);
      setImportMsg(examSaveSummary(auto.count, auto.duplicate, identified));
      setImportText("");
      try {
        await load();
      } catch (reloadErr) {
        console.error("[exames] recarregar após importação", reloadErr);
      }
    } finally {
      setImportSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/doctor/letterheads")
      .then((r) => r.json())
      .then((d) => setHasLetterhead(Array.isArray(d.letterheads) && d.letterheads.length > 0))
      .catch(() => setHasLetterhead(false));
  }, []);

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
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">{patient?.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {[patient?.city, patient?.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditingPatient((v) => !v)}>{editingPatient ? "Fechar edição" : "Editar dados"}</button>
          <ResetAccessButton emailParam={emailParam} />
        </div>
      </div>

      {editingPatient && patient && (
        <PatientEditForm
          emailParam={emailParam}
          patient={{ name: patient.name, phone: patient.phone, email: patient.email, city: patient.city, birthdate: patient.birthdate, sex: patient.sex }}
          onClose={() => setEditingPatient(false)}
          onSaved={load}
        />
      )}

      <div className="mt-3">
        <AttendanceControl patientKey={emailParam} />
      </div>

      <SharePatientWithDoctor emailParam={emailParam} patientName={patient?.name} />
      <CareTeamPatientCard emailParam={emailParam} />

      {/* Cabeçalho clínico */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="PA (casa)" value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"} unit={bp ? "mmHg" : ""} />
        <Metric label="Glicemia" value={glucose ? String(glucose.glucoseMgDl) : "—"} unit={glucose ? "mg/dL" : ""} />
        <Metric label="Peso" value={weight ? String(weight.weightKg).replace(".", ",") : "—"} unit={weight ? "kg" : ""} />
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {[...TABS, ...(isPd ? [{ id: "dp" as const, label: "Diálise peritoneal" }] : [])].map((t) => (
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
                  placeholder={"Escreva a evolução do jeito que preferir.\n\nPode colar exames assim:\n21/08/2026\nCR: 3,51\nU: 94\nK: 5,8"}
                />
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                Data em cima, exames embaixo: o sistema identifica e já lança no histórico. Só pede conferência se faltar a data ou se o mesmo exame já existir naquela data com outro valor.
              </p>

              <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                Liberar um resumo desta evolução para o paciente ver
              </label>

              {saveErr && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{saveErr}</p>}
              {saveMsg && <p className="rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green)]">{saveMsg}</p>}

              <button type="button" className="btn-gold w-full" onClick={saveNote} disabled={saving}>
                {saving ? "Salvando…" : "Salvar evolução"}
              </button>

              <ReturnPicker patientKey={emailParam} />
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Evoluções anteriores</p>
            <p className="text-xs text-[var(--text-muted)]">Cada médico assina a própria evolução. O texto já registrado por outro profissional não pode ser alterado.</p>
            {notes.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma evolução registrada.</p>}
            {notes.map((n) => (
              <div key={n.id} className="panel space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                      {new Date(n.createdAt).toLocaleDateString("pt-BR")} — {n.doctorSpecialty || "Medicina"}
                    </p>
                    <p className="text-sm font-semibold text-[var(--text)]">{n.doctorName} · {fmt(n.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${n.sharedWithPatient ? "bg-[#eaf8f2] text-[#1c8c70]" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                    {n.sharedWithPatient ? "Liberada ao paciente" : "Interna"}
                  </span>
                </div>
                {n.chiefComplaint && <p className="text-sm text-[var(--text-soft)]"><b>Queixa:</b> {n.chiefComplaint}</p>}
                {n.history && <p className="whitespace-pre-wrap text-sm text-[var(--text-soft)]">{n.history}</p>}
                {n.assessment && <p className="text-sm text-[var(--text-soft)]"><b>Avaliação:</b> {n.assessment}</p>}
                {n.plan && <p className="text-sm text-[var(--text-soft)]"><b>Conduta:</b> {n.plan}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "exames" && (
          <div className="space-y-4">
            <EgfrReadinessBanner emailParam={emailParam} birthdate={patient?.birthdate} sex={patient?.sex} patientName={patient?.name} onFixed={load} />
            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Adicionar resultado de exame
              </p>
              <p className="text-xs text-[var(--text-muted)]">Ao lançar a <b>creatinina</b> (ou <b>cistatina C</b>), a <b>TFGe é calculada automaticamente</b> (CKD‑EPI) e entra no gráfico.</p>
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
              {egfrInfo && <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">{egfrInfo}</p>}
              <button type="button" className="btn-gold" onClick={saveLab} disabled={labSaving || !labValue.trim()}>
                {labSaving ? "Salvando…" : "Adicionar exame"}
              </button>
            </div>

            <div className="panel space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Importar exames de texto (várias datas)
              </p>
              <p className="text-sm text-[var(--text-soft)]">
                Cole um laudo com a <b>data em cima</b> e os exames embaixo (pode ter várias datas). O sistema
                identifica e já lança no histórico — só pede conferência se faltar data ou houver conflito.
              </p>
              <textarea
                className="input-field min-h-[120px] font-mono text-[13px]"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"Ex.:\n21/08/2026\nCR: 3,51\nU: 94\nK: 5,8\nNA: 141\nTFGE: 19\n\n17/07/2026\nHB: 12\nHT: 37\nLeuco: 14840\nPlaqueta: 375 mil\nCR: 2,99"}
              />
              {importErr && <p className="text-sm text-[var(--danger)]">{importErr}</p>}
              {importMsg && <p className="rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green)]">{importMsg}</p>}
              <button type="button" className="btn-ghost" onClick={importFromText} disabled={!importText.trim() || importSaving}>
                {importSaving ? "Salvando…" : "Identificar e salvar exames"}
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
            {/* Dados da LME (CNS e Nome da mãe) — avisam quando faltam; auto-preenchem a LME. */}
            <PatientLmeField emailParam={emailParam} field="cns" label="CNS (Cartão SUS)" value={patient?.cns} numeric placeholder="000 0000 0000 0000" note="Necessário para a LME/CEAF. Se este paciente precisar, cadastre agora — senão, pode deixar em branco." onSaved={load} />
            <PatientLmeField emailParam={emailParam} field="motherName" label="Nome da mãe" value={patient?.motherName} placeholder="Nome completo da mãe" note="Aparece no formulário oficial da LME. Cadastre para já sair preenchido nas próximas LMEs." onSaved={load} />

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
              <div key={l.id} className="panel flex items-center justify-between gap-3">
                <a href={`/lme/${l.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text)]">{l.medications.map((m) => m.name).join(", ") || "LME"}</p>
                  <p className="text-xs text-[var(--text-muted)]">CID {l.cid10 || "—"} · {fmt(l.createdAt)}</p>
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <a href={`/lme/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--gold)]">Abrir PDF →</a>
                  <button type="button" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => removeLme(l.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-4">
            {hasLetterhead === false ? (
              <div className="panel border-[var(--border-gold)] bg-[var(--gold-soft)]">
                <p className="font-semibold text-[var(--text)]">Adicione seu papel timbrado</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Os documentos (receita, relatório, atestado, pedido de exame, encaminhamento) são emitidos sobre o seu
                  papel timbrado — um só, que serve para tudo. Envie o seu receituário uma vez em Configurações.
                </p>
                <Link href="/medicos/configuracoes/documentos" className="btn-gold mt-3 inline-block">Adicionar papel timbrado →</Link>
              </div>
            ) : (
              <div className="panel flex flex-wrap items-center justify-between gap-2 border-[var(--border-gold)] bg-[var(--gold-soft)]">
                <div>
                  <p className="font-semibold text-[var(--text)]">Novo documento com seu papel timbrado</p>
                  <p className="text-sm text-[var(--text-muted)]">Receita, relatório, atestado, encaminhamento, pedido de exame ou documento livre — em PDF sobre o seu receituário salvo.</p>
                </div>
                <Link href={`/medicos/paciente/${emailParam}/documento`} className="btn-gold">Abrir compositor →</Link>
              </div>
            )}
            {hasLetterhead !== false && (
              <p className="text-xs text-[var(--text-muted)]">
                Gerencie seus papéis timbrados em{" "}
                <Link href="/medicos/configuracoes/documentos" className="font-semibold text-[var(--gold)]">Configurações › Papéis timbrados</Link>.
              </p>
            )}

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos emitidos</p>
            {documents.length === 0 && <p className="text-[var(--text-muted)]">Nenhum documento emitido.</p>}
            {documents.map((d) => (
              <div
                key={d.id}
                className="panel flex items-center justify-between gap-3 transition hover:border-[var(--border-gold)]"
              >
                <a href={`/documento/${d.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text)]">{d.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{DOC_TYPE_LABEL[d.type]} · {fmt(d.createdAt)}</p>
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <a href={`/documento/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--gold)]">Abrir PDF →</a>
                  <button type="button" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => removeDocument(d.id)}>Excluir</button>
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
            <NutritionReferralBox emailParam={emailParam} />
            <DoctorNutritionView emailParam={emailParam} />
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Diário alimentar do paciente</p>
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

        {tab === "timeline" && <CareTimeline emailParam={emailParam} />}

        {tab === "equipe" && (
          <div className="space-y-3">
            <SharePatientWithDoctor emailParam={emailParam} patientName={patient?.name} />
            <CareTeamPatientCard emailParam={emailParam} />
          </div>
        )}

        {tab === "encaminhamentos" && (
          <SharePatientWithDoctor emailParam={emailParam} patientName={patient?.name} />
        )}

        {tab === "dp" && isPd && (
          <PdModule
            patientKey={emailParam}
            labs={labs.map((l) => ({ key: l.testKey, label: labLabel(l.testKey), value: l.value, unit: l.unit || labUnit(l.testKey), measuredAt: l.measuredAt }))}
          />
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

        {tab === "pesquisa" && <ResearchTab emailParam={emailParam} patientName={patient?.name || ""} />}
      </div>

      {review && (
        <ExamReviewModal
          emailParam={emailParam}
          groups={review.groups}
          existingLabs={labs.map((l) => ({ testKey: l.testKey, measuredAt: l.measuredAt }))}
          source={review.source || "evolução"}
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

const RESEARCH_CASE_CATS: { key: string; label: string }[] = [
  { key: "relato", label: "Possível relato de caso" },
  { key: "serie", label: "Série de casos" },
  { key: "raro", label: "Caso raro" },
  { key: "discussao", label: "Caso para discussão" },
  { key: "aula", label: "Caso para aula" },
  { key: "artigo", label: "Caso para artigo" },
  { key: "congresso", label: "Caso para congresso" },
  { key: "longitudinal", label: "Acompanhamento longitudinal" },
  { key: "pesquisa", label: "Possível inclusão em pesquisa" },
];

function ResearchTab({ emailParam, patientName }: { emailParam: string; patientName: string }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/research`)
      .then((r) => r.json())
      .then((d) => {
        if (d.case) { setCategories(d.case.categories || []); setNote(d.case.note || ""); }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [emailParam]);

  function toggle(cat: string) {
    setCategories((cs) => (cs.includes(cat) ? cs.filter((c) => c !== cat) : [...cs, cat]));
  }
  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/research`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, note, patientName }),
      });
      setMsg(res.ok ? "Salvo. Aparece em Pesquisa Científica › Casos interessantes." : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const marked = categories.length > 0 || note.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">⭐ Marcar caso interessante</p>
          {marked && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Marcado</span>}
        </div>
        <p className="text-sm text-[var(--text-soft)]">Classifique este caso para estudo. Só você vê estas informações — o paciente não tem acesso.</p>
        <div className="flex flex-wrap gap-1.5">
          {RESEARCH_CASE_CATS.map((c) => {
            const on = categories.includes(c.key);
            return (
              <button key={c.key} type="button" onClick={() => toggle(c.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
                {c.label}
              </button>
            );
          })}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Anotação científica (privada)</span>
          <textarea className="input-field min-h-[100px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Possível MGRS com imunofixação urinária positiva e sérica negativa. Aguardar biópsia renal." disabled={!loaded} />
        </label>
        {msg && <p className="text-sm font-semibold text-[var(--gold)]">{msg}</p>}
        <button type="button" className="btn-gold" onClick={save} disabled={saving || !loaded}>{saving ? "Salvando…" : "Salvar marcação"}</button>
      </div>

      <div className="panel">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Atalhos de pesquisa</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={`/medicos/paciente/${emailParam}/relato`} className="btn-ghost text-sm">Criar relato de caso + linha do tempo</Link>
          <Link href="/medicos/pesquisa/estudos" className="btn-ghost text-sm">Criar / abrir estudo</Link>
          <Link href="/medicos/pesquisa/casos" className="btn-ghost text-sm">Casos interessantes</Link>
          <Link href="/medicos/pesquisa" className="btn-ghost text-sm">Central de pesquisa</Link>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Os dados usados em pesquisa são anonimizados e separados do prontuário identificável.</p>
      </div>
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

function EgfrReadinessBanner({ emailParam, birthdate, sex, patientName, onFixed }: { emailParam: string; birthdate?: string | null; sex?: string | null; patientName?: string | null; onFixed: () => Promise<void> | void }) {
  const hasBirth = Boolean(birthdate);
  const hasSex = Boolean(sex && /^(m|masc|homem|f|fem|mulher)/i.test(String(sex)));
  const [bd, setBd] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const guessed = guessSexFromName(patientName);
  if (hasBirth && hasSex) return null;

  // Idade -> data de nascimento aproximada (1º de julho do ano estimado).
  function birthdateFromAge(age: number): string {
    const y = new Date().getFullYear() - Math.round(age);
    return `${y}-07-01`;
  }

  async function saveDemographics(patch: { sex?: string; birthdate?: string }) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/demographics`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Erro"); }
      // Recalcula a TFGe para creatinina/cistatina já lançadas.
      await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/labs/recompute-egfr`, { method: "POST" });
      setMsg("Dados salvos. TFGe recalculada quando havia creatinina.");
      await onFixed();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel border-[var(--warn)]/40 bg-[#fff7e8]">
      <p className="text-sm font-semibold text-[#7a5a12]">Para calcular a TFGe automaticamente, informe idade e sexo</p>
      <p className="mt-1 text-xs text-[#7a5a12]">A equação CKD‑EPI usa idade e sexo. Complete abaixo — vale para creatinina e cistatina C.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {!hasBirth && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de nascimento</span>
              <div className="flex items-center gap-2">
                <input type="date" className="input-field" value={bd} onChange={(e) => setBd(e.target.value)} />
                <button type="button" className="btn-ghost text-sm" disabled={busy || !bd} onClick={() => saveDemographics({ birthdate: bd })}>Salvar</button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">…ou só a idade (anos)</span>
              <div className="flex items-center gap-2">
                <input inputMode="numeric" className="input-field w-24" value={ageInput} onChange={(e) => setAgeInput(e.target.value)} placeholder="Ex.: 62" />
                <button type="button" className="btn-ghost text-sm" disabled={busy || !ageInput} onClick={() => { const a = Number(ageInput); if (a > 0 && a < 130) saveDemographics({ birthdate: birthdateFromAge(a) }); }}>Usar idade</button>
              </div>
            </label>
          </>
        )}
        {!hasSex && (
          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Sexo{guessed ? ` · provável: ${guessed === "feminino" ? "Feminino" : "Masculino"}` : ""}</span>
            <div className="flex gap-2">
              <button type="button" className={`btn-ghost text-sm ${guessed === "feminino" ? "border-[var(--gold)] text-[var(--gold)]" : ""}`} disabled={busy} onClick={() => saveDemographics({ sex: "feminino" })}>Feminino</button>
              <button type="button" className={`btn-ghost text-sm ${guessed === "masculino" ? "border-[var(--gold)] text-[var(--gold)]" : ""}`} disabled={busy} onClick={() => saveDemographics({ sex: "masculino" })}>Masculino</button>
            </div>
          </div>
        )}
      </div>
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
    </div>
  );
}

function ResetAccessButton({ emailParam }: { emailParam: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function reset() {
    if (!window.confirm("Redefinir o acesso deste paciente para a senha 123456? No próximo login, ele criará uma nova senha.")) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/reset-access`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setMsg("Acesso redefinido para 123456.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); setTimeout(() => setMsg(""), 3000); }
  }
  return (
    <div className="text-right">
      <button type="button" className="btn-ghost text-xs" onClick={reset} disabled={busy} title="Redefinir senha do paciente para 123456">
        {busy ? "Redefinindo…" : "Redefinir acesso"}
      </button>
      {msg && <p className="mt-1 text-[11px] font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
    </div>
  );
}

function NutritionReferralBox({ emailParam }: { emailParam: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reason: "", objective: "", restrictions: "", priority: "normal", notes: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/nutrition-referral`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setMsg("Encaminhado para a nutrição. Aparecerá no painel da nutricionista vinculada.");
      setForm({ reason: "", objective: "", restrictions: "", priority: "normal", notes: "" });
      setOpen(false);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="panel border-[var(--border-gold)] bg-[var(--gold-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text)]">Encaminhar para Nutrição</p>
          <p className="text-sm text-[var(--text-muted)]">Envie este paciente à sua equipe de nutrição (configure em Mais › Equipe de Nutrição).</p>
        </div>
        <button type="button" className="btn-gold" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Encaminhar"}</button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo</span><input className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: DRC em tratamento conservador; hipercalemia" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Objetivo nutricional</span><input className="input-field" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ex.: controle de potássio e sódio" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Prioridade</span>
            <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option><option value="alta">Alta</option>
            </select>
          </label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Restrições / cuidados</span><input className="input-field" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observações clínicas</span><textarea className="input-field min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={send} disabled={saving}>{saving ? "Enviando…" : "Confirmar encaminhamento"}</button></div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}

const NUT_LIGHT_DOT: Record<string, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-500", vermelho: "bg-red-500", estimativa: "bg-slate-400" };

function DoctorNutritionView({ emailParam }: { emailParam: string }) {
  const [data, setData] = useState<{
    goals: { targets: Record<string, number | null>; note?: string | null; nutritionistName?: string | null } | null;
    tracksToday: { key: string; label: string; unit: string; total: number; goal: number | null; status: string }[];
    entriesToday: number;
    consultations: { id: string; createdAt: string; nutritionistName?: string | null; documentId?: string | null }[];
    timeline?: { at: string; type: string; label: string; by?: string | null }[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/nutrition`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, [emailParam]);

  if (!data) return null;
  const hasAny = data.goals || data.consultations.length > 0 || data.entriesToday > 0;
  if (!hasAny) return null;

  return (
    <div className="panel">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nutrição (acompanhamento — somente leitura)</p>
      {data.goals && (
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Metas definidas{data.goals.nutritionistName ? ` por ${data.goals.nutritionistName}` : ""}.
          {data.goals.note ? ` Orientação: ${data.goals.note}` : ""}
        </p>
      )}
      {data.entriesToday > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.tracksToday.map((t) => (
            <div key={t.key} className="rounded-xl border border-[var(--border)] p-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${NUT_LIGHT_DOT[t.status]}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t.label}</span>
              </div>
              <p className="text-sm font-bold text-[var(--text)]">{t.total} {t.unit}{t.goal != null ? <span className="text-xs font-normal text-[var(--text-muted)]"> / {t.goal}</span> : null}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-[var(--text-muted)]">Sem registros do paciente hoje.</p>
      )}
      {data.timeline && data.timeline.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Linha do tempo</p>
          <ul className="mt-1 space-y-1">
            {data.timeline.slice(0, 8).map((ev, i) => (
              <li key={i} className="text-xs text-[var(--text-soft)]">
                <span className="text-[var(--text-muted)]">{new Date(ev.at).toLocaleDateString("pt-BR")}</span> · {ev.label}{ev.by ? ` — ${ev.by}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">A conduta nutricional é responsabilidade da nutricionista. Esta visão é apenas para acompanhamento.</p>
    </div>
  );
}
