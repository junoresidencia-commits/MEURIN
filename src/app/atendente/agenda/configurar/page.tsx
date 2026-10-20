"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AvailabilityPeriod } from "@/lib/types";

const DAYS = [
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];
const DURATIONS = [20, 30, 40, 45, 60];
const INTERVALS = [0, 5, 10, 15, 20, 30];

type Loc = { id: string; name: string; city: string; active: boolean };
type DoctorLink = { doctorId: string; doctorName: string };

function ConfigInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorLink[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const activeLocations = locations.filter((l) => l.active);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/atendente/me").then((r) => r.json());
      if (!me.attendant) { router.replace("/atendente/login"); return; }
      const list: DoctorLink[] = me.doctors || [];
      setDoctors(list);
      const fromUrl = search.get("doctorId") || "";
      const id = list.some((d) => d.doctorId === fromUrl) ? fromUrl : (list[0]?.doctorId || "");
      setDoctorId(id);
    })();
  }, [router, search]);

  useEffect(() => {
    if (!doctorId) return;
    (async () => {
      const r = await fetch(`/api/atendente/agenda?doctorId=${doctorId}`).then((x) => x.json());
      setPeriods(r.availabilityPeriods || []);
      setLocations(r.locations || []);
      setDoctorName(r.doctor?.name || "");
      setLoading(false);
    })();
  }, [doctorId]);

  function addPeriod(day: number) {
    const loc = activeLocations[0];
    setPeriods((ps) => [
      ...ps,
      {
        id: crypto.randomUUID(),
        dayOfWeek: day,
        start: "08:00",
        end: "12:00",
        modality: loc ? "presencial" : "teleconsulta",
        locationId: loc?.id,
        durationMin: 30,
        intervalMin: 10,
        visitKind: "ambos",
      },
    ]);
  }
  function update(id: string, patch: Partial<AvailabilityPeriod>) {
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function save() {
    setMsg("");
    for (const p of periods) {
      if (p.modality === "presencial" && !p.locationId) {
        setMsg("Escolha o local nos períodos presenciais.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/atendente/agenda", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, availabilityPeriods: periods }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "Não foi possível salvar."); return; }
      setMsg("Agenda salva. Já aparece para o médico e para os pacientes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-16 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <Link href={`/atendente/agenda?doctorId=${doctorId}`} className="text-sm font-semibold text-[var(--gold)]">← Agenda</Link>
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Montar agenda do médico</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Você define os dias e horários de {doctorName || "o médico"}. Repete toda semana. O médico vê a mesma agenda no painel dele.
      </p>

      {doctors.length > 1 && (
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>)}
          </select>
        </label>
      )}

      <div className="mt-4 grid gap-3">
        {DAYS.map((d) => {
          const dayPeriods = periods.filter((p) => p.dayOfWeek === d.id);
          return (
            <div key={d.id} className="panel">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[var(--text)]">{d.label}</p>
                <button type="button" className="btn-ghost text-sm" onClick={() => addPeriod(d.id)}>+ Horário</button>
              </div>
              {dayPeriods.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Sem atendimento neste dia.</p>}
              <div className="mt-3 grid gap-3">
                {dayPeriods.map((p) => (
                  <div key={p.id} className="rounded-xl border border-[var(--border)] p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modalidade</span>
                        <select className="input-field" value={p.modality} onChange={(e) => update(p.id, { modality: e.target.value as AvailabilityPeriod["modality"], locationId: e.target.value === "teleconsulta" ? undefined : p.locationId })}>
                          <option value="teleconsulta">Teleconsulta</option>
                          <option value="presencial">Presencial</option>
                        </select>
                      </label>
                      {p.modality === "presencial" && (
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Local</span>
                          <select className="input-field" value={p.locationId || ""} onChange={(e) => update(p.id, { locationId: e.target.value || undefined })}>
                            <option value="">Selecione</option>
                            {activeLocations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Início</span>
                        <input type="time" className="input-field" value={p.start} onChange={(e) => update(p.id, { start: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Fim</span>
                        <input type="time" className="input-field" value={p.end} onChange={(e) => update(p.id, { end: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Duração</span>
                        <select className="input-field" value={p.durationMin} onChange={(e) => update(p.id, { durationMin: Number(e.target.value) })}>
                          {DURATIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Intervalo</span>
                        <select className="input-field" value={p.intervalMin} onChange={(e) => update(p.id, { intervalMin: Number(e.target.value) })}>
                          {INTERVALS.map((m) => <option key={m} value={m}>{m} min</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="button" className="mt-2 text-sm font-semibold text-[var(--danger)]" onClick={() => setPeriods((ps) => ps.filter((x) => x.id !== p.id))}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar agenda do médico"}</button>
        <Link href={`/atendente/agenda?doctorId=${doctorId}`} className="btn-ghost">Ver calendário</Link>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--text)]">{msg}</p>}
    </div>
  );
}

export default function AtendenteConfigurarAgendaPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-5 py-16 text-[var(--text-muted)]">Carregando…</div>}>
      <ConfigInner />
    </Suspense>
  );
}
