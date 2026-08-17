"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, getDay, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import type { AvailabilityPeriod, Booking, Modality } from "@/lib/types";

type View = "dia" | "semana" | "mes";
const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

type DoctorLoc = { id: string; name: string; city: string; active: boolean };
type FreeSlot = { start: string; end: string; modality: Modality; locationId?: string; locationName?: string; priceCents?: number };
type DayPeriod = { key: string; period: AvailabilityPeriod; locationName?: string; city?: string; slots: FreeSlot[] };
export type Prefill = { modality: Modality; locationId?: string; start: string } | null;

function statusMeta(b: Booking): { label: string; cls: string; dot: string } | null {
  if (b.status === "cancelled" || b.stage === "cancelada") return null;
  if (b.stage === "nao_realizada") return { label: "Não realizada", cls: "bg-slate-100 border-slate-300 text-slate-500", dot: "bg-slate-400" };
  if (b.status === "confirmed") {
    return b.modality === "teleconsulta"
      ? { label: "Teleconsulta", cls: "bg-sky-50 border-sky-300 text-sky-800", dot: "bg-sky-500" }
      : { label: "Confirmada", cls: "bg-emerald-50 border-emerald-300 text-emerald-800", dot: "bg-emerald-500" };
  }
  if (b.status === "paid" || b.stage === "aguardando_confirmacao") return { label: "Aguardando conf.", cls: "bg-amber-50 border-amber-300 text-amber-800", dot: "bg-amber-500" };
  if (b.status === "pending_payment") return { label: "Aguardando pagamento", cls: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-400" };
  return { label: b.status, cls: "bg-slate-100 border-slate-300 text-slate-600", dot: "bg-slate-400" };
}

/** Gera os horários de UM período num dia (mesma regra do backend). */
function genPeriodSlots(date: Date, p: AvailabilityPeriod, locName?: string): FreeSlot[] {
  const out: FreeSlot[] = [];
  const [sh, sm] = p.start.split(":").map(Number);
  const [eh, em] = p.end.split(":").map(Number);
  const dur = p.durationMin || 30;
  const step = Math.max(5, dur + (p.intervalMin || 0));
  const cur = new Date(date); cur.setHours(sh, sm, 0, 0);
  const end = new Date(date); end.setHours(eh, em, 0, 0);
  while (cur.getTime() + dur * 60000 <= end.getTime()) {
    const start = new Date(cur);
    out.push({ start: start.toISOString(), end: new Date(cur.getTime() + dur * 60000).toISOString(), modality: p.modality, locationId: p.locationId, locationName: locName, priceCents: p.priceCents });
    cur.setTime(cur.getTime() + step * 60000);
  }
  return out;
}

export default function AgendaCalendarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [locations, setLocations] = useState<DoctorLoc[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [view, setView] = useState<View>("semana");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayCursor, setDayCursor] = useState<Date>(new Date());
  const [modalityFilter, setModalityFilter] = useState<"" | Modality>("");
  const [prefill, setPrefill] = useState<Prefill>(null);

  async function loadAll() {
    const [auth, books] = await Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
    ]);
    if (!auth.doctor) { router.replace("/medicos/login"); return; }
    setPeriods(auth.doctor.availabilityPeriods || []);
    setLocations(auth.doctor.locations || []);
    setBlocked(auth.doctor.blockedSlots || []);
    setBookings(books.bookings || []);
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hasPeriods = periods.length > 0;

  const visibleBookings = useMemo(() => bookings.filter((b) => (modalityFilter ? b.modality === modalityFilter : true)), [bookings, modalityFilter]);

  function periodsForDay(date: Date): DayPeriod[] {
    const dow = getDay(date);
    return periods
      .filter((p) => p.dayOfWeek === dow && (modalityFilter ? p.modality === modalityFilter : true))
      .filter((p) => p.modality !== "presencial" || locations.find((l) => l.id === p.locationId)?.active)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((p, i) => {
        const loc = locations.find((l) => l.id === p.locationId);
        return { key: `${p.id || i}`, period: p, locationName: loc?.name, city: loc?.city, slots: genPeriodSlots(date, p, loc?.name) };
      });
  }
  function bookingsOn(date: Date): Booking[] {
    return visibleBookings.filter((b) => isSameDay(new Date(b.slotStart), date)).sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }
  function blockedOn(date: Date): string[] {
    return blocked.filter((s) => isSameDay(new Date(s), date));
  }
  /** Consultas que não caem em nenhum horário dos períodos (encaixes / fora da rotina). */
  function extraBookingsOn(date: Date, dayPeriods: DayPeriod[]): Booking[] {
    const starts = new Set<number>();
    for (const dp of dayPeriods) for (const s of dp.slots) starts.add(new Date(s.start).getTime());
    return bookingsOn(date).filter((b) => statusMeta(b) && !starts.has(new Date(b.slotStart).getTime()));
  }

  function pickFree(s: FreeSlot) {
    setPrefill({ modality: s.modality, locationId: s.locationId, start: s.start });
    if (typeof document !== "undefined") document.getElementById("nova-consulta")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function confirmBooking(id: string) {
    await fetch("/api/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "confirm" }) });
    await loadAll();
  }
  async function proposeTime(b: Booking) {
    const date = window.prompt("Nova data (AAAA-MM-DD):");
    if (!date) return;
    const time = window.prompt("Novo horário (HH:MM):", "09:00");
    if (!time) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Data/horário inválidos.");
    const end = new Date(start.getTime() + 30 * 60000);
    await fetch("/api/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, action: "propose", slotStart: start.toISOString(), slotEnd: end.toISOString() }) });
    await loadAll();
  }
  async function blockSlot() {
    const date = window.prompt("Bloquear — data (AAAA-MM-DD):", format(new Date(), "yyyy-MM-dd"));
    if (!date) return;
    const time = window.prompt("Horário (HH:MM):", "12:00");
    if (!time) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Inválido.");
    await fetch("/api/doctor/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotStart: start.toISOString() }) });
    await loadAll();
  }
  async function deleteBooking(id: string) {
    if (!window.confirm("Excluir esta consulta? O horário volta a ficar livre.")) return;
    await fetch("/api/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await loadAll();
  }
  function remindWhatsApp(b: Booking) {
    const digits = (b.patientPhone || "").replace(/\D/g, "");
    const to = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `Olá, ${b.patientName}! Lembrete da sua consulta no Meu Rim: ${format(new Date(b.slotStart), "d/MM 'às' HH:mm")}${b.modality === "teleconsulta" ? " (teleconsulta)" : b.locationName ? ` — ${b.locationName}` : ""}.`;
    window.open(to ? `https://wa.me/${to}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  const pending = useMemo(() => bookings.filter((b) => b.status === "paid" || b.stage === "proposto_novo_horario"), [bookings]);
  const nextConfirmed = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => b.status === "confirmed" && new Date(b.slotStart).getTime() >= now - 3600000).sort((a, b) => a.slotStart.localeCompare(b.slotStart))[0];
  }, [bookings]);
  // Próximo período de trabalho (quando não há consulta marcada) — a agenda vira sua rotina.
  const nextPeriod = useMemo(() => {
    const now = new Date();
    for (let d = 0; d < 14; d++) {
      const date = addDays(now, d);
      const dps = periodsForDay(date);
      for (const dp of dps) {
        const [sh, sm] = dp.period.start.split(":").map(Number);
        const start = new Date(date); start.setHours(sh, sm, 0, 0);
        if (start.getTime() > now.getTime()) return { date: start, dp };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, locations, modalityFilter]);

  if (loading) return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1"><div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando agenda…</div></div>
      <DoctorMobileNav />
    </div>
  );

  const dayForDay = view === "dia" ? dayCursor : null;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 lg:pb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Agenda</h1>
              <p className="text-[var(--text-muted)]">Sua rotina de atendimento e consultas — onde você trabalha e quem está marcado.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NotificationBell />
              <button type="button" className="btn-ghost" onClick={blockSlot}>+ Bloquear horário</button>
              <Link href="/medicos/agenda/configurar" className="btn-gold">Configurar agenda</Link>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-[var(--border)] bg-white p-1">
                  {(["dia", "semana", "mes"] as View[]).map((v) => (
                    <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize transition ${view === v ? "bg-[var(--gold)] text-white" : "text-[var(--text-soft)]"}`}>
                      {v === "mes" ? "Mês" : v}
                    </button>
                  ))}
                </div>
                <select className="input-field w-auto" value={modalityFilter} onChange={(e) => setModalityFilter(e.target.value as "" | Modality)}>
                  <option value="">Todas as modalidades</option>
                  <option value="presencial">Presencial</option>
                  <option value="teleconsulta">Teleconsulta</option>
                </select>
              </div>

              {!hasPeriods && (
                <div className="mt-3 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4">
                  <p className="font-semibold text-[var(--text)]">Sua agenda ainda não tem períodos de trabalho.</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastrar o local não basta — defina em quais dias/horários você atende em cada local. Isso passa a aparecer aqui em toda semana e o paciente vê esses horários.</p>
                  <Link href="/medicos/agenda/configurar" className="btn-gold mt-3 inline-flex">Configurar minha semana</Link>
                </div>
              )}

              {view !== "mes" && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, -1)) : setWeekOffset((w) => w - 1)}>‹</button>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {view === "dia" ? format(dayCursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : `${format(weekDays[0], "d")} a ${format(weekDays[6], "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                  </p>
                  <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, 1)) : setWeekOffset((w) => w + 1)}>›</button>
                </div>
              )}

              {/* SEMANA — colunas por dia com blocos de período */}
              {view === "semana" && (
                <div className="mt-3 overflow-x-auto">
                  <div className="grid min-w-[900px] grid-cols-7 gap-2">
                    {weekDays.map((d, i) => {
                      const dps = periodsForDay(d);
                      const extras = extraBookingsOn(d, dps);
                      const isToday = isSameDay(d, new Date());
                      return (
                        <div key={i} className="rounded-2xl border border-[var(--border)] bg-white">
                          <div className={`rounded-t-2xl border-b border-[var(--border)] p-2 text-center ${isToday ? "bg-[var(--gold-soft)]" : ""}`}>
                            <p className="text-xs font-bold text-[var(--text-soft)]">{DAY_LABELS[getDay(d)]}</p>
                            <p className="text-sm font-semibold text-[var(--text)]">{format(d, "dd/MM")}</p>
                          </div>
                          <div className="grid gap-2 p-2">
                            {dps.length === 0 && extras.length === 0 && <p className="py-4 text-center text-xs text-[var(--text-muted)]">Não atende</p>}
                            {dps.map((dp) => (
                              <PeriodBlock key={dp.key} dp={dp} bookings={bookingsOn(d)} blocked={blockedOn(d)} onPickFree={pickFree} compact />
                            ))}
                            {extras.length > 0 && (
                              <div className="rounded-xl border border-dashed border-[var(--border)] p-2">
                                <p className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Encaixes / fora da rotina</p>
                                {extras.map((b) => { const m = statusMeta(b)!; return (
                                  <div key={b.id} className={`mt-1 rounded-md border px-1.5 py-1 text-[11px] ${m.cls}`}><span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> {b.patientName}</div>
                                ); })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DIA — blocos grandes com pacientes dentro */}
              {view === "dia" && dayForDay && (() => {
                const dps = periodsForDay(dayForDay);
                const extras = extraBookingsOn(dayForDay, dps);
                return (
                  <div className="mt-3 grid gap-3">
                    {dps.length === 0 && extras.length === 0 && (
                      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center text-[var(--text-muted)]">Não há atendimento configurado neste dia.</div>
                    )}
                    {dps.map((dp) => (
                      <PeriodBlock key={dp.key} dp={dp} bookings={bookingsOn(dayForDay)} blocked={blockedOn(dayForDay)} onPickFree={pickFree} onRemind={remindWhatsApp} onDelete={deleteBooking} />
                    ))}
                    {extras.length > 0 && (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Encaixes / fora da rotina</p>
                        <div className="mt-2 grid gap-2">
                          {extras.map((b) => { const m = statusMeta(b)!; return (
                            <div key={b.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${m.cls}`}>
                              <span><span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> · {b.patientName} <span className="text-xs">· {m.label}</span></span>
                              <span className="flex gap-2"><button type="button" className="text-xs font-semibold underline" onClick={() => remindWhatsApp(b)}>Lembrar</button><button type="button" className="text-xs font-semibold underline" onClick={() => deleteBooking(b.id)}>Excluir</button></span>
                            </div>
                          ); })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {view === "mes" && <MonthView periodsForDay={periodsForDay} bookings={visibleBookings} onPickDay={(d) => { setDayCursor(d); setView("dia"); }} />}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded bg-[var(--gold-soft)] ring-1 ring-[var(--border-gold)]" /> Período de trabalho</span>
                <Legend color="bg-emerald-500" label="Confirmada" />
                <Legend color="bg-amber-500" label="Aguardando" />
                <Legend color="bg-sky-500" label="Teleconsulta" />
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded border border-dashed border-[var(--border-gold)]" /> Livre (clique p/ agendar)</span>
                <Legend color="bg-slate-400" label="Bloqueado" />
              </div>
            </div>

            {/* Barra lateral */}
            <aside className="space-y-4">
              <div className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{nextConfirmed ? "Próxima consulta" : "Próximo período"}</p>
                {nextConfirmed ? (
                  <div className="mt-2">
                    <p className="font-bold text-[var(--text)]">{nextConfirmed.patientName}</p>
                    <p className="text-sm text-[var(--text-muted)]">{format(new Date(nextConfirmed.slotStart), "d/MM 'às' HH:mm")} · {nextConfirmed.modality === "teleconsulta" ? "Teleconsulta" : nextConfirmed.locationName || "Presencial"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/consulta/${nextConfirmed.meetingRoomId}`} className="btn-gold">Iniciar atendimento</Link>
                      <button type="button" className="btn-ghost" onClick={() => remindWhatsApp(nextConfirmed)}>Lembrar no WhatsApp</button>
                    </div>
                  </div>
                ) : nextPeriod ? (
                  <div className="mt-2">
                    <p className="font-bold text-[var(--text)]">{format(nextPeriod.date, "EEEE, d/MM 'às' HH:mm", { locale: ptBR })}</p>
                    <p className="text-sm text-[var(--text-muted)]">📍 {nextPeriod.dp.period.modality === "teleconsulta" ? "Teleconsulta (online)" : `${nextPeriod.dp.locationName || "Presencial"}${nextPeriod.dp.city ? " — " + nextPeriod.dp.city : ""}`}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Sem consultas marcadas ainda neste período.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Configure sua semana para ver sua rotina aqui.</p>
                )}
              </div>

              <div className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Aguardando sua resposta {pending.length > 0 && <span className="ml-2 rounded-full bg-[var(--danger)] px-2 py-0.5 text-xs text-white">{pending.length}</span>}</p>
                {pending.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Tudo em dia.</p>}
                <div className="mt-2 grid gap-3">
                  {pending.slice(0, 4).map((b) => (
                    <div key={b.id} className="rounded-xl border border-[var(--border)] p-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{b.patientName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{format(new Date(b.slotStart), "d/MM · HH:mm")} · {b.modality === "teleconsulta" ? "Teleconsulta" : b.locationName || "Presencial"}</p>
                      {b.stage === "proposto_novo_horario" ? (
                        <p className="mt-1 text-xs font-semibold text-amber-700">Aguardando resposta do paciente</p>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button type="button" className="btn-gold !px-3 !py-1.5 text-xs" onClick={() => confirmBooking(b.id)}>Confirmar</button>
                          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => proposeTime(b)}>Propor horário</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Ações rápidas</p>
                <div className="mt-2 grid gap-1.5 text-sm">
                  <button type="button" className="text-left text-[var(--text-soft)] hover:text-[var(--gold)]" onClick={blockSlot}>Bloquear período</button>
                  <Link href="/medicos/agenda/configurar" className="text-[var(--text-soft)] hover:text-[var(--gold)]">Configurar semana / locais</Link>
                  <Link href="/medicos/painel#financeiro" className="text-[var(--text-soft)] hover:text-[var(--gold)]">Ver financeiro</Link>
                </div>
              </div>
            </aside>
          </div>

          <NewAppointment onCreated={loadAll} prefill={prefill} />
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

/** Bloco de um período de trabalho (Camada 1) com as consultas/horários dentro (Camadas 2–4). */
function PeriodBlock({
  dp, bookings, blocked, onPickFree, onRemind, onDelete, compact,
}: {
  dp: DayPeriod; bookings: Booking[]; blocked: string[];
  onPickFree: (s: FreeSlot) => void; onRemind?: (b: Booking) => void; onDelete?: (id: string) => void; compact?: boolean;
}) {
  const now = Date.now();
  const tele = dp.period.modality === "teleconsulta";
  const bByStart = new Map<number, Booking>();
  for (const b of bookings) { if (statusMeta(b)) bByStart.set(new Date(b.slotStart).getTime(), b); }
  const blockedSet = new Set(blocked.map((s) => new Date(s).getTime()));
  const filled = dp.slots.filter((s) => bByStart.has(new Date(s.start).getTime())).length;

  return (
    <div className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${tele ? "bg-sky-500" : "bg-[var(--gold)]"}`} />
          <p className={`font-bold text-[var(--text)] ${compact ? "text-[12px]" : "text-sm"}`}>
            {dp.period.start}–{dp.period.end}
          </p>
        </div>
        {!compact && <span className="text-xs text-[var(--text-muted)]">{filled}/{dp.slots.length} ocupados</span>}
      </div>
      <p className={`text-[var(--text-soft)] ${compact ? "text-[11px]" : "text-sm"}`}>
        📍 {tele ? "Teleconsulta (online)" : `${dp.locationName || "Presencial"}${dp.city ? " — " + dp.city : ""}`}
      </p>

      <div className={`mt-2 grid gap-1 ${compact ? "" : "sm:grid-cols-2"}`}>
        {dp.slots.map((s) => {
          const t = new Date(s.start).getTime();
          const b = bByStart.get(t);
          if (b) {
            const m = statusMeta(b)!;
            return (
              <div key={s.start} className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${m.cls}`}>
                <span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> {b.patientName}
                <span className="block opacity-80">{m.label}</span>
                {!compact && (onRemind || onDelete) && (
                  <span className="mt-0.5 flex gap-2">
                    {onRemind && <button type="button" className="text-[10px] font-semibold underline" onClick={() => onRemind(b)}>Lembrar</button>}
                    {onDelete && <button type="button" className="text-[10px] font-semibold underline" onClick={() => onDelete(b.id)}>Excluir</button>}
                  </span>
                )}
              </div>
            );
          }
          if (blockedSet.has(t)) return <div key={s.start} className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-1 text-[11px] text-slate-500">{format(new Date(s.start), "HH:mm")} Bloqueado</div>;
          const past = t < now;
          return (
            <button key={s.start} type="button" disabled={past} onClick={() => onPickFree(s)}
              className={`rounded-md border border-dashed px-1.5 py-1 text-left text-[11px] leading-tight transition ${past ? "border-[var(--border)] text-slate-300" : "border-[var(--border-gold)] text-[var(--gold)] hover:bg-white"}`}>
              <span className="font-bold">{format(new Date(s.start), "HH:mm")}</span> livre
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ periodsForDay, bookings, onPickDay }: { periodsForDay: (d: Date) => DayPeriod[]; bookings: Booking[]; onPickDay: (d: Date) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first, { weekStartsOn: 0 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const countOn = (d: Date) => bookings.filter((b) => isSameDay(new Date(b.slotStart), d) && b.status !== "cancelled").length;

  return (
    <div className="mt-3 rounded-2xl border border-[var(--border)] bg-white p-3">
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="btn-ghost !px-3" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
        <p className="text-sm font-semibold capitalize text-[var(--text)]">{format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        <button type="button" className="btn-ghost !px-3" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-bold text-[var(--text-muted)]">
        {DAY_LABELS.map((l) => <div key={l} className="py-1">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const n = countOn(d);
          const dps = periodsForDay(d);
          return (
            <button key={i} type="button" onClick={() => onPickDay(d)} className={`min-h-[70px] rounded-lg border p-1 text-left ${inMonth ? "border-[var(--border)] bg-white" : "border-transparent bg-slate-50 text-slate-400"}`}>
              <span className="text-xs font-semibold">{format(d, "d")}</span>
              {dps.slice(0, 2).map((dp) => (
                <span key={dp.key} className="mt-0.5 block truncate rounded bg-[var(--gold-soft)] px-1 text-[9px] font-semibold text-[var(--gold)]">
                  {dp.period.modality === "teleconsulta" ? "Online" : dp.locationName || "Local"} {dp.period.start}
                </span>
              ))}
              {n > 0 && <span className="mt-0.5 block text-[9px] font-bold text-[var(--text-muted)]">{n} consulta{n > 1 ? "s" : ""}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewAppointment({ onCreated, prefill }: { onCreated: () => void; prefill?: Prefill }) {
  const [doctorId, setDoctorId] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string; city: string }[]>([]);
  const [modality, setModality] = useState<"presencial" | "teleconsulta">("teleconsulta");
  const [locationId, setLocationId] = useState("");
  const [slots, setSlots] = useState<{ start: string; label: string; priceCents: number }[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [chosen, setChosen] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setDoctorId(d?.doctor?.id || ""));
    fetch("/api/doctor/locations").then((r) => r.json()).then((d) => setLocations((d.locations || []).filter((l: { active: boolean }) => l.active)));
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setModality(prefill.modality);
    setLocationId(prefill.locationId || "");
    setChosen(prefill.start);
  }, [prefill]);

  useEffect(() => {
    if (!doctorId) return;
    if (modality === "presencial" && !locationId) { setSlots([]); return; }
    const qs = new URLSearchParams({ doctorId, modality });
    if (modality === "presencial") qs.set("locationId", locationId);
    fetch(`/api/availability?${qs.toString()}`).then((r) => r.json()).then((d) => setSlots(d.slots || []));
  }, [doctorId, modality, locationId]);

  async function submit() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/doctor/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName: name, patientEmail: email, patientPhone: phone, modality, locationId: modality === "presencial" ? locationId : undefined, slotStart: chosen }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setMsg("Consulta agendada e confirmada."); setName(""); setEmail(""); setPhone(""); setChosen(""); onCreated(); }
    else setMsg(d.error || "Não foi possível agendar.");
  }

  return (
    <section id="nova-consulta" className="mt-8 scroll-mt-4">
      <h2 className="font-display text-2xl text-[var(--text)]">Agendar nova consulta</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Marque diretamente para um paciente — já entra confirmada e ocupa o horário. Dica: clique num horário “livre” no calendário para preencher automaticamente.</p>
      <div className="panel mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Paciente</span><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail (opcional)</span><input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">WhatsApp (opcional)</span><input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["teleconsulta", "presencial"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setModality(m); setLocationId(""); setChosen(""); }} className={`rounded-full px-4 py-2 text-sm font-bold transition ${modality === m ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
              {m === "teleconsulta" ? "Teleconsulta" : "Presencial"}
            </button>
          ))}
          {modality === "presencial" && (
            <select className="input-field w-auto" value={locationId} onChange={(e) => { setLocationId(e.target.value); setChosen(""); }}>
              <option value="">Escolha o local</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
            </select>
          )}
        </div>
        {slots.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">Horários disponíveis</p>
            <div className="grid max-h-[220px] gap-2 overflow-y-auto sm:grid-cols-3">
              {slots.slice(0, 30).map((s) => (
                <button key={s.start} type="button" onClick={() => setChosen(s.start)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${chosen === s.start ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--text-soft)]"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {modality === "presencial" && !locationId && <p className="text-sm text-[var(--text-muted)]">Escolha o local para ver os horários.</p>}
        {msg && <p className="text-sm font-semibold text-[var(--teal,#0d9488)]">{msg}</p>}
        <button type="button" className="btn-gold disabled:opacity-50" onClick={submit} disabled={saving || !name || !chosen}>
          {saving ? "Agendando…" : "Agendar consulta"}
        </button>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}</span>;
}
