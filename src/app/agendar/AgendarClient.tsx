"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Booking, Modality, PaymentMethod, PublicDoctor } from "@/lib/types";
import { formatBRL } from "@/lib/scheduling-client";
import { trackEvent } from "@/lib/analytics-client";

type Slot = {
  start: string;
  end: string;
  label: string;
  modality?: Modality;
  locationId?: string;
  locationName?: string;
  priceCents?: number;
};
type Loc = { id: string; name: string; city: string; address?: string };

function holderToken(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let t = sessionStorage.getItem("mr_holder");
    if (!t) {
      t = (crypto.randomUUID?.() || String(Date.now()));
      sessionStorage.setItem("mr_holder", t);
    }
    return t;
  } catch {
    return "anon";
  }
}

const STEPS = ["Médico", "Horário", "Seus dados", "Pagamento"] as const;

const REASONS: { id: Booking["careReason"]; label: string; hint: string }[] = [
  {
    id: "pressa",
    label: "Estou com pressa",
    hint: "Quero o horário mais próximo possível",
  },
  {
    id: "acompanhamento",
    label: "Consulta nefrológica / acompanhamento",
    hint: "Avaliação médica, exames disponíveis e continuidade do cuidado",
  },
  {
    id: "segunda_opiniao",
    label: "Segunda opinião nefrológica",
    hint: "Já tenho exames, diagnóstico ou tratamento e quero nova avaliação",
  },
  {
    id: "outro",
    label: "Outro motivo",
    hint: "Conversa clínica online ou presencial",
  },
];

const PRODUCT_COPY: Record<Booking["careReason"], { title: string; body: string }> = {
  pressa: {
    title: "Consulta nefrológica",
    body: "Avaliação médica, análise dos exames disponíveis e emissão de documentos médicos quando clinicamente indicados.",
  },
  acompanhamento: {
    title: "Consulta nefrológica",
    body: "Avaliação médica, análise dos exames disponíveis e emissão de documentos médicos quando clinicamente indicados.",
  },
  segunda_opiniao: {
    title: "Segunda opinião nefrológica",
    body: "Avaliação médica para pacientes que já possuem exames, diagnóstico ou tratamento e desejam uma nova avaliação.",
  },
  outro: {
    title: "Consulta nefrológica",
    body: "Avaliação médica contextualizada, conforme a necessidade clínica apresentada.",
  },
};

