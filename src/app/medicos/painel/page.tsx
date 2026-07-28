"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking, Doctor, WeeklySlot } from "@/lib/types";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";

const DAYS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

export default function PainelMedicoPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Omit<Doctor, "passwordHash"> | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [price, setPrice] = useState("350");
  const [bio, setBio] = useState("");
  const [weekly, setWeekly] = useState<WeeklySlot[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
    ]).then(([auth, books]) => {
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      setDoctor(auth.doctor);
      setPrice(String(auth.doctor.consultationPriceCents / 100));
      setBio(auth.doctor.bio || "");
      setWeekly(auth.doctor.weeklyAvailability || []);
      setBookings(books.bookings || []);
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

  if (loading || !doctor) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">
        Carregando painel…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
            Painel médico
          </p>
          <h1 className="font-display mt-2 text-4xl text-[var(--text)]">{doctor.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {doctor.crm} · {doctor.specialty}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={logout}>
          Sair
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Consultas</p>
          <p className="font-display mt-2 text-3xl text-[var(--text)]">{bookings.length}</p>
        </div>
        <div className="panel">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Liberadas (pagas)
          </p>
          <p className="font-display mt-2 text-3xl text-[var(--green)]">
            {bookings.filter((b) => b.status === "confirmed").length}
          </p>
        </div>
        <div className="panel">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Na sua conta (estimado)
          </p>
          <p className="font-display mt-2 text-3xl text-[var(--gold)]">{formatBRL(earnings)}</p>
        </div>
      </div>

      <section className="panel mt-8">
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
                  on ? "bg-[var(--gold)] text-[#111]" : "border border-[var(--border)]"
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
              {b.status === "confirmed" && (
                <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold">
                  Entrar na sala
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
