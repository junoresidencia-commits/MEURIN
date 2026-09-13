"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MEDICAL_SPECIALTIES } from "@/lib/medical-specialties";
import { encodePatientParam } from "@/lib/user-errors";

type TeamDoctor = {
  id: string;
  name: string;
  specialty: string;
  crm?: string;
  clinicName?: string;
  source?: "peer" | "clinic" | "both";
};
type Allied = { id: string; name: string; registry?: string | null; active?: boolean };

const ALLIED = [
  { id: "nutrition", label: "Nutrição" },
  { id: "psychology", label: "Psicologia" },
  { id: "nursing", label: "Enfermagem" },
] as const;

function norm(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function matchesSpec(personSpec: string, selected: string) {
  const a = norm(personSpec);
  const b = norm(selected);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function EncaminharPacienteForm({
  emailParam,
  patientName,
  restrict,
  onDone,
}: {
  emailParam: string;
  patientName?: string;
  /** Só médicos da equipe, só assistencial, ou os dois. */
  restrict?: "medico" | "assistencial";
  onDone?: () => void;
}) {
  const [peers, setPeers] = useState<TeamDoctor[]>([]);
  const [allied, setAllied] = useState<{ nutrition: Allied[]; psychology: Allied[]; nursing: Allied[] }>({
    nutrition: [], psychology: [], nursing: [],
  });
  const [specialty, setSpecialty] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/doctor/peers").then((r) => r.json()).catch(() => ({ doctors: [] })),
      fetch("/api/doctor/clinic-peers").then((r) => r.json()).catch(() => ({ doctors: [] })),
    ]).then(([peersRes, clinicRes]) => {
      const byId = new Map<string, TeamDoctor>();
      for (const d of (peersRes.doctors || []) as TeamDoctor[]) {
        byId.set(d.id, { ...d, source: "peer" });
      }
      for (const d of (clinicRes.doctors || []) as Array<TeamDoctor & { clinics?: { name: string }[] }>) {
        const clinicName = d.clinics?.[0]?.name || d.clinicName;
        const existing = byId.get(d.id);
        if (existing) {
          byId.set(d.id, { ...existing, clinicName, source: "both" });
        } else {
          byId.set(d.id, { ...d, clinicName, source: "clinic" });
        }
      }
      setPeers([...byId.values()]);
    }).catch(() => {});
    fetch("/api/doctor/care-team").then((r) => r.json()).then((d) => {
      setAllied({
        nutrition: (d.mine?.nutrition || []).filter((p: Allied) => p.active !== false),
        psychology: (d.mine?.psychology || []).filter((p: Allied) => p.active !== false),
        nursing: (d.mine?.nursing || []).filter((p: Allied) => p.active !== false),
      });
    }).catch(() => {});
  }, []);

  const extraDoctorSpecs = useMemo(() => {
    const known = MEDICAL_SPECIALTIES.map(norm);
    return [...new Set(peers.map((p) => p.specialty).filter(Boolean))]
      .filter((s) => !known.some((k) => matchesSpec(s, k)));
  }, [peers]);

  const alliedRole = ALLIED.find((a) => a.id === specialty);
  const people = useMemo(() => {
    if (!specialty) return [];
    if (alliedRole) return allied[alliedRole.id] || [];
    return peers.filter((p) => matchesSpec(p.specialty, specialty));
  }, [specialty, alliedRole, allied, peers]);

  const selected = people.find((p) => p.id === professionalId);

  async function submit() {
    if (!specialty) { setMsg("Escolha a especialidade."); return; }
    if (!professionalId) { setMsg("Escolha o profissional da sua equipe."); return; }
    setSaving(true); setMsg("");
    try {
      if (alliedRole) {
        const res = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/care-refer`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: alliedRole.id, professionalId, reason }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Não foi possível encaminhar.");
        setMsg("Paciente encaminhado. Ele aparece na área daquele profissional.");
      } else {
        const res = await fetch("/api/doctor/shares", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientKey: emailParam, toDoctorId: professionalId, reason }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Não foi possível encaminhar.");
        setMsg(d.alreadyShared ? "Este médico já acompanha o paciente." : "Paciente compartilhado. Ele aparece na lista daquele médico.");
      }
      setReason("");
      setProfessionalId("");
      onDone?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 text-sm font-semibold text-[var(--text)]">
        Encaminhar {patientName || "paciente"}
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
        <select className="input-field" value={specialty} onChange={(e) => { setSpecialty(e.target.value); setProfessionalId(""); setMsg(""); }}>
          <option value="">Selecione</option>
          {restrict !== "assistencial" && (
            <optgroup label="Médicos">
              {MEDICAL_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              {extraDoctorSpecs.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          )}
          {restrict !== "medico" && (
            <optgroup label="Equipe assistencial">
              {ALLIED.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Profissional</span>
        <select className="input-field" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={!specialty}>
          <option value="">{specialty ? (people.length ? "Selecione" : "Ninguém desta especialidade na equipe ou na clínica") : "Escolha a especialidade primeiro"}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{"specialty" in p && p.specialty ? ` — ${p.specialty}` : ""}{"registry" in p && p.registry ? ` · ${p.registry}` : ""}{"crm" in p && p.crm ? ` · ${p.crm}` : ""}{"clinicName" in p && p.clinicName ? ` · ${p.clinicName}` : ""}
            </option>
          ))}
        </select>
      </label>
      {specialty && people.length === 0 && (
        <p className="sm:col-span-2 text-sm text-[var(--text-muted)]">
          Ninguém desta especialidade em Minha Equipe nem na clínica. Cadastre em{" "}
          <Link href="/medicos/equipe-assistencial" className="font-semibold text-[var(--gold)]">Minha Equipe</Link>
          {" "}ou convide o médico na gestão da clínica.
        </p>
      )}
      {selected && (
        <p className="sm:col-span-2 text-sm text-[var(--text-soft)]">
          Encaminhar {patientName || "o paciente"} para{" "}
          {alliedRole ? alliedRole.label : ("specialty" in selected ? selected.specialty : specialty)} · {selected.name}
        </p>
      )}
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo do encaminhamento</span>
        <textarea className="input-field min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Solicito avaliação cardiológica por hipertensão resistente." />
      </label>
      <div className="sm:col-span-2">
        <button type="button" className="btn-gold" onClick={submit} disabled={saving}>{saving ? "Encaminhando…" : "Confirmar encaminhamento"}</button>
      </div>
      {msg && <p className="sm:col-span-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
