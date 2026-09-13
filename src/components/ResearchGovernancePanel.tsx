"use client";

import { useState } from "react";
import { ETHICS_LABEL, ETHICS_STATUSES, type ConsentStatus, type EthicsStatus, type ResearchConsent, type ResearchProtocol } from "@/lib/research-governance";

type Gate = { ok: boolean; reason: string };

export function ResearchGovernancePanel({
  studyId,
  protocol,
  consents,
  gate,
  onRefresh,
}: {
  studyId: string;
  protocol: ResearchProtocol;
  consents: ResearchConsent[];
  gate: Gate;
  onRefresh: () => void | Promise<void>;
}) {
  const [ethicsStatus, setEthicsStatus] = useState<EthicsStatus>(protocol.ethicsStatus || "none");
  const [protocolCode, setProtocolCode] = useState(protocol.protocolCode || "");
  const [ethicsBody, setEthicsBody] = useState(protocol.ethicsBody || "");
  const [waiverReason, setWaiverReason] = useState(protocol.waiverReason || "");
  const [patientKey, setPatientKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pesquisa/studies/${studyId}/governance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ethicsStatus, protocolCode, ethicsBody, waiverReason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar a governança.");
      setMsg("Governança salva. A exportação só libera com CEP aprovado ou dispensa.");
      await onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function addConsent(status: ConsentStatus) {
    if (!patientKey.trim()) { setMsg("Informe o e-mail ou chave do seu paciente."); return; }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pesquisa/studies/${studyId}/consents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientKey, status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível registrar o consentimento.");
      setPatientKey("");
      setMsg("Consentimento registrado. Só no seu paciente — sem listar outras clínicas.");
      await onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Governança da pesquisa</p>
      <p className="text-sm text-[var(--text-soft)]">
        Separada do financeiro da clínica. Análise no app continua; exportar arquivo exige CEP/CONEP ou dispensa.
        Pacientes atuais não entram sozinhos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Situação ética</span>
          <select className="input-field" value={ethicsStatus} onChange={(e) => setEthicsStatus(e.target.value as EthicsStatus)}>
            {ETHICS_STATUSES.map((s) => (
              <option key={s} value={s}>{ETHICS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Número do parecer / protocolo</span>
          <input className="input-field" value={protocolCode} onChange={(e) => setProtocolCode(e.target.value)} placeholder="CEP-XXXX ou CONEP" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CEP / comitê</span>
          <input className="input-field" value={ethicsBody} onChange={(e) => setEthicsBody(e.target.value)} placeholder="Nome do CEP" />
        </label>
        {ethicsStatus === "waived" && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo da dispensa</span>
            <textarea className="input-field min-h-[70px]" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} placeholder="Ex.: estudo retrospectivo só com dados anonimizados do próprio serviço." />
          </label>
        )}
      </div>
      <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar governança"}</button>
      <p className={`text-sm font-semibold ${gate.ok ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}>{gate.reason}</p>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Consentimento (pontual)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="input-field flex-1 min-w-[200px]" value={patientKey} onChange={(e) => setPatientKey(e.target.value)} placeholder="E-mail do seu paciente" />
          <button type="button" className="btn-ghost" onClick={() => addConsent("given")} disabled={saving}>Registrar dado</button>
          <button type="button" className="btn-ghost" onClick={() => addConsent("withdrawn")} disabled={saving}>Retirado</button>
        </div>
        <div className="mt-2 grid gap-2">
          {consents.length === 0 && <p className="text-xs text-[var(--text-muted)]">Nenhum consentimento ainda. Sem backfill dos 200+.</p>}
          {consents.map((c) => (
            <p key={c.id} className="text-sm text-[var(--text-soft)]">
              {c.patientName || c.patientKey} · {c.status === "given" ? "Dado" : c.status === "withdrawn" ? "Retirado" : c.status}
            </p>
          ))}
        </div>
      </div>
      {msg && <p className="text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
