"use client";

import { useEffect, useMemo, useState } from "react";
import { CEAF_PROTOCOLS, getProtocol, reportTemplate, examReminderList } from "@/lib/ceaf-catalog";

const STEPS = ["Paciente", "Protocolo", "Medicamento", "CID / Diagnóstico", "Dose", "Relatório médico", "Revisão"];

/**
 * Assistente de LME/CEAF baseado no CATÁLOGO OFICIAL (SESAB/BA).
 * Protocolo → medicamentos oficiais → CID permitido do protocolo → relatório médico
 * (com modelo do PCDT). Os exames NÃO são exigidos para gerar: o paciente leva impressos;
 * o app só lembra de listá-los no relatório. Não permite CID/medicamento fora do protocolo.
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
    setMedIds([]); setQty({}); setCid("");
  }
  function toggleMed(id: string) {
    setMedIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  const examReminders = useMemo(() => (protocolId && medIds.length ? examReminderList(protocolId, medIds) : []), [protocolId, medIds]);

  function fillReportTemplate() {
    if (!protocolId) return;
    const meds = selectedMeds.map((m) => ({ name: m.name, presentation: m.presentation, monthlyQty: qty[m.id] || undefined }));
    set("justificativa", reportTemplate({ protocolId, medIds, patientName, cid, diagnosis: form.diagnosis, meds }));
  }

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
      const res = await fetch(`/api/doctor/patients/${emailParam}/lme`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: form.weightKg || undefined, heightCm: form.heightCm || undefined, cid10: cid, diagnosis: form.diagnosis, anamnesis: form.justificativa, medications, establishmentName: establishment?.name, cnes: establishment?.cnes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar a LME.");
      if (alsoReceita) {
        const body = selectedMeds.map((m) => `${m.name} (${m.presentation}) — ${form.posologia || qty[m.id] || ""}`.trim()).join("\n");
        if (body) await fetch(`/api/doctor/patients/${emailParam}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "receita", body, sharedWithPatient: false }) });
      }
      if (alsoRelatorio) {
        const body = (form.justificativa || "").trim() || reportTemplate({ protocolId, medIds, patientName, cid, diagnosis: form.diagnosis, meds: medications });
        if (body) await fetch(`/api/doctor/patients/${emailParam}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "relatorio", title: `Relatório médico — ${protocol.name}`, body, sharedWithPatient: false }) });
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
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Etapa {step + 1} de {STEPS.length} — {STEPS[step]}</p>

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

      {step === 5 && protocol && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Relatório médico (conforme o PCDT)</span>
            <button type="button" className="btn-ghost text-xs" onClick={fillReportTemplate}>Usar modelo do protocolo</button>
          </div>
          <textarea className="input-field min-h-[220px] font-mono text-[13px] leading-relaxed" value={form.justificativa} onChange={(e) => set("justificativa", e.target.value)} placeholder="Clique em “Usar modelo do protocolo” para preencher o relatório conforme o PCDT e edite à vontade." />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-3 py-2 text-sm">
            <p className="font-semibold text-[var(--text)]">Lembrete — exames deste protocolo (o paciente leva impressos e anexa):</p>
            {examReminders.length ? (
              <ul className="mt-1 list-disc pl-5 text-[var(--text-soft)]">
                {examReminders.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            ) : (
              <p className="mt-1 text-[var(--text-muted)]">Selecione o(s) medicamento(s) para ver os exames sugeridos pelo protocolo.</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)]">Os exames não são exigidos aqui para gerar a LME — servem de lembrete para constar no relatório e serem anexados impressos.</p>
          </div>
        </div>
      )}

      {step === 6 && protocol && (
        <div className="space-y-2 text-sm">
          <p className="text-[var(--text-soft)]"><b>Protocolo:</b> {protocol.name} <span className="text-xs text-[var(--text-muted)]">({protocol.source}, conferido {new Date(protocol.lastReview).toLocaleDateString("pt-BR")})</span></p>
          <p className="text-[var(--text-soft)]"><b>CID:</b> {cid || "—"} · <b>Diagnóstico:</b> {form.diagnosis || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Medicamentos:</b> {selectedMeds.map((m) => `${m.name} (${m.presentation})${qty[m.id] ? " — " + qty[m.id] + "/mês" : ""}`).join("; ") || "—"}</p>
          <p className="text-[var(--text-soft)]"><b>Documentos:</b> {protocol.documents.join("; ")}</p>
          <p className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-3 py-2 text-[var(--text-soft)]">📎 Lembrete: os exames do protocolo não são exigidos aqui — o paciente leva impressos e anexa. Eles já constam no relatório médico.</p>
          <label className="mt-2 flex items-center gap-2 text-[var(--text-soft)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={alsoReceita} onChange={(e) => setAlsoReceita(e.target.checked)} />
            Gerar também a receita dos medicamentos (mesmos dados da LME)
          </label>
          <label className="flex items-center gap-2 text-[var(--text-soft)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={alsoRelatorio} onChange={(e) => setAlsoRelatorio(e.target.checked)} />
            Gerar também o relatório médico (documento no prontuário)
          </label>
          <div className="mt-2 rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos oficiais SESAB</p>
            {(() => {
              const q = `protocol=${protocol.id}&name=${encodeURIComponent(patientName || "")}&doctor=${encodeURIComponent(doctorInfo.name)}&crm=${encodeURIComponent(doctorInfo.crm)}&date=${encodeURIComponent(new Date().toLocaleDateString("pt-BR"))}`;
              return (
                <div className="mt-2 flex flex-wrap gap-2">
                  <a className="btn-ghost text-sm" href={`/medicos/documento-oficial?${q}&doc=ter`} target="_blank" rel="noopener noreferrer">Preencher TER oficial</a>
                  <a className="btn-ghost text-sm" href={`/medicos/documento-oficial?${q}&doc=form`} target="_blank" rel="noopener noreferrer">Preencher formulário oficial</a>
                  <a className="btn-ghost text-sm" href={`/api/ceaf/official?protocol=${protocol.id}&doc=residencia`} target="_blank" rel="noopener noreferrer">Declaração de residência (terceiro)</a>
                </div>
              );
            })()}
            <p className="mt-2 text-xs text-[var(--text-muted)]">TER e formulário são os arquivos OFICIAIS da SESAB (conferidos em {new Date(protocol.lastReview).toLocaleDateString("pt-BR")}). No editor você digita e arrasta as caixas até a linha certa e salva como padrão (reaproveita a posição). A LME oficial é gerada no botão abaixo.</p>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Voltar</button>
        {step < STEPS.length - 1 ? (
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
