"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod, PublicDoctor } from "@/lib/types";
import { formatBRL } from "@/lib/scheduling-client";

type Slot = { start: string; end: string; label: string };

const STEPS = ["Médico", "Horário", "Dados", "Pagamento"] as const;

export default function AgendarPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doctor = useMemo(
    () => doctors.find((d) => d.id === doctorId) || null,
    [doctors, doctorId]
  );

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then(setDoctors)
      .catch(() => setError("Não foi possível carregar os médicos."));
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    fetch(`/api/availability?doctorId=${doctorId}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setError("Erro ao carregar horários."));
  }, [doctorId]);

  async function finishPayment() {
    if (!doctor || !slot) return;
    setLoading(true);
    setError("");
    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          patientName,
          patientEmail,
          patientPhone,
          slotStart: slot.start,
          slotEnd: slot.end,
          paymentMethod,
        }),
      });
      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(bookingData.error || "Erro no agendamento");

      const payRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: bookingData.booking.id,
          cardLast4: cardNumber.slice(-4),
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || "Pagamento recusado");

      router.push(`/confirmacao/${bookingData.booking.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha inesperada");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Agendamento
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Consulta de nefrologia
      </h1>

      <div className="mt-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full ${
                i <= step ? "bg-[var(--gold)]" : "bg-white/10"
              }`}
            />
            <p
              className={`mt-2 text-xs font-semibold ${
                i <= step ? "text-[var(--gold-light)]" : "text-[var(--text-muted)]"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="mt-8 grid gap-4">
          {doctors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDoctorId(d.id);
                setSlot(null);
                setStep(1);
              }}
              className="panel text-left transition hover:border-[var(--border-gold)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl text-[var(--text)]">{d.name}</h2>
                  <p className="mt-1 text-sm text-[var(--gold-light)]">
                    {d.specialty} · {d.crm}
                  </p>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">{d.bio}</p>
                </div>
                <p className="shrink-0 font-bold text-[var(--gold)]">
                  {formatBRL(d.consultationPriceCents)}
                </p>
              </div>
            </button>
          ))}
          {doctors.length === 0 && (
            <p className="text-[var(--text-muted)]">
              Nenhum médico cadastrado ainda. Peça à equipe para se registrar.
            </p>
          )}
        </div>
      )}

      {step === 1 && doctor && (
        <div className="mt-8">
          <p className="text-sm text-[var(--text-muted)]">
            Horários de <strong className="text-[var(--text)]">{doctor.name}</strong>
          </p>
          <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => {
                  setSlot(s);
                  setStep(2);
                }}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition hover:border-[var(--border-gold)] ${
                  slot?.start === s.start
                    ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold-light)]"
                    : "border-[var(--border)] text-[var(--text-soft)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {slots.length === 0 && (
            <p className="mt-4 text-[var(--text-muted)]">Sem horários nos próximos dias.</p>
          )}
          <button type="button" className="btn-ghost mt-6" onClick={() => setStep(0)}>
            Voltar
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Nome completo
            </span>
            <input
              className="input-field"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              E-mail
            </span>
            <input
              type="email"
              className="input-field"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              WhatsApp
            </span>
            <input
              className="input-field"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button
              type="button"
              className="btn-gold"
              disabled={!patientName || !patientEmail}
              onClick={() => setStep(3)}
            >
              Ir para pagamento
            </button>
          </div>
        </div>
      )}

      {step === 3 && doctor && slot && (
        <div className="panel mt-8 space-y-5">
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-sm">
            <p className="text-[var(--text)]">
              <strong>{doctor.name}</strong> · {slot.label}
            </p>
            <p className="mt-1 text-[var(--gold-light)]">
              Total: {formatBRL(doctor.consultationPriceCents)} — pago à conta do médico
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["pix", "Pix"],
                ["card", "Cartão"],
                ["boleto", "Boleto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPaymentMethod(id)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  paymentMethod === id
                    ? "bg-[var(--gold)] text-[#111]"
                    : "border border-[var(--border)] text-[var(--text-soft)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {paymentMethod === "card" && (
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
                Número do cartão (demo)
              </span>
              <input
                className="input-field"
                placeholder="4111 1111 1111 1111"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
            </label>
          )}

          {paymentMethod === "pix" && (
            <p className="text-sm text-[var(--text-muted)]">
              No ambiente de demonstração, o Pix é confirmado automaticamente e
              libera a consulta.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button
              type="button"
              className="btn-gold"
              disabled={loading}
              onClick={finishPayment}
            >
              {loading ? "Processando…" : "Pagar e confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
