"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import type { AvailabilityPeriod, DoctorLocation } from "@/lib/types";

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

type Period = AvailabilityPeriod;

export default function AgendaMedicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<DoctorLocation[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [msg, setMsg] = useState("");
  const [showLocForm, setShowLocForm] = useState(false);
  const activeLocations = locations.filter((l) => l.active);

  function abrirCadastroLocal() {
    setShowLocForm(true);
    if (typeof document !== "undefined") {
      document.getElementById("locais")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function loadAll() {
    const [auth, locs] = await Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/doctor/locations").then((r) => r.json()),
    ]);
    if (!auth.doctor) {
      router.replace("/medicos/login");
      return;
    }
    setPeriods(auth.doctor.availabilityPeriods || []);
    setLocations(locs.locations || []);
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPeriod(day: number) {
    const activeLoc = locations.find((l) => l.active);
    setPeriods((ps) => [
      ...ps,
      {
        id: crypto.randomUUID(),
        dayOfWeek: day,
        start: "08:00",
        end: "12:00",
        modality: activeLoc ? "presencial" : "teleconsulta",
        locationId: activeLoc?.id,
        durationMin: 30,
        intervalMin: 10,
        priceCents: undefined,
      },
    ]);
  }
  function updatePeriod(id: string, patch: Partial<Period>) {
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removePeriod(id: string) {
    setPeriods((ps) => ps.filter((p) => p.id !== id));
  }

  async function savePeriods() {
    setMsg("");
    // valida presencial precisa de local
    for (const p of periods) {
      if (p.modality === "presencial" && !p.locationId) {
        setMsg("Escolha o local nos períodos presenciais.");
        return;
      }
    }
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availabilityPeriods: periods }),
    });
    setMsg(res.ok ? "Agenda salva. Os horários já aparecem para os pacientes." : "Não foi possível salvar.");
  }

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <a href="/medicos/agenda" className="text-sm font-semibold text-[var(--gold)]">← Agenda</a>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Configurar agenda</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Configure onde e quando você atende. O paciente só verá os horários realmente disponíveis.
          </p>

          <LocationsCard locations={locations} onChange={setLocations} show={showLocForm} setShow={setShowLocForm} />

          <section className="mt-8">
            <h2 className="font-display text-2xl text-[var(--text)]">Configurar semana</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Adicione períodos por dia — presencial (em um local) ou teleconsulta — com duração, intervalo e valor.
            </p>
            <p className="mt-2 rounded-lg bg-[var(--teal-50,#f0fdfa)] px-3 py-2 text-sm text-[var(--text-muted)]">
              <strong className="text-[var(--text)]">Repete toda semana automaticamente.</strong> Você configura uma vez:
              um período em <em>Segunda</em>, por exemplo, vale para <strong>todas as segundas-feiras</strong> — não precisa refazer semana a semana.
            </p>
            <div className="mt-4 grid gap-4">
              {DAYS.map((d) => {
                const dayPeriods = periods.filter((p) => p.dayOfWeek === d.id);
                return (
                  <div key={d.id} className="panel">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[var(--text)]">{d.label}</p>
                      <button type="button" className="btn-ghost text-sm" onClick={() => addPeriod(d.id)}>+ Adicionar período</button>
                    </div>
                    {dayPeriods.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Sem atendimento neste dia.</p>}
                    <div className="mt-3 grid gap-3">
                      {dayPeriods.map((p) => (
                        <div key={p.id} className="rounded-xl border border-[var(--border)] p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modalidade</span>
                              <select className="input-field" value={p.modality} onChange={(e) => updatePeriod(p.id, { modality: e.target.value as Period["modality"], locationId: e.target.value === "teleconsulta" ? undefined : p.locationId })}>
                                <option value="presencial">Presencial</option>
                                <option value="teleconsulta">Teleconsulta</option>
                              </select>
                            </label>
                            {p.modality === "presencial" && (
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Local</span>
                                {activeLocations.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-[var(--border)] p-2 text-sm text-[var(--text-muted)]">
                                    Nenhum local cadastrado ainda.
                                    <button type="button" className="ml-1 font-semibold text-[var(--teal,#0d9488)] underline" onClick={abrirCadastroLocal}>
                                      Cadastrar local
                                    </button>
                                    {" "}ou use <button type="button" className="font-semibold text-[var(--teal,#0d9488)] underline" onClick={() => updatePeriod(p.id, { modality: "teleconsulta", locationId: undefined })}>teleconsulta</button>.
                                  </div>
                                ) : (
                                  <select className="input-field" value={p.locationId || ""} onChange={(e) => updatePeriod(p.id, { locationId: e.target.value || undefined })}>
                                    <option value="">Selecione</option>
                                    {activeLocations.map((l) => (
                                      <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
                                    ))}
                                  </select>
                                )}
                              </label>
                            )}
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-4">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Início</span>
                              <input type="time" className="input-field" value={p.start} onChange={(e) => updatePeriod(p.id, { start: e.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Fim</span>
                              <input type="time" className="input-field" value={p.end} onChange={(e) => updatePeriod(p.id, { end: e.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Duração</span>
                              <select className="input-field" value={p.durationMin} onChange={(e) => updatePeriod(p.id, { durationMin: Number(e.target.value) })}>
                                {DURATIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Intervalo</span>
                              <select className="input-field" value={p.intervalMin} onChange={(e) => updatePeriod(p.id, { intervalMin: Number(e.target.value) })}>
                                {INTERVALS.map((m) => <option key={m} value={m}>{m} min</option>)}
                              </select>
                            </label>
                          </div>
                          <div className="mt-2 flex flex-wrap items-end gap-3">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor (R$) — opcional</span>
                              <input
                                type="number"
                                className="input-field w-32"
                                value={p.priceCents !== undefined ? p.priceCents / 100 : ""}
                                onChange={(e) => updatePeriod(p.id, { priceCents: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100) })}
                                placeholder="usa padrão"
                              />
                            </label>
                            <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => removePeriod(p.id)}>Remover</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {msg && <p className="mt-3 text-sm font-semibold text-[var(--teal,#0d9488)]">{msg}</p>}
            <button type="button" className="btn-gold mt-4" onClick={savePeriods}>Salvar agenda</button>
          </section>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function LocationsCard({ locations, onChange, show, setShow }: { locations: DoctorLocation[]; onChange: (l: DoctorLocation[]) => void; show: boolean; setShow: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "", type: "clinica" });

  async function reload() {
    const r = await fetch("/api/doctor/locations").then((x) => x.json());
    onChange(r.locations || []);
  }
  async function add() {
    if (!form.name || !form.city) return;
    await fetch("/api/doctor/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", city: "", address: "", phone: "", type: "clinica" });
    setShow(false);
    await reload();
  }
  async function toggleActive(l: DoctorLocation) {
    await fetch("/api/doctor/locations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: l.id, active: !l.active }) });
    await reload();
  }
  async function remove(id: string) {
    if (!window.confirm("Remover este local?")) return;
    await fetch(`/api/doctor/locations?id=${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <section id="locais" className="mt-6 scroll-mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-[var(--text)]">Locais de atendimento</h2>
        <button type="button" className="btn-gold" onClick={() => setShow(!show)}>+ Adicionar local</button>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Cadastre aqui suas clínicas/consultórios. Depois eles aparecem no campo <strong>Local</strong> dos períodos presenciais. (Teleconsulta não precisa de local.)
      </p>
      {show && (
        <div className="panel mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do local</span><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Clínica Mãe" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span><input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Irecê" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Endereço (opcional)</span><input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone (opcional)</span><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo</span>
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="clinica">Clínica</option><option value="consultorio">Consultório</option><option value="hospital">Hospital</option><option value="outro">Outro</option>
            </select>
          </label>
          <div className="flex items-end"><button type="button" className="btn-gold" onClick={add} disabled={!form.name || !form.city}>Salvar local</button></div>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {locations.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum local ainda. (Teleconsulta não precisa de local.)</p>}
        {locations.map((l) => (
          <div key={l.id} className="panel flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--text)]">{l.name} <span className="text-sm font-normal text-[var(--text-muted)]">· {l.city}</span></p>
              {l.address && <p className="text-xs text-[var(--text-muted)]">{l.address}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{l.active ? "Ativo" : "Inativo"}</span>
              <button type="button" className="btn-ghost text-sm" onClick={() => toggleActive(l)}>{l.active ? "Desativar" : "Ativar"}</button>
              <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => remove(l.id)}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
