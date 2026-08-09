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

export default function AgendaCalendarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [view, setView] = useState<View>("semana");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayCursor, setDayCursor] = useState<Date>(new Date());
  const [modalityFilter, setModalityFilter] = useState<"" | Modality>("");

  async function loadAll() {
    const [auth, books] = await Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
    ]);
    if (!auth.doctor) {
      router.replace("/medicos/login");
      return;
    }
    setPeriods(auth.doctor.availabilityPeriods || []);
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

  const [hourStart, hourEnd] = useMemo(() => {
    let min = 8;
    let max = 18;
    for (const p of periods) {
      const sh = Number(p.start.split(":")[0]);
      const eh = Number(p.end.split(":")[0]) + (Number(p.end.split(":")[1]) > 0 ? 1 : 0);
      if (sh < min) min = sh;
      if (eh > max) max = eh;
    }
    return [Math.min(min, 8), Math.max(max, 18)];
  }, [periods]);
  const hours = useMemo(() => Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i), [hourStart, hourEnd]);

  const visibleBookings = useMemo(
    () => bookings.filter((b) => (modalityFilter ? b.modality === modalityFilter : true)),
    [bookings, modalityFilter]
  );

  function dayHasAvailability(date: Date): boolean {
    const dow = getDay(date);
    return periods.some((p) => p.dayOfWeek === dow);
  }
  function bookingsOn(date: Date): Booking[] {
    return visibleBookings
      .filter((b) => isSameDay(new Date(b.slotStart), date))
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }
  function blockedOn(date: Date): string[] {
    return blocked.filter((s) => isSameDay(new Date(s), date));
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
    return bookings
      .filter((b) => b.status === "confirmed" && new Date(b.slotStart).getTime() >= now - 3600000)
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart))[0];
  }, [bookings]);

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando agenda…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 lg:pb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Agenda</h1>
              <p className="text-[var(--text-muted)]">Gerencie seus horários e consultas</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NotificationBell />
              <button type="button" className="btn-ghost" onClick={blockSlot}>+ Bloquear horário</button>
              <Link href="/medicos/agenda/configurar" className="btn-gold">Configurar agenda</Link>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              {/* Controles */}
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

              {view !== "mes" && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, -1)) : setWeekOffset((w) => w - 1)}>‹</button>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {view === "dia"
                      ? format(dayCursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : `${format(weekDays[0], "d")} a ${format(weekDays[6], "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                  </p>
                  <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, 1)) : setWeekOffset((w) => w + 1)}>›</button>
                </div>
              )}

              {/* SEMANA */}
              {view === "semana" && (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
                  <div className="grid min-w-[820px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
                    <div className="border-b border-[var(--border)] p-2" />
                    {weekDays.map((d, i) => (
                      <div key={i} className={`border-b border-l border-[var(--border)] p-2 text-center ${!dayHasAvailability(d) ? "bg-slate-50" : ""}`}>
                        <p className="text-xs font-bold text-[var(--text-soft)]">{DAY_LABELS[getDay(d)]}</p>
                        <p className="text-sm font-semibold text-[var(--text)]">{format(d, "dd/MM")}</p>
                      </div>
                    ))}
                    {hours.map((h) => (
                      <FragmentRow key={h} hour={h} days={weekDays} bookingsOn={bookingsOn} blockedOn={blockedOn} dayHasAvailability={dayHasAvailability} />
                    ))}
                  </div>
                </div>
              )}

              {/* DIA */}
              {view === "dia" && (
                <div className="mt-3 rounded-2xl border border-[var(--border)] bg-white p-3">
                  {!dayHasAvailability(dayCursor) && <p className="mb-2 text-sm text-[var(--text-muted)]">Sem atendimento configurado neste dia.</p>}
                  <div className="grid gap-2">
                    {bookingsOn(dayCursor).length === 0 && blockedOn(dayCursor).length === 0 && (
                      <p className="text-[var(--text-muted)]">Nenhuma consulta neste dia.</p>
                    )}
                    {bookingsOn(dayCursor).map((b) => {
                      const m = statusMeta(b);
                      if (!m) return null;
                      return (
                        <div key={b.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${m.cls}`}>
                          <span>
                            <span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> · {b.patientName}
                            <span className="ml-2 text-xs">· {m.label}{b.locationName ? ` · ${b.locationName}` : ""}</span>
                          </span>
                          <span className="flex gap-2">
                            <button type="button" className="text-xs font-semibold underline" onClick={() => remindWhatsApp(b)}>Lembrar</button>
                            <button type="button" className="text-xs font-semibold underline" onClick={() => deleteBooking(b.id)}>Excluir</button>
                          </span>
                        </div>
                      );
                    })}
                    {blockedOn(dayCursor).map((s) => (
                      <div key={s} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                        <span className="font-bold">{format(new Date(s), "HH:mm")}</span> · Bloqueado
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MÊS */}
              {view === "mes" && <MonthView bookings={visibleBookings} onPickDay={(d) => { setDayCursor(d); setView("dia"); }} />}

              {/* Legenda */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                <Legend color="bg-emerald-500" label="Confirmada" />
                <Legend color="bg-amber-500" label="Aguardando confirmação" />
                <Legend color="bg-sky-500" label="Teleconsulta" />
                <Legend color="bg-slate-400" label="Bloqueado" />
                <Legend color="bg-slate-200" label="Não atende" />
              </div>
            </div>

            {/* Barra lateral */}
            <aside className="space-y-4">
              <div className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Próxima consulta</p>
                {nextConfirmed ? (
                  <div className="mt-2">
                    <p className="font-bold text-[var(--text)]">{nextConfirmed.patientName}</p>
                    <p className="text-sm text-[var(--text-muted)]">{format(new Date(nextConfirmed.slotStart), "d/MM 'às' HH:mm")} · {nextConfirmed.modality === "teleconsulta" ? "Teleconsulta" : nextConfirmed.locationName || "Presencial"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/consulta/${nextConfirmed.meetingRoomId}`} className="btn-gold">Iniciar atendimento</Link>
                      <button type="button" className="btn-ghost" onClick={() => remindWhatsApp(nextConfirmed)}>Lembrar no WhatsApp</button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma consulta confirmada por enquanto.</p>
                )}
              </div>

              <div className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                  Aguardando sua resposta
                  {pending.length > 0 && <span className="ml-2 rounded-full bg-[var(--danger)] px-2 py-0.5 text-xs text-white">{pending.length}</span>}
                </p>
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

          <NewAppointment onCreated={loadAll} />
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function FragmentRow({
  hour,
  days,
  bookingsOn,
  blockedOn,
  dayHasAvailability,
}: {
  hour: number;
  days: Date[];
  bookingsOn: (d: Date) => Booking[];
  blockedOn: (d: Date) => string[];
  dayHasAvailability: (d: Date) => boolean;
}) {
  return (
    <>
      <div className="border-b border-[var(--border)] p-1 text-right text-[11px] text-[var(--text-muted)]">{String(hour).padStart(2, "0")}:00</div>
      {days.map((d, i) => {
        const items = bookingsOn(d).filter((b) => new Date(b.slotStart).getHours() === hour);
        const blocks = blockedOn(d).filter((s) => new Date(s).getHours() === hour);
        const noWork = !dayHasAvailability(d);
        return (
          <div key={i} className={`min-h-[46px] border-b border-l border-[var(--border)] p-1 ${noWork ? "bg-slate-50" : ""}`}>
            {items.map((b) => {
              const m = statusMeta(b);
              if (!m) return null;
              return (
                <div key={b.id} className={`mb-1 rounded-md border px-1.5 py-1 text-[11px] leading-tight ${m.cls}`}>
                  <span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> {b.patientName}
                  <span className="block opacity-80">{m.label}</span>
                </div>
              );
            })}
            {blocks.map((s) => (
              <div key={s} className="mb-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-1 text-[11px] text-slate-500">
                {format(new Date(s), "HH:mm")} Bloqueado
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function MonthView({ bookings, onPickDay }: { bookings: Booking[]; onPickDay: (d: Date) => void }) {
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
          return (
            <button key={i} type="button" onClick={() => onPickDay(d)} className={`min-h-[64px] rounded-lg border p-1 text-left ${inMonth ? "border-[var(--border)] bg-white" : "border-transparent bg-slate-50 text-slate-400"}`}>
              <span className="text-xs font-semibold">{format(d, "d")}</span>
              {n > 0 && <span className="mt-1 block rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold)]">{n} consulta{n > 1 ? "s" : ""}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewAppointment({ onCreated }: { onCreated: () => void }) {
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
    if (res.ok) {
      setMsg("Consulta agendada e confirmada.");
      setName(""); setEmail(""); setPhone(""); setChosen("");
      onCreated();
    } else {
      setMsg(d.error || "Não foi possível agendar.");
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-[var(--text)]">Agendar nova consulta</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Marque diretamente para um paciente — já entra confirmada e ocupa o horário.</p>
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
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}
    </span>
  );
}
