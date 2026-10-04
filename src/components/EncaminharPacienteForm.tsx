"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONSENT_METHOD_LABELS,
  SHARE_SLICE_LABELS,
  DEFAULT_SHARE_SLICES,
  type ConsentMethod,
  type ProfessionalKind,
  type ShareSlice,
} from "@/lib/network-types";

type PublicPro = {
  id: string;
  kind: ProfessionalKind;
  name: string;
  professionalName: string;
  profession: string;
  specialty: string;
  city: string | null;
  state: string | null;
  clinic: string | null;
  photoUrl: string | null;
};

type PatientOpt = { key: string; name: string };

const SLICES = Object.entries(SHARE_SLICE_LABELS) as [ShareSlice, string][];
const METHODS = Object.entries(CONSENT_METHOD_LABELS) as [ConsentMethod, string][];

export function EncaminharPacienteForm({
  emailParam,
  patientName,
  restrict,
  preselected,
  onDone,
}: {
  emailParam?: string;
  patientName?: string;
  restrict?: "medico" | "assistencial";
  preselected?: { kind: ProfessionalKind; id: string } | null;
  onDone?: () => void;
}) {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<PublicPro[]>([]);
  const [selected, setSelected] = useState<PublicPro | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [slices, setSlices] = useState<ShareSlice[]>([...DEFAULT_SHARE_SLICES]);
  const [consentMethod, setConsentMethod] = useState<ConsentMethod | "">("");
  const [consent, setConsent] = useState(false);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [patientKey, setPatientKey] = useState(emailParam || "");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (emailParam) return;
    fetch("/api/network/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients || []))
      .catch(() => {});
  }, [emailParam]);

  useEffect(() => {
    if (!preselected) return;
    fetch(`/api/network/professionals/${preselected.kind}/${preselected.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.professional) setSelected(d.professional);
      })
      .catch(() => {});
  }, [preselected]);

  const kindFilter = restrict === "medico" ? "doctor" : restrict === "assistencial" ? "" : "";

  async function search(formData?: FormData) {
    const read = (key: string, fallback: string) => String(formData?.get(key) ?? fallback).trim();
    const nextQ = read("q", q);
    const nextSpecialty = read("specialty", specialty);
    const nextCity = read("city", city);
    setQ(nextQ);
    setSpecialty(nextSpecialty);
    setCity(nextCity);
    setSearching(true);
    setMsg("");
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextSpecialty) params.set("specialty", nextSpecialty);
    if (nextCity) params.set("city", nextCity);
    if (kindFilter) params.set("kind", kindFilter);
    if (!params.toString()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const res = await fetch(`/api/network/professionals?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    let list = (data.professionals || []) as PublicPro[];
    if (restrict === "assistencial") {
      list = list.filter((p) => p.kind !== "doctor");
    }
    setResults(list);
    setSearching(false);
  }

  function toggleSlice(s: ShareSlice) {
    setSlices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  const canConfirm = useMemo(() => {
    return Boolean(patientKey && selected && reason.trim() && consent && consentMethod && !saving);
  }, [patientKey, selected, reason, consent, consentMethod, saving]);

  async function submit() {
    if (!selected) { setMsg("Selecione o profissional."); return; }
    if (!patientKey) { setMsg("Selecione o paciente."); return; }
    if (!reason.trim()) { setMsg("Informe o motivo do encaminhamento."); return; }
    if (!consentMethod) { setMsg("Informe como o consentimento foi obtido."); return; }
    if (!consent) { setMsg("O consentimento do paciente é obrigatório."); return; }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/network/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientKey,
          patientName,
          toKind: selected.kind,
          toId: selected.id,
          reason,
          notes,
          shareSlices: slices,
          consentConfirmed: true,
          consentMethod,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível encaminhar.");
      setMsg(d.awaitingPatient
        ? "Solicitação enviada ao paciente. O encaminhamento só segue após a autorização."
        : "Encaminhamento registrado. O profissional receberá o paciente na área de encaminhados.");
      setReason("");
      setNotes("");
      setConsent(false);
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold text-[var(--text)]">
        Encaminhar {patientName || "paciente"}
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        Pesquise qualquer profissional cadastrado no Meu Rim — de outra clínica, cidade ou especialidade.
      </p>

      {!emailParam && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Paciente</span>
          <select className="input-field" value={patientKey} onChange={(e) => setPatientKey(e.target.value)}>
            <option value="">Selecione</option>
            {patients.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      {!selected && (
        <>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void search(new FormData(e.currentTarget)); }}>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Pesquisar profissional</span>
              <input name="q" className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, profissão ou especialidade" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
              <input name="specialty" className="input-field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Cardiologia" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span>
              <input name="city" className="input-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Irecê" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-gold" disabled={searching}>
                {searching ? "Pesquisando…" : "Pesquisar profissional"}
              </button>
            </div>
          </form>
          <div className="grid gap-2">
            {results.length === 0 && !searching && (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum resultado ainda. A busca cobre toda a rede do Meu Rim, sem exigir vínculo prévio.
              </p>
            )}
            {results.map((p) => (
              <button
                key={`${p.kind}-${p.id}`}
                type="button"
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3 text-left hover:border-[var(--gold)]"
                onClick={() => setSelected(p)}
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">
                    {(p.professionalName || p.name).slice(0, 1)}
                  </span>
                )}
                <span>
                  <span className="block font-semibold text-[var(--text)]">{p.professionalName || p.name}</span>
                  <span className="block text-sm text-[var(--text-soft)]">
                    {p.profession}{p.specialty ? ` · ${p.specialty}` : ""}
                    {p.city ? ` · ${p.city}` : ""}
                    {p.clinic ? ` · ${p.clinic}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3">
          <p className="text-sm font-semibold text-[var(--text)]">{selected.professionalName || selected.name}</p>
          <p className="text-sm text-[var(--text-soft)]">
            {selected.profession} · {selected.specialty}
            {selected.city ? ` · ${selected.city}` : ""}
            {selected.clinic ? ` · ${selected.clinic}` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Link href={`/medicos/rede?ver=${selected.kind}:${selected.id}`} className="text-sm font-semibold text-[var(--gold)]">
              Ver perfil
            </Link>
            <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setSelected(null)}>
              Trocar profissional
            </button>
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo do encaminhamento</span>
        <textarea className="input-field min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Solicito avaliação cardiológica por hipertensão resistente." />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observação (opcional)</span>
        <textarea className="input-field min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações extras para o profissional que receberá." />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Informações compartilhadas</p>
        <p className="mb-2 text-xs text-[var(--text-muted)]">Envie somente o necessário para a continuidade do cuidado. O prontuário completo não é liberado automaticamente.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {SLICES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" checked={slices.includes(value)} onChange={() => toggleSlice(value)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] p-3">
        <p className="font-semibold text-[var(--text)]">Consentimento do paciente</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Confirmo que o paciente foi informado sobre este encaminhamento e autorizou o compartilhamento das informações necessárias com o profissional selecionado para continuidade do cuidado.
        </p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Forma de obtenção</span>
          <select className="input-field" value={consentMethod} onChange={(e) => setConsentMethod(e.target.value as ConsentMethod | "")}>
            <option value="">Selecione</option>
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-[var(--text)]">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Paciente autorizou o encaminhamento e o compartilhamento das informações necessárias.
        </label>
      </div>

      <button type="button" className="btn-gold" onClick={submit} disabled={!canConfirm}>
        {saving ? "Encaminhando…" : "Confirmar encaminhamento"}
      </button>
      {msg && <p className="text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
