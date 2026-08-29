"use client";

import { useCallback, useEffect, useState } from "react";
import { MEDICAL_SPECIALTIES } from "@/lib/medical-specialties";

type Share = {
  id: string;
  patientKey: string;
  fromDoctorId: string;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorId: string;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
};

type DoctorCard = { id: string; name: string; specialty: string; crm: string };

type Payload = {
  owner: { id: string; name: string; specialty: string; crm: string } | null;
  shares: Share[];
  audit: { id: string; doctorName: string | null; action: string; detail: string | null; createdAt: string }[];
};

const ACTION_LABEL: Record<string, string> = {
  compartilhou: "Compartilhou",
  revogou_acesso: "Removeu acesso",
  evolucao_criada: "Registrou evolução",
  documento_criado: "Criou documento",
};

export function SharePatientWithDoctor({ emailParam, patientName }: { emailParam: string; patientName?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [q, setQ] = useState("");
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [toDoctorId, setToDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/doctor/patients/${emailParam}/shares`).then((r) => r.json());
    if (d.shares) setData(d);
  }, [emailParam]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (q.trim().length < 2 && !specialty) { setDoctors([]); return; }
      const params = new URLSearchParams();
      if (q.trim().length >= 2) params.set("q", q.trim());
      if (specialty) params.set("specialty", specialty);
      fetch(`/api/doctor/peers?${params}`).then((r) => r.json()).then((d) => setDoctors(d.doctors || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, specialty, open]);

  async function share() {
    if (!toDoctorId) { setMsg("Selecione o médico."); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/doctor/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientKey: emailParam, toDoctorId, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível encaminhar.");
      setMsg(d.alreadyShared ? "Este médico já acompanha o paciente." : "Paciente compartilhado. Ele aparece na lista daquele médico.");
      setReason("");
      setToDoctorId("");
      setOpen(false);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  async function revoke(id: string, name: string) {
    if (!window.confirm(`Remover ${name} deste paciente? O histórico que essa pessoa registrou permanece no prontuário.`)) return;
    await fetch("/api/doctor/shares", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  const selected = doctors.find((d) => d.id === toDoctorId);

  return (
    <div className="panel mt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Equipe médica</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Um paciente, um prontuário. Encaminhe a outro médico da plataforma sem duplicar o cadastro.</p>
        </div>
        <button type="button" className="btn-gold text-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "Encaminhar / compartilhar"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {data?.owner && (
          <p className="text-sm text-[var(--text)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Cadastro</span>
            <br />
            {data.owner.name} — {data.owner.specialty || "Medicina"}
          </p>
        )}
        {(data?.shares || []).length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Nenhum outro médico autorizado neste prontuário.</p>
        )}
        {(data?.shares || []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--border)] pt-2">
            <div>
              <p className="font-semibold text-[var(--text)]">{s.toDoctorName} — {s.toSpecialty || "Medicina"}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Encaminhado por {s.fromDoctorName} {s.fromSpecialty ? `— ${s.fromSpecialty}` : ""} · {new Date(s.createdAt).toLocaleDateString("pt-BR")}
              </p>
              {s.reason && <p className="mt-1 text-sm text-[var(--text-soft)]"><b>Motivo:</b> {s.reason}</p>}
            </div>
            <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => revoke(s.id, s.toDoctorName || "profissional")}>
              Remover acesso
            </button>
          </div>
        ))}
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-[var(--text)]">
            Encaminhar {patientName || "paciente"}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
            <select className="input-field" value={specialty} onChange={(e) => { setSpecialty(e.target.value); setToDoctorId(""); }}>
              <option value="">Todas</option>
              {MEDICAL_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Buscar médico (nome ou CRM)</span>
            <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite ao menos 2 letras" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
            <select className="input-field" value={toDoctorId} onChange={(e) => setToDoctorId(e.target.value)}>
              <option value="">{doctors.length ? "Selecione" : "Pesquise para listar médicos da plataforma"}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialty}{d.crm ? ` · ${d.crm}` : ""}</option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="sm:col-span-2 text-sm text-[var(--text-soft)]">
              Encaminhar {patientName || "o paciente"} para {selected.specialty || "Medicina"} · {selected.name}
            </p>
          )}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo do encaminhamento</span>
            <textarea
              className="input-field min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Paciente com DRC G3b, diabetes e hipertensão resistente. Solicito avaliação cardiológica."
            />
          </label>
          <div className="sm:col-span-2">
            <button type="button" className="btn-gold" onClick={share} disabled={saving}>{saving ? "Encaminhando…" : "Confirmar encaminhamento"}</button>
          </div>
        </div>
      )}

      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}

      <button type="button" className="mt-3 text-xs font-semibold text-[var(--gold)]" onClick={() => setShowAudit((v) => !v)}>
        {showAudit ? "Ocultar histórico de acesso" : "Ver histórico de acesso"}
      </button>
      {showAudit && (
        <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
          {(data?.audit || []).length === 0 && <li>Nenhum registro ainda.</li>}
          {(data?.audit || []).map((a) => (
            <li key={a.id}>
              {new Date(a.createdAt).toLocaleString("pt-BR")} · {ACTION_LABEL[a.action] || a.action} · {a.doctorName}
              {a.detail ? ` — ${a.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
