"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addWeeks, format, getDay, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AvailabilityPeriod } from "@/lib/types";

type DoctorLink = { doctorId: string; doctorName: string; permissions: Record<string, boolean> };
type Booking = {
  id: string; patientName: string; patientPhone: string; patientEmail: string;
  slotStart: string; slotEnd: string; status: string; stage: string | null;
  modality: string | null; locationName: string | null;
};
type Loc = { id: string; name: string; city: string; active: boolean };

const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Aguardando pagamento", cls: "bg-slate-100 text-slate-600" },
  paid: { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-600" },
  completed: { label: "Realizada", cls: "bg-slate-100 text-slate-600" },
};

function waLink(phone: string, text: string) {
  const n = (phone || "").replace(/\D/g, "").replace(/^(?!55)/, "55");
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function slotsForPeriod(date: Date, p: AvailabilityPeriod) {
  const out: { start: string; end: string }[] = [];
  const [sh, sm] = p.start.split(":").map(Number);
  const [eh, em] = p.end.split(":").map(Number);
  const dur = p.durationMin || 30;
  const step = Math.max(5, dur + (p.intervalMin || 0));
  const cur = new Date(date); cur.setHours(sh, sm, 0, 0);
  const end = new Date(date); end.setHours(eh, em, 0, 0);
  while (cur.getTime() + dur * 60000 <= end.getTime()) {
    const start = new Date(cur);
    out.push({ start: start.toISOString(), end: new Date(cur.getTime() + dur * 60000).toISOString() });
    cur.setTime(cur.getTime() + step * 60000);
  }
  return out;
}

function AgendaInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorLink[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayCursor, setDayCursor] = useState<Date>(new Date());
  const [view, setView] = useState<"semana" | "dia">("semana");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/atendente/me").then((r) => r.json());
      if (!me.attendant) { router.replace("/atendente/login"); return; }
      const list: DoctorLink[] = me.doctors || [];
      setDoctors(list);
      const fromUrl = search.get("doctorId") || "";
      setDoctorId(list.some((d) => d.doctorId === fromUrl) ? fromUrl : (list[0]?.doctorId || ""));
    })();
  }, [router, search]);

  const load = useCallback(async (did: string) => {
    if (!did) return;
    const r = await fetch(`/api/atendente/agenda?doctorId=${did}`).then((x) => x.json());
    setBookings(r.bookings || []);
    setPeriods(r.availabilityPeriods || []);
    setLocations(r.locations || []);
    setBlocked(r.blockedSlots || []);
    setPerms(r.permissions || {});
    setDoctorName(r.doctor?.name || "");
    setLoading(false);
  }, []);

  useEffect(() => { if (doctorId) load(doctorId); }, [doctorId, load]);

  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  function periodsFor(date: Date) {
    const dow = getDay(date);
    return periods
      .filter((p) => p.dayOfWeek === dow)
      .filter((p) => p.modality !== "presencial" || locations.find((l) => l.id === p.locationId)?.active)
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  function bookingsOn(date: Date) {
    return bookings.filter((b) => b.status !== "cancelled" && isSameDay(new Date(b.slotStart), date))
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setMsg("");
    const res = await fetch("/api/atendente/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, id, action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Não foi possível."); return; }
    setEdit(null);
    await load(doctorId);
  }

  function saveReschedule() {
    if (!edit || !newDate || !newTime) return;
    const start = new Date(`${newDate}T${newTime}:00`);
    if (Number.isNaN(start.getTime())) { setMsg("Data ou horário inválidos."); return; }
    const end = new Date(start.getTime() + 30 * 60000);
    act(edit.id, "reschedule", { slotStart: start.toISOString(), slotEnd: end.toISOString() });
  }

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-16 text-[var(--text-muted)]">Carregando agenda…</div>;

  const focus = view === "dia" ? dayCursor : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-8">
      <Link href="/atendente/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Agenda do médico</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {doctorName || "Médico"} — veja os dias, confirme, remarque e monte os horários. O que você ajustar aparece na agenda do médico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/atendente/agenda/configurar?doctorId=${doctorId}`} className="btn-gold">Montar horários</Link>
          <Link href={`/atendente/agendar?doctorId=${doctorId}`} className="btn-ghost">+ Marcar paciente</Link>
        </div>
      </div>

      {doctors.length > 1 && (
        <label className="mt-4 block max-w-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>)}
          </select>
        </label>
      )}

      {periods.length === 0 && (
        <div className="panel mt-4">
          <p className="font-semibold text-[var(--text)]">Ainda não tem horários nesta agenda.</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Monte a semana do médico — segunda, terça, etc. Depois os pacientes e você enxergam os mesmos horários.</p>
          <Link href={`/atendente/agenda/configurar?doctorId=${doctorId}`} className="btn-gold mt-3 inline-flex">Montar agenda do médico</Link>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={view === "semana" ? "btn-gold" : "btn-ghost"} onClick={() => setView("semana")}>Semana</button>
        <button type="button" className={view === "dia" ? "btn-gold" : "btn-ghost"} onClick={() => setView("dia")}>Dia</button>
        <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, -1)) : setWeekOffset((w) => w - 1)}>‹</button>
        <p className="text-sm font-semibold text-[var(--text)]">
          {view === "dia"
            ? format(dayCursor, "EEEE, d 'de' MMMM", { locale: ptBR })
            : `${format(weekDays[0], "d/MM")} a ${format(weekDays[6], "d/MM")}`}
        </p>
        <button type="button" className="btn-ghost !px-3" onClick={() => view === "dia" ? setDayCursor(addDays(dayCursor, 1)) : setWeekOffset((w) => w + 1)}>›</button>
        <button type="button" className="btn-ghost" onClick={() => { setDayCursor(new Date()); setWeekOffset(0); }}>Hoje</button>
      </div>

      {view === "semana" && (
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[860px] grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const dps = periodsFor(d);
              const books = bookingsOn(d);
              const today = isSameDay(d, new Date());
              return (
                <button key={d.toISOString()} type="button" className={`rounded-2xl border bg-white text-left ${today ? "border-[var(--gold)]" : "border-[var(--border)]"}`} onClick={() => { setDayCursor(d); setView("dia"); }}>
                  <div className={`rounded-t-2xl border-b border-[var(--border)] p-2 text-center ${today ? "bg-[var(--gold-soft)]" : ""}`}>
                    <p className="text-xs font-bold text-[var(--text-muted)]">{DAY_LABELS[getDay(d)]}</p>
                    <p className="text-sm font-semibold">{format(d, "dd/MM")}</p>
                  </div>
                  <div className="grid gap-1 p-2">
                    {dps.length === 0 && books.length === 0 && <p className="py-3 text-center text-xs text-[var(--text-muted)]">Não atende</p>}
                    {dps.map((p) => {
                      const loc = locations.find((l) => l.id === p.locationId);
                      return (
                        <div key={p.id} className="rounded-lg bg-[var(--gold-soft)]/60 px-1.5 py-1 text-[11px]">
                          <p className="font-bold">{p.start}–{p.end}</p>
                          <p>{p.modality === "teleconsulta" ? "Teleconsulta" : loc?.name || "Presencial"}</p>
                        </div>
                      );
                    })}
                    {books.map((b) => {
                      const st = STATUS[b.status] || STATUS.confirmed;
                      return (
                        <div key={b.id} className={`rounded-md px-1.5 py-1 text-[11px] ${st.cls}`}>
                          <span className="font-bold">{format(new Date(b.slotStart), "HH:mm")}</span> {b.patientName.split(" ")[0]}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "dia" && focus && (
        <DayDetail
          date={focus}
          periods={periodsFor(focus)}
          bookings={bookingsOn(focus)}
          locations={locations}
          blocked={blocked}
          perms={perms}
          doctorId={doctorId}
          onAct={act}
          onEdit={(b) => {
            setEdit(b);
            setNewDate(format(new Date(b.slotStart), "yyyy-MM-dd"));
            setNewTime(format(new Date(b.slotStart), "HH:mm"));
          }}
        />
      )}

      {edit && (
        <div className="panel mt-4">
          <p className="font-semibold text-[var(--text)]">Remarcar {edit.patientName}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input type="date" className="input-field" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <input type="time" className="input-field" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" className="btn-gold" onClick={saveReschedule}>Salvar nova data</button>
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{msg}</p>}
    </div>
  );
}

function DayDetail({
  date, periods, bookings, locations, blocked, perms, doctorId, onAct, onEdit,
}: {
  date: Date;
  periods: AvailabilityPeriod[];
  bookings: Booking[];
  locations: Loc[];
  blocked: string[];
  perms: Record<string, boolean>;
  doctorId: string;
  onAct: (id: string, action: string) => void;
  onEdit: (b: Booking) => void;
}) {
  const blockedSet = new Set(blocked.map((s) => new Date(s).toISOString()));
  const byStart = new Map(bookings.map((b) => [new Date(b.slotStart).toISOString(), b]));

  return (
    <div className="mt-4 grid gap-3">
      {periods.length === 0 && bookings.length === 0 && (
        <p className="panel text-sm text-[var(--text-muted)]">Neste dia o médico não tem horário configurado. Monte a semana ou marque um encaixe.</p>
      )}
      {periods.map((p) => {
        const loc = locations.find((l) => l.id === p.locationId);
        const slots = slotsForPeriod(date, p);
        return (
          <div key={p.id} className="panel">
            <p className="font-semibold text-[var(--text)]">{p.start}–{p.end} · {p.modality === "teleconsulta" ? "Teleconsulta" : loc?.name || "Presencial"}</p>
            <div className="mt-2 grid gap-2">
              {slots.map((s) => {
                const book = byStart.get(s.start);
                const isBlocked = blockedSet.has(s.start);
                if (book) return <BookingRow key={book.id} b={book} perms={perms} onAct={onAct} onEdit={onEdit} />;
                if (isBlocked) return <p key={s.start} className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">{format(new Date(s.start), "HH:mm")} · Bloqueado</p>;
                return (
                  <Link key={s.start} href={`/atendente/agendar?doctorId=${doctorId}&slotStart=${encodeURIComponent(s.start)}&modality=${p.modality}${p.locationId ? `&locationId=${p.locationId}` : ""}`} className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--gold-soft)]">
                    {format(new Date(s.start), "HH:mm")} · Livre — marcar paciente
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      {bookings.filter((b) => !periods.some((p) => slotsForPeriod(date, p).some((s) => s.start === new Date(b.slotStart).toISOString()))).map((b) => (
        <BookingRow key={b.id} b={b} perms={perms} onAct={onAct} onEdit={onEdit} extra />
      ))}
    </div>
  );
}

function BookingRow({ b, perms, onAct, onEdit, extra }: { b: Booking; perms: Record<string, boolean>; onAct: (id: string, action: string) => void; onEdit: (b: Booking) => void; extra?: boolean }) {
  const st = STATUS[b.status] || STATUS.confirmed;
  const dt = format(new Date(b.slotStart), "HH:mm");
  return (
    <div className={`rounded-xl border px-3 py-2 ${extra ? "border-dashed border-[var(--border)]" : "border-[var(--border)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text)]">{dt} · {b.patientName}{extra ? " · encaixe" : ""}</p>
          <p className="text-xs text-[var(--text-muted)]">{b.modality === "teleconsulta" ? "Teleconsulta" : b.locationName || "Presencial"} · {b.patientPhone || b.patientEmail}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {perms.confirmar !== false && b.status !== "confirmed" && b.status !== "cancelled" && (
          <button type="button" className="btn-ghost text-sm" onClick={() => onAct(b.id, "confirm")}>Confirmar com o paciente</button>
        )}
        {perms.remarcar !== false && b.status !== "cancelled" && (
          <button type="button" className="btn-ghost text-sm" onClick={() => onEdit(b)}>Mudar data</button>
        )}
        {perms.cancelar !== false && b.status !== "cancelled" && (
          <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => onAct(b.id, "cancel")}>Cancelar</button>
        )}
        {perms.ausencia !== false && b.status === "confirmed" && (
          <button type="button" className="btn-ghost text-sm" onClick={() => onAct(b.id, "not_realized")}>Não compareceu</button>
        )}
        {perms.whatsapp !== false && b.patientPhone && (
          <a className="btn-ghost text-sm" target="_blank" rel="noopener noreferrer" href={waLink(b.patientPhone, `Olá ${b.patientName.split(" ")[0]}, confirmando sua consulta em ${format(new Date(b.slotStart), "dd/MM 'às' HH:mm")}.`)}>WhatsApp</a>
        )}
      </div>
    </div>
  );
}

export default function AtendenteAgendaPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-16 text-[var(--text-muted)]">Carregando…</div>}>
      <AgendaInner />
    </Suspense>
  );
}
