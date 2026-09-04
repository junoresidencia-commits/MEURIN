"use client";

import { useEffect, useMemo, useState } from "react";
import { CEAF_PROTOCOLS, getProtocol } from "@/lib/ceaf-catalog";
import { encodePatientParam } from "@/lib/user-errors";

const STEPS = ["Paciente", "Protocolo", "Medicamento", "CID / Diagnóstico", "Dose", "Exames", "Justificativa", "Revisão"];

type ExamCheck = {
  label: string; testKey?: string; required: boolean; validityDays: number; autoCheck: boolean;
  status: "valido" | "vencido" | "ausente" | "anexar"; value?: number; unit?: string | null; measuredAt?: string; ageDays?: number; note?: string;
};

/**
 * Assistente de LME/CEAF baseado no CATÁLOGO OFICIAL (SESAB/BA).
 * Protocolo → medicamentos oficiais → CID permitido do protocolo → exames com validade
 * conferida no prontuário. Não permite CID/medicamento fora do protocolo (anti-devolução).
 */
export function LmeWizard({ emailParam, patientName, onCreated }: { emailParam: string; patientName?: string; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [protocolId, setProtocolId] = useState("");
  const [medIds, setMedIds] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [cid, setCid] = useState("");
  const [form, setForm] = useState({ weightKg: "", heightCm: "", diagnosis: "", posologia: "", justificativa: "" });
  const [alsoReceita, setAlsoReceita] = useState(true);
  const [alsoRelatorio, setAlsoRelatorio] = useState(true);
  const [locations, setLocations] = useState<{ id: string; name: string; city: string; cnes?: string }[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [doctorInfo, setDoctorInfo] = useState<{ name: string; crm: string }>({ name: "", crm: "" });
  const [exams, setExams] = useState<ExamCheck[] | null>(null);
  const [examsLoading, setExamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const protocol = getProtocol(protocolId);
  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => {
    fetch("/api/doctor/locations").then((r) => r.json()).then((d) => {
      const list = (d.locations || []).filter((l: { active: boolean }) => l.active);
      setLocations(list);
      if (list[0]) setEstablishmentId(list[0].id);
    }).catch(() => {});
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (d?.doctor) setDoctorInfo({ name: d.doctor.name || "", crm: [d.doctor.crm, d.doctor.crmState].filter(Boolean).join("-") });
    }).catch(() => {});
  }, []);
  const establishment = locations.find((l) => l.id === establishmentId);

  function chooseProtocol(id: string) {
    setProtocolId(id);
    setMedIds([]); setQty({}); setCid(""); setExams(null);
  }
  function toggleMed(id: string) {
    setMedIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    setExams(null);
  }

  // Confere exames ao entrar na etapa de Exames (ou quando muda protocolo/medicamentos).
  useEffect(() => {
    if (step !== 5 || !protocolId || medIds.length === 0) return;
    setExamsLoading(true);
    fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/ceaf-check`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocolId, medIds }),
    })
      .then((r) => r.json())
      .then((d) => setExams(d.exams || []))
      .catch(() => setExams([]))
      .finally(() => setExamsLoading(false));
  }, [step, protocolId, medIds, emailParam]);

  // Apenas LEMBRETE — os exames não bloqueiam a geração (o paciente leva impressos e anexa).
  const missingExams = useMemo(() => (exams || []).filter((e) => e.required && e.autoCheck && (e.status === "ausente" || e.status === "vencido")), [exams]);

  const canAdvance = useMemo(() => {
    if (step === 1) return Boolean(protocolId);
    if (step === 2) return medIds.length > 0;
    if (step === 3) return Boolean(cid);
    return true;
  }, [step, protocolId, medIds, cid]);

  const selectedMeds = useMemo(() => (protocol?.medications || []).filter((m) => medIds.includes(m.id)), [protocol, medIds]);

  async function finish() {
    if (!protocol) return;
    if (!protocol.cids.some((c) => c.code === cid)) { setError("O CID selecionado não pertence a este protocolo."); return; }
    setSaving(true); setError("");
    try {
      const medications = selectedMeds.map((m) => ({ name: m.name, presentation: m.presentation, monthlyQty: qty[m.id] || "" }));
      const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/lme`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: form.weightKg || undefined, heightCm: form.heightCm || undefined, cid10: cid, diagnosis: form.diagnosis, anamnesis: form.justificativa, medications, establishmentName: establishment?.name, cnes: establishment?.cnes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar a LME.");
      if (alsoReceita) {
        const body = selectedMeds.map((m) => `${m.name} (${m.presentation}) — ${form.posologia || qty[m.id] || ""}`.trim()).join("\n");
        if (body) await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "receita", body, sharedWithPatient: false }) });
      }
      if (alsoRelatorio) {
        const cidObj = protocol.cids.find((c) => c.code === cid);
        const examesTexto = (exams || []).map((e) => e.label).join("; ");
        const relatorio = [
          `RELATÓRIO MÉDICO — CEAF/SESAB`,
          `Protocolo: ${protocol.name} (${protocol.source})`,
          `Paciente: ${patientName || "—"}`,
          `CID-10: ${cid}${cidObj ? " — " + cidObj.description : ""}`,
          form.diagnosis ? `Diagnóstico: ${form.diagnosis}` : "",
          "",
          `Medicamento(s) solicitado(s): ${selectedMeds.map((m) => `${m.name} (${m.presentation})${qty[m.id] ? " — " + qty[m.id] + "/mês" : ""}`).join("; ")}`,
          "",
          `História clínica e justificativa:`,
          form.justificativa || "(a completar)",
          "",
          examesTexto ? `Exames que acompanham o processo (o paciente leva impressos e anexa): ${examesTexto}` : "",
          "",
          `Declaro que o(a) paciente preenche os critérios do PCDT/SESAB para o(s) medicamento(s) solicitado(s).`,
        ].filter((l) => l !== "").join("\n");
        await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "relatorio", title: `Relatório médico — ${protocol.name}`, body: relatorio, sharedWithPatient: false }) });
      }
      await onCreated();
      if (data.id) window.open(`/lme/${data.id}`, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setSaving(false); }
  }

  return (
    <div className="panel space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i <= step ? "bg-[var(--gold)] text-white" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>{i + 1}</span>
            {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 w-4 ${i < step ? "bg-[var(--gold)]" : "bg-[var(--border)]"}`} />}
          </div>
        ))}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Etapa {step + 1} de 8 — {STEPS[step]}</p>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-soft)]">Paciente: <strong className="text-[var(--text)]">{patientName || "—"}</strong>. Confira/complete (opcional).</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (kg)" value={form.weightKg} onChange={(v) => set("weightKg", v)} />
            <Field label="Altura (cm)" value={form.heightCm} onChange={(v) => set("heightCm", v)} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Estabelecimento solicitante (CNES)</span>
            <select className="input-field" value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)}>
              <option value="">Selecione o local</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.cnes ? ` — CNES ${l.cnes}` : " — (sem CNES)"}</option>)}
            </select>
            {establishment && !establishment.cnes && <span className="mt-1 block text-xs text-amber-700">Este local está sem CNES. Cadastre em Configurar agenda → Locais.</span>}
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-soft)]">Escolha o protocolo oficial (SESAB/BA). Só aparecem CIDs e medicamentos oficiais daquele protocolo.</p>
          <div className="grid gap-2">
            {CEAF_PROTOCOLS.map((p) => (
              <button key={p.id} type="button" onClick={() => chooseProtocol(p.id)} className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${protocolId === p.id ? "border-[var(--gold)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}>
                <span className="block font-semibold text-[var(--text)]">{p.name}</span>
                <span className="block text-xs text-[var(--text-muted)]">{p.cids.map((c) => c.code).join(", ")} · {p.medications.length} medicamento(s) · Fonte: {p.source} · conferido em {new Date(p.lastReview).toLocaleDateString("pt-BR")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && protocol && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-soft)]">Selecione o(s) medicamento(s) oficiais e a quantidade mensal.</p>
          <div className="grid gap-2">
            {protocol.medications.map((m) => (
              <div key={m.id} className={`rounded-xl border px-3 py-2 ${medIds.includes(m.id) ? "border-[var(--gold)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={medIds.includes(m.id)} onChange={() => toggleMed(m.id)} />
                  <span className="text-sm font-semibold text-[var(--text)]">{m.name} <span className="font-normal text-[var(--text-muted)]">· {m.presentation}</span></span>
                </label>
                {medIds.includes(m.id) && (
                  <div className="mt-2 pl-6">
                    <input className="input-field w-40" placeholder="Qtde/mês" value={qty[m.id] || ""} onChange={(e) => setQty((q) => ({ ...q, [m.id]: e.target.value }))} />
                    {m.note && <p className="mt-1 text-xs text-amber-700">{m.note}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && protocol && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CID-10 (somente os do protocolo)</span>
            <select className="input-field" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">Selecione o CID</option>
              {protocol.cids.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.description}</option>)}
            </select>
          </label>
          <Field label="Diagnóstico" value={form.diagnosis} onChange={(v) => set("diagnosis", v)} />
          <p className="text-xs text-[var(--text-muted)]">Não é possível digitar um CID livre — evita devolução por CID fora do protocolo.</p>
        </div>
      )}

      {step === 4 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Dose e posologia</span>
          <textarea className="input-field min-h-[100px]" value={form.posologia} onChange={(e) => set("posologia", e.target.value)} placeholder="Ex.: 4.000 UI SC 3x/semana. Confirme a quantidade mensal de cada medicamento na etapa de medicamentos." />
        </label>
      )}

      {step === 5 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-soft)]">Exames do protocolo — apenas um <b>lembrete</b>. O paciente leva os exames impressos e anexa ao processo; não é preciso cadastrá-los aqui para gerar a LME.</p>
          {examsLoading && <p className="text-sm text-[var(--text-muted)]">Conferindo exames…</p>}
          <div className="grid gap-1.5">
            {(exams || []).map((e, i) => (
              <div key={i} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${e.status === "valido" ? "border-emerald-300 bg-emerald-50" : e.status === "anexar" ? "border-[var(--border)]" : "border-amber-300 bg-amber-50"}`}>
                <span className="text-[var(--text)]">{e.label}{e.note ? <span className="block text-xs text-[var(--text-muted)]">{e.note}</span> : null}</span>
                <span className="text-xs font-semibold">
                  {e.status === "valido" && <span className="text-emerald-700">✅ válido {e.measuredAt ? `(${new Date(e.measuredAt).toLocaleDateString("pt-BR")})` : ""}</span>}
                  {e.status === "vencido" && <span className="text-amber-700">🔴 vencido{typeof e.ageDays === "number" ? ` (há ${e.ageDays}d)` : ""}</span>}
                  {e.status === "ausente" && <span className="text-amber-700">🔴 ausente</span>}
                  {e.status === "anexar" && <span className="text-[var(--text-muted)]">📎 anexar</span>}
                </span>
              </div>
            ))}
          </div>
          {missingExams.length > 0 && (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-3 py-2 text-sm text-[var(--text-soft)]">
              📎 Lembrete: leve/anexe impressos — {missingExams.map((e) => e.label).join(", ")}. Isso <b>não bloqueia</b> a geração da LME.
            </p>
          )}
        </div>
      )}

      {step === 6 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Justificativa clínica</span>
          <textarea className="input-field min-h-[140px]" value={form.justificativa} onChange={(e) => set("justificativa", e.target.value)} placeholder="Justificativa clínica (texto livre)." />
        </label>
      )}

      {step === 7 && protocol && (
        <div className="space-y-2 text-sm">
          <p className="text-[var(--text-soft)]"><b>Protocolo:</b> {protocol.name} <span className="text-xs text-[var(--text-muted)]">({protocol.source}, conferido {new Date(protocol.lastReview).toLocaleDateString("pt-BR")})</span></p>
          <p className="text-[var(--text-soft)]"><b>CID:</b> {cid || "—"} · <b>Diagnóstico:</b> {form.diagnosis || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Medicamentos:</b> {selectedMeds.map((m) => `${m.name} (${m.presentation})${qty[m.id] ? " — " + qty[m.id] + "/mês" : ""}`).join("; ") || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Documentos:</b> {protocol.documents.join("; ")}</p>
          {missingExams.length > 0 && <p className="text-[var(--text-muted)]">📎 Lembrete (não bloqueia): leve/anexe impressos — {missingExams.map((e) => e.label).join(", ")}.</p>}
          <label className="mt-2 flex items-center gap-2 text-[var(--text-soft)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={alsoReceita} onChange={(e) => setAlsoReceita(e.target.checked)} />
            Gerar também a receita dos medicamentos (mesmos dados da LME)
          </label>
          <label className="flex items-center gap-2 text-[var(--text-soft)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={alsoRelatorio} onChange={(e) => setAlsoRelatorio(e.target.checked)} />
            Gerar também o relatório médico (documento no prontuário)
          </label>
          <div className="mt-2 rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos oficiais SESAB (páginas exatas — sem redesenho)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="btn-ghost text-sm" href={`/api/ceaf/official?protocol=${protocol.id}&doc=ter&name=${encodeURIComponent(patientName || "")}&doctor=${encodeURIComponent(doctorInfo.name)}&crm=${encodeURIComponent(doctorInfo.crm)}&date=${encodeURIComponent(new Date().toLocaleDateString("pt-BR"))}`} target="_blank" rel="noopener noreferrer">Baixar TER oficial (com nome)</a>
              <a className="btn-ghost text-sm" href={`/api/ceaf/official?protocol=${protocol.id}&doc=form`} target="_blank" rel="noopener noreferrer">Baixar formulário oficial</a>
              <a className="btn-ghost text-sm" href={`/api/ceaf/official?protocol=${protocol.id}&doc=residencia`} target="_blank" rel="noopener noreferrer">Declaração de residência (terceiro)</a>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">A LME oficial é gerada no botão abaixo; TER e formulário são os arquivos oficiais da SESAB (conferidos em {new Date(protocol.lastReview).toLocaleDateString("pt-BR")}). Imprima, colha assinatura e anexe ao processo.</p>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Voltar</button>
        {step < 7 ? (
          <button type="button" className="btn-gold" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>Avançar</button>
        ) : (
          <button type="button" className="btn-gold" onClick={finish} disabled={saving}>{saving ? "Gerando…" : "Gerar LME"}</button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      <input className="input-field" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
