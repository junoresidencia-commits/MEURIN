"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking, Doctor, WeeklySlot } from "@/lib/types";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

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
      }),
    });
    if (res.ok) setMessage("Agenda e valor salvos.");
    else setMessage("Não foi possível salvar.");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/medicos/login");
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
        <div className="flex flex-wrap gap-2">
          <Link href="/medicos/documentos" className="btn-ghost">Documento avulso</Link>
          <a href="/admin/login" className="btn-ghost">Administração</a>
          <button type="button" className="btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a href="#pacientes" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">P</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Pacientes</p>
          <p className="font-display text-3xl text-[var(--text)]">{patients.length}</p>
        </a>
        <a href="#agenda" className="panel transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">A</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Agenda hoje</p>
          <p className="font-display text-3xl text-[var(--text)]">{agendaHoje}</p>
        </a>
        <div className="panel">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8f2] text-[#1c8c70]">✓</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Consultas liberadas</p>
          <p className="font-display text-3xl text-[var(--green)]">
            {bookings.filter((b) => b.status === "confirmed").length}
          </p>
        </div>
        <div className="panel">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]">R$</span>
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Na sua conta (estimado)</p>
          <p className="font-display text-3xl text-[var(--gold)]">{formatBRL(earnings)}</p>
        </div>
      </div>

      <section id="agenda" className="panel mt-8 scroll-mt-4">
        <h2 className="font-display text-2xl text-[var(--text)]">Agenda semanal</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Marque os dias em que você atende. Pacientes só veem esses horários.
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
        <p className="mt-6 text-sm font-semibold text-[var(--text)]">Recebimentos</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Conecte a sua conta Mercado Pago para receber o valor das suas consultas diretamente nela.
        </p>
        <PaymentSettings />
      </section>

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
                  {b.status === "confirmed"
                    ? "Paga e liberada"
                    : b.status === "pending_payment"
                      ? "Aguardando pagamento"
                      : b.status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {b.status === "confirmed" && (
                  <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold">
                    Entrar na sala
                  </Link>
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

function PaymentSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [platformFallback, setPlatformFallback] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/doctor/payment")
      .then((r) => r.json())
      .then((d) => {
        setConnected(Boolean(d.connected));
        setPlatformFallback(Boolean(d.platformFallback));
      })
      .catch(() => setConnected(false));
  }, []);

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/doctor/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setConnected(true);
      setToken("");
      setMsg("Conta conectada. As próximas consultas serão pagas na sua conta Mercado Pago.");
    } else {
      setErr(data.error || "Não foi possível salvar.");
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar a sua conta Mercado Pago?")) return;
    setSaving(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/doctor/payment", { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      setConnected(false);
      setMsg("Conta desconectada.");
    } else {
      setErr("Não foi possível desconectar.");
    }
  }

  if (connected === null) {
    return <div className="panel mt-4 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="panel mt-4">
      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--teal-soft,#d7f2ee)] text-[var(--teal,#0d9488)]">✓</span>
            <div>
              <p className="font-semibold text-[var(--text)]">Sua conta Mercado Pago está conectada</p>
              <p className="text-sm text-[var(--text-muted)]">
                O valor das suas consultas é depositado direto na sua conta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--text-soft)]">
            {platformFallback
              ? "No momento, os pagamentos das suas consultas caem na conta da plataforma. Conecte a sua conta para receber diretamente."
              : "Conecte a sua conta para habilitar o pagamento das suas consultas."}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            <li>
              Entre no{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--teal,#0d9488)] underline"
              >
                painel de desenvolvedores do Mercado Pago
              </a>{" "}
              com a sua conta.
            </li>
            <li>Crie uma aplicação (ou use uma existente) e abra <strong>Credenciais de produção</strong>.</li>
            <li>Copie o <strong>Access Token</strong> (começa com <code>APP_USR-</code>) e cole abaixo.</li>
          </ol>
          <label className="mt-3 block text-sm font-medium text-[var(--text)]" htmlFor="mp-token">
            Access Token do Mercado Pago
          </label>
          <input
            id="mp-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="APP_USR-..."
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--teal,#0d9488)]"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !token.trim()}
            className="btn-gold mt-3 disabled:opacity-50"
          >
            {saving ? "Conectando…" : "Conectar conta"}
          </button>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-[var(--teal,#0d9488)]">{msg}</p>}
      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}

function CreatePatient({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function inviteLink() {
    const digits = done!.phone.replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : `55${digits}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const cpfDigits = done!.cpf.replace(/\D/g, "");
    const login = cpfDigits
      ? `Entre com seu CPF ${cpfDigits} e a senha 123456 (você pode trocar depois).`
      : done!.email
        ? `Entre com seu e-mail ${done!.email}.`
        : "Peça ao seu médico o CPF de acesso.";
    const msg =
      `Olá, ${done!.name}! Seu médico criou seu acesso no Meu Rim.\n` +
      `Acesse ${origin}/paciente/entrar\n` +
      `${login}\n` +
      `Lá você acompanha sua saúde, registra pressão/glicemia e vê seus documentos.`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`;
  }

  if (done) {
    return (
      <div className="panel mt-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--green)]">Paciente criado ✅</p>
        <p className="text-sm text-[var(--text-soft)]">
          <strong>{done.name}</strong> foi cadastrado. Convide para acessar a área do paciente:
        </p>
        {done.cpf.replace(/\D/g, "") ? (
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-sm text-[var(--text-soft)]">
            <p className="font-semibold text-[var(--text)]">Acesso do paciente</p>
            <p>Login (CPF): <b>{done.cpf.replace(/\D/g, "")}</b></p>
            <p>Senha inicial: <b>123456</b> — o paciente pode trocar depois de entrar.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text-muted)]">
            Sem CPF cadastrado: o paciente poderá entrar pelo e-mail. Informe o CPF para habilitar o login com senha.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {done.phone.replace(/\D/g, "").length >= 10 && (
            <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-gold">
              Enviar convite no WhatsApp
            </a>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setDone(null);
              setForm((f) => ({ ...f, name: "", cpf: "", phone: "", email: "" }));
            }}
          >
            Cadastrar outro
          </button>
          <button type="button" className="btn-ghost" onClick={onCreated}>
            Concluir
          </button>
        </div>
        {!done.phone && (
          <p className="text-xs text-[var(--text-muted)]">
            Sem telefone cadastrado — informe o telefone para poder enviar o convite por WhatsApp.
          </p>
        )}
      </div>
    );
  }

  const fields = [
    ["name", "Nome completo", "text"],
    ["cpf", "CPF", "text"],
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
