"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking, Doctor, WeeklySlot } from "@/lib/types";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import { EnableNotifications } from "@/components/EnableNotifications";
import { QrCode } from "@/components/QrCode";
import { SITE_URL, patientAccessMessage } from "@/lib/site";

const DAYS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

type PatientRow = {
  key: string;
  name: string;
  city: string;
  total: number;
  isCreated: boolean;
  lastSlot: string;
};

export default function PainelMedicoPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Omit<Doctor, "passwordHash"> | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [patientFilter, setPatientFilter] = useState("");
  const [price, setPrice] = useState("350");
  const [bio, setBio] = useState("");
  const [weekly, setWeekly] = useState<WeeklySlot[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifyWa, setNotifyWa] = useState("");
  const [patientWa, setPatientWa] = useState("");
  const [allowPatientWa, setAllowPatientWa] = useState(false);
  const [notifNew, setNotifNew] = useState(true);
  const [notifPay, setNotifPay] = useState(true);
  const [notifResched, setNotifResched] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/doctor/patients").then((r) => r.json()),
    ]).then(([auth, books, pats]) => {
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      setDoctor(auth.doctor);
      setPrice(String(auth.doctor.consultationPriceCents / 100));
      setBio(auth.doctor.bio || "");
      setWeekly(auth.doctor.weeklyAvailability || []);
      setNotifyWa(auth.doctor.notifyWhatsapp || "");
      setPatientWa(auth.doctor.patientContactWhatsapp || "");
      setAllowPatientWa(Boolean(auth.doctor.allowPatientContact));
      setNotifNew(auth.doctor.notifyNewBookings !== false);
      setNotifPay(auth.doctor.notifyPayments !== false);
      setNotifResched(auth.doctor.notifyReschedules !== false);
      setBookings(books.bookings || []);
      setPatients(pats.patients || []);
      setLoading(false);
    });
  }, [router]);

  const earnings = useMemo(() => {
    return bookings
      .filter((b) => ["paid", "confirmed", "completed"].includes(b.status))
      .reduce((sum, b) => sum + Math.round(b.priceCents * 0.95), 0);
  }, [bookings]);

  function toggleDay(dayOfWeek: number) {
    const has = weekly.some((w) => w.dayOfWeek === dayOfWeek);
    if (has) {
      setWeekly((w) => w.filter((x) => x.dayOfWeek !== dayOfWeek));
    } else {
      setWeekly((w) => [
        ...w,
        { dayOfWeek, start: "08:00", end: "12:00" },
        { dayOfWeek, start: "14:00", end: "18:00" },
      ]);
    }
  }

  async function saveProfile() {
    setMessage("");
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyAvailability: weekly,
        consultationPriceCents: Math.round(Number(price) * 100),
        bio,
        notifyWhatsapp: notifyWa,
        patientContactWhatsapp: patientWa,
        allowPatientContact: allowPatientWa,
        notifyNewBookings: notifNew,
        notifyPayments: notifPay,
        notifyReschedules: notifResched,
      }),
    });
    if (res.ok) setMessage("Agenda e valor salvos.");
    else setMessage("Não foi possível salvar.");
  }

  async function reloadBookings() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  async function bookingAction(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, ...extra }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error || "Não foi possível concluir a ação.");
      return false;
    }
    await reloadBookings();
    return true;
  }

  async function proposeTime(b: Booking) {
    const date = window.prompt("Nova data (AAAA-MM-DD):");
    if (!date) return;
    const time = window.prompt("Novo horário (HH:MM):", "09:00");
    if (!time) return;
    const msg = window.prompt("Mensagem ao paciente (opcional):") || "";
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Data/horário inválidos.");
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await bookingAction(b.id, "propose", { slotStart: start.toISOString(), slotEnd: end.toISOString(), message: msg });
  }

  async function rescheduleConsulta(b: Booking) {
    const date = window.prompt("Remarcar — nova data (AAAA-MM-DD): (o pagamento é preservado, sem nova cobrança)");
    if (!date) return;
    const time = window.prompt("Novo horário (HH:MM):", "09:00");
    if (!time) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Data/horário inválidos.");
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await bookingAction(b.id, "reschedule", { slotStart: start.toISOString(), slotEnd: end.toISOString() });
  }

  async function notRealized(b: Booking) {
    const reason = window.prompt("Motivo (médico indisponível / paciente indisponível / problema técnico / problema de conexão / remarcação / outro):", "remarcação");
    if (reason === null) return;
    await bookingAction(b.id, "not_realized", { reason });
  }

  function talkWhatsApp(b: Booking) {
    const digits = (b.patientPhone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `Olá, ${b.patientName}. Aqui é ${doctor?.name || "seu médico"}, do Meu Rim, sobre sua consulta de ${formatSlotLabel(b.slotStart)}.`;
    const url = withCountry ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function reloadPatients() {
    const res = await fetch("/api/doctor/patients");
    const data = await res.json();
    setPatients(data.patients || []);
    setShowCreate(false);
  }

  async function removeBooking(id: string) {
    if (!window.confirm("Excluir esta consulta? Esta ação não pode ser desfeita.")) return;
    const res = await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setBookings((bs) => bs.filter((b) => b.id !== id));
    else window.alert("Não foi possível excluir a consulta.");
  }

  async function removePatient(key: string, name: string) {
    if (!window.confirm(`Excluir o paciente ${name}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/doctor/patients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key }),
    });
    if (res.ok) setPatients((ps) => ps.filter((p) => p.key !== key));
    else window.alert("Não foi possível excluir o paciente.");
  }

  function remindWhatsApp(b: Booking) {
    const digits = (b.patientPhone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg =
      `Olá, ${b.patientName}! Lembrete da sua consulta no Meu Rim: ${formatSlotLabel(b.slotStart)}.` +
      (b.status === "pending_payment" ? " Confirme o pagamento para liberar o atendimento." : "");
    const url = withCountry
      ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading || !doctor) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">
        Carregando painel…
      </div>
    );
  }

  const todayStr = new Date().toDateString();
  const agendaHoje = bookings.filter((b) => new Date(b.slotStart).toDateString() === todayStr).length;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--gold)]">Painel do médico</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">
            Bem-vindo, {doctor.name} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {doctor.crm} · {doctor.specialty} — resumo da sua clínica hoje
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <Link href="/medicos/mais" className="btn-ghost">Mais</Link>
        </div>
      </div>
      <EnableNotifications />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a href="#pacientes" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">P</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Pacientes</p>
          <p className="font-display text-3xl text-[var(--text)]">{patients.length}</p>
        </a>
        <Link href="/medicos/agenda" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">A</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Agenda hoje</p>
          <p className="font-display text-3xl text-[var(--text)]">{agendaHoje}</p>
        </Link>
        <Link href="/medicos/agenda" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8f2] text-[#1c8c70]">✓</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Consultas liberadas</p>
          <p className="font-display text-3xl text-[var(--green)]">
            {bookings.filter((b) => b.status === "confirmed").length}
          </p>
        </Link>
        <a href="#financeiro" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">R$</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Na sua conta (estimado)</p>
          <p className="font-display text-3xl text-[var(--gold)]">{formatBRL(earnings)}</p>
        </a>
      </div>

      <section id="agenda" className="panel mt-8 scroll-mt-4">
        <h2 className="font-display text-2xl text-[var(--text)]">Agenda semanal</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Marque os dias em que você atende. Pacientes só veem esses horários.
        </p>
        <p className="mt-2 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
          Quer atender em <strong>clínicas diferentes por dia</strong> (ex.: Clínica Mãe na segunda de manhã) ou por teleconsulta?{" "}
          <Link href="/medicos/agenda/configurar" className="font-semibold text-[var(--gold)] underline">Abrir a Agenda por local/horário</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = weekly.some((w) => w.dayOfWeek === d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  on ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            Valor da consulta (R$)
          </span>
          <input
            type="number"
            className="input-field max-w-xs"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            Bio pública
          </span>
          <textarea
            className="input-field min-h-[90px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft,#f8fafc)] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">WhatsApp e comunicação</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Você escolhe os números. O número de <strong>notificações é só seu</strong> — nunca é mostrado ao paciente.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Número para receber notificações (privado — só você vê)
            </span>
            <input
              className="input-field"
              inputMode="tel"
              value={notifyWa}
              onChange={(e) => setNotifyWa(e.target.value)}
              placeholder="Seu WhatsApp pessoal/profissional"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Número para contato dos pacientes (pode ser secretária/clínica)
            </span>
            <input
              className="input-field"
              inputMode="tel"
              value={patientWa}
              onChange={(e) => setPatientWa(e.target.value)}
              placeholder="Número que o paciente pode usar"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <input type="checkbox" checked={allowPatientWa} onChange={(e) => setAllowPatientWa(e.target.checked)} />
            Permitir que pacientes falem sobre a consulta pelo WhatsApp (usa o número de contato acima)
          </label>
          <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Quero receber notificações de:</p>
          <div className="mt-1 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" checked={notifNew} onChange={(e) => setNotifNew(e.target.checked)} /> Novas consultas
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" checked={notifPay} onChange={(e) => setNotifPay(e.target.checked)} /> Pagamentos
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" checked={notifResched} onChange={(e) => setNotifResched(e.target.checked)} /> Remarcações e cancelamentos
            </label>
          </div>
        </div>
        <button type="button" className="btn-gold mt-5" onClick={saveProfile}>
          Salvar
        </button>
        {message && <p className="mt-3 text-sm text-[var(--green)]">{message}</p>}
      </section>

      <section id="pacientes" className="mt-8 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-[var(--text)]">Meus pacientes</h2>
          <button type="button" className="btn-gold" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Fechar" : "+ Criar paciente"}
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Crie o paciente e abra o prontuário para registrar evolução, emitir
          receitas, pedidos de exame e relatórios.
        </p>

        {showCreate && <CreatePatient onCreated={reloadPatients} />}

        <div className="mt-4">
          <input
            className="input-field"
            placeholder="Buscar paciente por nome ou cidade…"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-3">
          {patients.length === 0 && (
            <p className="text-[var(--text-muted)]">Nenhum paciente ainda.</p>
          )}
          {patients
            .filter((p) => {
              const q = patientFilter.toLowerCase().trim();
              if (!q) return true;
              return `${p.name} ${p.city}`.toLowerCase().includes(q);
            })
            .map((p) => (
            <div
              key={p.key}
              className="panel flex items-center justify-between gap-2 transition hover:border-[var(--border-gold)]"
            >
              <Link
                href={`/medicos/paciente/${encodeURIComponent(p.key)}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-sm font-extrabold text-[var(--gold)]">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text)]">{p.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {[
                      p.city,
                      p.isCreated ? "Cadastrado por você" : `${p.total} consulta${p.total > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                {p.isCreated && (
                  <button
                    type="button"
                    onClick={() => removePatient(p.key, p.name)}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                    title="Excluir paciente"
                    aria-label={`Excluir paciente ${p.name}`}
                  >
                    <TrashIcon />
                  </button>
                )}
                <Link
                  href={`/medicos/paciente/${encodeURIComponent(p.key)}`}
                  className="grid h-9 w-9 place-items-center text-xl text-[var(--gold)]"
                  aria-label={`Abrir prontuário de ${p.name}`}
                >
                  ›
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="financeiro" className="mt-8 scroll-mt-4">
        <h2 className="font-display text-2xl text-[var(--text)]">Financeiro</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Você define o valor da sua consulta. O percentual de repasse é definido pela administração.
        </p>
        <FinanceCard />
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Recebimentos (Mercado Pago e Pix) ficam em{" "}
          <Link href="/medicos/configuracoes#recebimentos" className="font-semibold text-[var(--gold)]">Configurações › Recebimentos</Link>.
        </p>
      </section>

      {(() => {
        const pending = bookings.filter((b) => b.status === "paid" || b.stage === "proposto_novo_horario");
        if (pending.length === 0) return null;
        return (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-[var(--text)]">
              Consultas aguardando sua resposta
              <span className="ml-2 rounded-full bg-[var(--danger)] px-2 py-0.5 text-sm font-bold text-white align-middle">{pending.length}</span>
            </h2>
            <div className="mt-4 grid gap-3">
              {pending.map((b) => (
                <div key={b.id} className="panel border-[var(--border-gold)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[var(--text)]">{b.patientName}</p>
                      <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(b.slotStart)} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.priceCents / 100)}</p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {b.patientPhone ? `WhatsApp: ${b.patientPhone} · ` : ""}Pagamento: pago · solicitada em {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                      {b.stage === "proposto_novo_horario" && (
                        <p className="mt-1 text-xs font-semibold text-amber-700">Você propôs {b.proposedSlotStart ? formatSlotLabel(b.proposedSlotStart) : "novo horário"} — aguardando resposta do paciente.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.stage !== "proposto_novo_horario" && (
                      <button type="button" className="btn-gold" onClick={() => bookingAction(b.id, "confirm")}>Confirmar consulta</button>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => proposeTime(b)}>Propor outro horário</button>
                    <button type="button" className="btn-ghost" onClick={() => talkWhatsApp(b)}>Falar com o paciente</button>
                    <button type="button" className="btn-ghost" onClick={() => { if (window.confirm("Recusar esta solicitação?")) bookingAction(b.id, "cancel"); }}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <section className="mt-8">
        <h2 className="font-display text-2xl text-[var(--text)]">Próximas consultas</h2>
        <div className="mt-4 grid gap-3">
          {bookings.length === 0 && (
            <p className="text-[var(--text-muted)]">Nenhuma consulta ainda.</p>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="panel flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--text)]">{b.patientName}</p>
                <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(b.slotStart)}</p>
                {(b.patientCity || b.careReason) && (
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {[b.patientCity, b.careReason === "pressa" ? "com pressa" : b.careReason === "segunda_opiniao" ? "2ª opinião" : b.careReason === "acompanhamento" ? "acompanhamento" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs uppercase tracking-wider text-[var(--gold-light)]">
                  {b.stage === "nao_realizada"
                    ? "Não realizada"
                    : b.status === "confirmed"
                      ? "Confirmada"
                      : b.status === "paid"
                        ? "Aguardando sua confirmação"
                        : b.status === "pending_payment"
                          ? "Aguardando pagamento"
                          : b.status === "cancelled"
                            ? "Cancelada"
                            : b.status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {b.status === "confirmed" && (
                  <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold">
                    Entrar na sala
                  </Link>
                )}
                {b.status === "confirmed" && (
                  <>
                    <button type="button" className="btn-ghost" onClick={() => rescheduleConsulta(b)}>Remarcar (sem nova cobrança)</button>
                    <button type="button" className="btn-ghost" onClick={() => notRealized(b)}>Não realizada</button>
                  </>
                )}
                {b.stage === "nao_realizada" && (
                  <button type="button" className="btn-gold" onClick={() => rescheduleConsulta(b)}>Remarcar sem nova cobrança</button>
                )}
                <button
                  type="button"
                  onClick={() => remindWhatsApp(b)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-white px-3 py-2 text-sm font-semibold text-[var(--gold)] transition hover:border-[var(--gold)]"
                  aria-label={`Lembrar ${b.patientName} no WhatsApp`}
                >
                  Lembrar no WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => removeBooking(b.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  aria-label={`Excluir consulta de ${b.patientName}`}
                >
                  <TrashIcon /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function FinanceCard() {
  const [data, setData] = useState<{
    consultationPriceCents: number;
    commissionPercent: number;
    platformPercent: number;
    payoutStatus: "active" | "pending" | "blocked";
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/doctor/finance")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.consultationPriceCents === "number") {
          setData(d);
          setPrice(String(d.consultationPriceCents / 100));
        }
      })
      .catch(() => {});
  };
  useEffect(load, []);

  async function savePrice() {
    setSaving(true);
    setMsg("");
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationPriceCents: cents }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      setMsg("Valor da consulta salvo.");
      load();
    } else {
      setMsg("Não foi possível salvar o valor.");
    }
  }

  if (!data) return <div className="panel mt-4 text-[var(--text-muted)]">Carregando…</div>;

  const payoutLabel: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    blocked: "Bloqueado",
  };

  return (
    <div className="panel mt-4 grid gap-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Valor da consulta
        </p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[var(--text-muted)]">R$</span>
            <input
              type="number"
              min={0}
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-[var(--text)] outline-none focus:border-[var(--teal,#0d9488)]"
            />
            <button type="button" onClick={savePrice} disabled={saving} className="btn-gold px-3 py-1.5 text-sm disabled:opacity-50">
              {saving ? "…" : "Salvar valor"}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-bold text-[var(--text)]">
              {formatBRL(data.consultationPriceCents)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-soft)] transition hover:border-[var(--teal,#0d9488)]"
            >
              Editar
            </button>
          </div>
        )}
        {msg && <p className="mt-1 text-xs text-[var(--teal,#0d9488)]">{msg}</p>}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Repasse contratado
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text)]">{data.commissionPercent}%</p>
        <p className="text-xs text-[var(--text-muted)]">
          Plataforma: {data.platformPercent}% · definido pela administração
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Recebimento
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            data.payoutStatus === "active" ? "text-[var(--teal,#0d9488)]" : "text-[var(--danger)]"
          }`}
        >
          {payoutLabel[data.payoutStatus] ?? data.payoutStatus}
        </p>
        {data.payoutStatus !== "active" && (
          <p className="text-xs text-[var(--text-muted)]">Fale com a administração para liberar.</p>
        )}
      </div>
    </div>
  );
}

function CreatePatient({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    cns: "",
    motherName: "",
    birthdate: "",
    sex: "",
    phone: "",
    email: "",
    address: "",
    emergencyContact: "",
    guardianName: "",
    guardianPhone: "",
    insurance: "",
    allergies: "",
    diseases: "",
    medications: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; phone: string; email: string; cpf: string } | null>(null);
  const [copyMsg, setCopyMsg] = useState("");
  function copyText(text: string, label: string) { navigator.clipboard?.writeText(text); setCopyMsg(`${label} copiado!`); setTimeout(() => setCopyMsg(""), 1500); }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("Informe o nome completo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/doctor/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 409) {
        throw new Error(
          data.existingIsMine
            ? "Você já tem um paciente com este CPF."
            : "Já existe um paciente com este CPF em outro médico. Solicite vínculo."
        );
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível criar.");
      setDone({ name: form.name, phone: form.phone, email: form.email, cpf: form.cpf });
      if (data.linkedExisting) {
        setError(""); // sucesso: conta do paciente vinculada ao prontuário deste médico
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function accessMessage() {
    return patientAccessMessage(done!.name);
  }
  function inviteLink() {
    const digits = done!.phone.replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(accessMessage())}`;
  }

  if (done) {
    const hasPhone = done.phone.replace(/\D/g, "").length >= 10;
    return (
      <div className="panel mt-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--green)]">Paciente cadastrado ✅</p>
        {done.cpf.replace(/\D/g, "") ? (
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-sm text-[var(--text-soft)]">
            <p className="font-semibold text-[var(--text)]">Acesso do paciente</p>
            <p>Site: <b>{SITE_URL}/</b></p>
            <p>Login (CPF): <b>{done.cpf.replace(/\D/g, "")}</b></p>
            <p>Senha provisória: <b>123456</b> — no 1º acesso o paciente cria uma senha pessoal.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">
            Sem CPF cadastrado: informe o CPF para habilitar o login do paciente com senha.
          </p>
        )}

        {/* Mensagem pronta de primeiro acesso */}
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Mensagem de acesso</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-[var(--text-soft)]">{accessMessage()}</pre>
        </div>

        {!hasPhone && (
          <p className="rounded-xl border border-[var(--warn)]/30 bg-[#fff7e8] px-3 py-2 text-xs text-[#7a5a12]">
            Sem telefone com WhatsApp — não é possível enviar automaticamente. Use “Copiar mensagem” e envie ao paciente.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {hasPhone && (
            <>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-gold">Enviar acesso pelo WhatsApp</a>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-ghost">Reenviar acesso</a>
            </>
          )}
          <button type="button" className="btn-ghost" onClick={() => copyText(accessMessage(), "Mensagem")}>Copiar mensagem</button>
          <button type="button" className="btn-ghost" onClick={() => copyText(`${SITE_URL}/`, "Link")}>Copiar link</button>
        </div>
        {copyMsg && <p className="text-xs font-semibold text-[var(--green,#0d9488)]">{copyMsg}</p>}

        {/* QR Code permanente — somente a URL oficial */}
        <div className="pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">QR Code de acesso</p>
          <p className="mb-2 text-xs text-[var(--text-muted)]">Aponte a câmera para {SITE_URL}/ — sem dados pessoais.</p>
          <QrCode value={`${SITE_URL}/`} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={() => { setDone(null); setForm((f) => ({ ...f, name: "", cpf: "", phone: "", email: "" })); }}>Cadastrar outro</button>
          <button type="button" className="btn-ghost" onClick={onCreated}>Concluir</button>
        </div>
      </div>
    );
  }

  const fields = [
    ["name", "Nome completo", "text"],
    ["cpf", "CPF", "text"],
    ["cns", "CNS (Cartão SUS)", "text"],
    ["motherName", "Nome da mãe", "text"],
    ["birthdate", "Data de nascimento", "date"],
    ["sex", "Sexo", "text"],
    ["phone", "Telefone", "tel"],
    ["email", "E-mail", "email"],
    ["address", "Endereço / cidade", "text"],
    ["emergencyContact", "Contato de emergência", "text"],
    ["guardianName", "Responsável legal (se menor)", "text"],
    ["guardianPhone", "Telefone do responsável", "tel"],
    ["insurance", "Convênio / particular", "text"],
  ] as const;

  const longFields = [
    ["allergies", "Alergias"],
    ["diseases", "Doenças"],
    ["medications", "Medicamentos em uso"],
    ["notes", "Observações"],
  ] as const;

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Novo paciente</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, type]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
            <input type={type} className="input-field" value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
      {longFields.map(([k, label]) => (
        <label key={k} className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
          <textarea className="input-field min-h-[60px]" value={form[k]} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="button" className="btn-gold" onClick={submit} disabled={saving || !form.name.trim()}>
        {saving ? "Criando…" : "Criar paciente e abrir prontuário"}
      </button>
    </div>
  );
}