export default function AgendarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsFast = searchParams.get("rapido") === "1";
  const motivoParam = searchParams.get("motivo");
  const initialReason: Booking["careReason"] =
    motivoParam === "segunda_opiniao" || motivoParam === "pressa" || motivoParam === "acompanhamento" || motivoParam === "outro"
      ? motivoParam
      : wantsFast
        ? "pressa"
        : "acompanhamento";

  const [step, setStep] = useState(0);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [modality, setModality] = useState<Modality | "">("");
  const [locations, setLocations] = useState<Loc[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientCity, setPatientCity] = useState("");
  const [careReason, setCareReason] = useState<Booking["careReason"]>(initialReason);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consentDocs, setConsentDocs] = useState<
    { type: string; title: string; body: string; version: string; sha256: string }[]
  >([]);
  const [consentChecked, setConsentChecked] = useState<Record<string, boolean>>({});
  const [openConsent, setOpenConsent] = useState<string | null>(null);

  const doctor = useMemo(
    () => doctors.find((d) => d.id === doctorId) || null,
    [doctors, doctorId]
  );

  const soonSlots = useMemo(() => slots.slice(0, 6), [slots]);
  const otherSlots = useMemo(() => slots.slice(6), [slots]);
  const product = PRODUCT_COPY[careReason];

  useEffect(() => {
    trackEvent("doctors_list_view");
    fetch("/api/doctors")
      .then((r) => r.json())
      .then(setDoctors)
      .catch(() => setError("Não foi possível carregar os médicos."))
      .finally(() => setLoadingDoctors(false));
  }, []);

  // Carrega locais/modalidades disponíveis do médico ao escolhê-lo.
  useEffect(() => {
    if (!doctorId) return;
    setSlot(null);
    fetch(`/api/availability?doctorId=${doctorId}`)
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, [doctorId]);

  // Carrega os horários REAIS conforme modalidade/clínica escolhidas.
  useEffect(() => {
    if (!doctorId || !modality) {
      setSlots([]);
      return;
    }
    if (modality === "presencial" && !locationId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const qs = new URLSearchParams({ doctorId, modality });
    if (modality === "presencial") qs.set("locationId", locationId);
    fetch(`/api/availability?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setError("Erro ao carregar horários."))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, modality, locationId]);

  async function chooseSlot(s: Slot): Promise<boolean> {
    setError("");
    try {
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, slotStart: s.start, holder: holderToken() }),
      });
      if (!res.ok) {
        setSlot(null);
        setError("Este horário acabou de ficar indisponível. Escolha outro.");
        const qs = new URLSearchParams({ doctorId, modality: modality || "teleconsulta" });
        if (modality === "presencial") qs.set("locationId", locationId);
        const data = await fetch(`/api/availability?${qs.toString()}`).then((r) => r.json());
        setSlots(data.slots || []);
        return false;
      }
      setSlot(s);
      trackEvent("slot_selected", { doctorId });
      return true;
    } catch {
      setSlot(s); // rede instável: segue; o backend revalida ao finalizar
      return true;
    }
  }

  useEffect(() => {
    if (step !== 3 || consentDocs.length > 0) return;
    fetch("/api/consent/documents")
      .then((r) => r.json())
      .then((data) => setConsentDocs(data.documents || []))
      .catch(() => {
        /* segue sem travar caso os termos não carreguem */
      });
  }, [step, consentDocs.length]);

  const consentReady =
    consentDocs.length > 0 && consentDocs.every((d) => consentChecked[d.type]);

  function consentClientInfo() {
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("mr_sid") || "";
      if (!sessionId) {
        sessionId = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
        sessionStorage.setItem("mr_sid", sessionId);
      }
    } catch {
      /* ignore */
    }
    return {
      language: typeof navigator !== "undefined" ? navigator.language : "",
      screenResolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "",
      sessionId,
    };
  }

  async function finishPayment() {
    if (!doctor || !slot) return;
    if (!consentReady) {
      setError("Aceite os termos para finalizar o agendamento.");
      return;
    }
    setLoading(true);
    setError("");
    trackEvent("payment_started", { doctorId: doctor.id });
    try {
      // Registra o consentimento (auditável) antes de prosseguir com o pagamento.
      const accepted: Record<string, boolean> = {};
      consentDocs.forEach((d) => (accepted[d.type] = true));
      await fetch("/api/consent/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: patientEmail,
          accepted,
          client: consentClientInfo(),
        }),
      });
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          patientName,
          patientEmail,
          patientPhone,
          patientCity,
          careReason,
          slotStart: slot.start,
          slotEnd: slot.end,
          paymentMethod,
          modality: slot.modality,
          locationId: slot.locationId,
          holder: holderToken(),
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

      // Pagamento real (Mercado Pago): redireciona para o checkout.
      if (payData.redirectUrl) {
        window.location.href = payData.redirectUrl;
        return;
      }

      // Pagamento simulado: já confirmado, vai para a confirmação.
      trackEvent("payment_completed", { doctorId: doctor.id, bookingId: bookingData.booking.id });
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
        {wantsFast || careReason === "pressa"
          ? "Horários mais próximos"
          : "Agendamento online"}
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        {product.title}
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--text-muted)]">{product.body}</p>
      <p className="mt-3 max-w-xl text-[var(--text-muted)]">
        Escolha o nefrologista, o horário e a modalidade (online ou presencial).
        Depois da consulta, o acompanhamento continua no Meu Rim.
      </p>

      <div className="mt-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= step ? "bg-[var(--gold)]" : "bg-white/10"
              }`}
            />
            <p
              className={`mt-2 text-[11px] font-semibold sm:text-xs ${
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
          {loadingDoctors && (
            <p className="text-[var(--text-muted)]">Carregando nefrologistas…</p>
          )}
          {doctors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDoctorId(d.id);
                setSlot(null);
                trackEvent("doctor_profile_open", { doctorId: d.id });
                trackEvent("schedule_click", { doctorId: d.id });
                setStep(1);
              }}
              className="panel text-left transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  {d.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.logoUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-lg font-extrabold text-[var(--gold)]">
                      {d.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("")}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display text-xl text-[var(--text)]">{d.name}</h2>
                    <p className="mt-1 text-sm text-[var(--gold-light)]">
                      {d.specialty}
                      {" · "}
                      {d.crm}
                      {d.crmState ? `/${d.crmState}` : ""}
                      {d.rqe ? ` · RQE ${d.rqe}` : ""}
                    </p>
                    {d.bio && <p className="mt-3 text-sm text-[var(--text-muted)]">{d.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.onlineAvailable !== false && (
                        <span className="rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--gold)]">
                          Consulta online disponível
                        </span>
                      )}
                      {(d.cities && d.cities.length > 0) || d.clinic ? (
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                          Presencial: {(d.cities && d.cities.length > 0 ? d.cities : [d.clinic]).filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Consulta</p>
                  <p className="font-bold text-[var(--gold)]">{formatBRL(d.consultationPriceCents)}</p>
                </div>
              </div>
            </button>
          ))}
          {!loadingDoctors && doctors.length === 0 && (
            <p className="text-[var(--text-muted)]">
              Nenhum médico na rede ainda. Peça à equipe para se cadastrar em
              “Sou médico”.
            </p>
          )}
        </div>
      )}

      {step === 1 && doctor && (
        <div className="mt-8">
          <p className="text-sm text-[var(--text-muted)]">
            Horários de <strong className="text-[var(--text)]">{doctor.name}</strong>
            {(wantsFast || careReason === "pressa") && (
              <> — mostrando primeiro o que libera mais cedo.</>
            )}
          </p>

          {/* Passo A: como deseja ser atendido? */}
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Como deseja ser atendido?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["teleconsulta", "Teleconsulta (online)"], ["presencial", "Presencial"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setModality(m); setLocationId(""); setSlot(null); }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  modality === m ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Passo B: se presencial, escolher clínica */}
          {modality === "presencial" && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Onde deseja consultar?</p>
              {locations.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">Este médico não tem locais presenciais ativos. Tente teleconsulta.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setLocationId(l.id); setSlot(null); }}
                      className={`rounded-2xl border px-4 py-2 text-left text-sm transition ${
                        locationId === l.id ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--text-soft)]"
                      }`}
                    >
                      <span className="font-semibold">{l.name}</span> · {l.city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!modality && <p className="mt-4 text-sm text-[var(--text-muted)]">Escolha a modalidade para ver os horários.</p>}

          {loadingSlots && (
            <p className="mt-4 text-[var(--text-muted)]">Buscando agenda…</p>
          )}

          {!loadingSlots && soonSlots.length > 0 && (
            <>
              <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Mais próximos
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {soonSlots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => chooseSlot(s).then((ok) => ok && setStep(2))}
                    className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-4 py-3 text-left text-sm text-[var(--gold-light)] transition hover:-translate-y-0.5"
                  >
                    {s.label}
                    {typeof s.priceCents === "number" && <span className="ml-1 font-semibold">· {formatBRL(s.priceCents)}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {!loadingSlots && otherSlots.length > 0 && (
            <>
              <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Outros horários
              </p>
              <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {otherSlots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => chooseSlot(s).then((ok) => ok && setStep(2))}
                    className="rounded-2xl border border-[var(--border)] px-4 py-3 text-left text-sm text-[var(--text-soft)] transition hover:border-[var(--border-gold)]"
                  >
                    {s.label}
                    {typeof s.priceCents === "number" && <span className="ml-1 font-semibold text-[var(--gold-light)]">· {formatBRL(s.priceCents)}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {!loadingSlots && slots.length === 0 && modality && (modality !== "presencial" || locationId) && (
            <p className="mt-4 text-[var(--text-muted)]">
              Sem horários nos próximos dias para esta opção. Tente outra modalidade/clínica ou outro médico.
            </p>
          )}
          <button type="button" className="btn-ghost mt-6" onClick={() => setStep(0)}>
            Trocar médico
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel mt-8 space-y-5">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Por que você busca a consulta?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCareReason(r.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    careReason === r.id
                      ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  <span className="block text-sm font-bold text-[var(--text)]">{r.label}</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Nome completo
            </span>
            <input
              className="input-field"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              E-mail (para o link da sala)
            </span>
            <input
              type="email"
              className="input-field"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
                WhatsApp
              </span>
              <input
                className="input-field"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                autoComplete="tel"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
                Cidade / UF
              </span>
              <input
                className="input-field"
                value={patientCity}
                onChange={(e) => setPatientCity(e.target.value)}
                placeholder="Ex.: Imperatriz — MA"
              />
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            A cidade nos ajuda a entender o alcance da Meu Rim no interior e na
            capital. Não substitui o atendimento presencial de emergência.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button
              type="button"
              className="btn-gold"
              disabled={!patientName || !patientEmail || !patientEmail.includes("@")}
              onClick={() => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
                  setError("Informe um e-mail válido — é nele que chega o link da sala.");
                  return;
                }
                setError("");
                setStep(3);
              }}
            >
              Ir para pagamento
            </button>
          </div>
        </div>
      )}

      {step === 3 && doctor && slot && (
        <div className="panel mt-8 space-y-5">
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-sm">
            <p className="font-semibold text-[var(--text)]">{product.title}</p>
            <p className="mt-1 text-[var(--text-muted)]">{product.body}</p>
            <p className="mt-3 text-[var(--text)]">
              <strong>{doctor.name}</strong> · {slot.label}
            </p>
            <p className="mt-1 text-[var(--text-muted)]">
              {slot.modality === "presencial"
                ? `Presencial${slot.locationName ? ` — ${slot.locationName}` : ""}`
                : "Teleconsulta (online)"}
            </p>
            <p className="mt-2 text-[var(--gold-light)]">
              Total: {formatBRL(slot.priceCents ?? doctor.consultationPriceCents)} — vai para a conta
              do médico
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Forma de pagamento
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["pix", "Pix (mais rápido)"],
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
                      ? "bg-[var(--gold)] text-white"
                      : "border border-[var(--border)] text-[var(--text-soft)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "card" && (
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
                Número do cartão (ambiente de demonstração)
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
              No Pix, a liberação é imediata neste demo: pagamento confirmado →
              consulta liberada → e-mail com o link.
            </p>
          )}

          <p className="text-xs text-[var(--text-muted)]">
            Depois de pagar, você recebe o link da sala Meu Rim. Guarde o
            e-mail. Em emergência (dor forte, falta de ar, desmaio), procure
            pronto-socorro.
          </p>

          {/* Consentimento obrigatório antes de finalizar */}
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              Consentimento
            </p>
            {consentDocs.map((d) => (
              <div key={d.type}>
                <label className="flex items-start gap-2 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
                    checked={Boolean(consentChecked[d.type])}
                    onChange={(e) =>
                      setConsentChecked((c) => ({ ...c, [d.type]: e.target.checked }))
                    }
                  />
                  <span>
                    Li e aceito — {d.title}{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--gold)] underline-offset-2 hover:underline"
                      onClick={() => setOpenConsent(openConsent === d.type ? null : d.type)}
                    >
                      (ler)
                    </button>
                  </span>
                </label>
                {openConsent === d.type && (
                  <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
                    {d.body}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button
              type="button"
              className="btn-gold"
              disabled={loading || !consentReady}
              onClick={finishPayment}
            >
              {loading ? "Confirmando pagamento…" : "Pagar e liberar consulta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
