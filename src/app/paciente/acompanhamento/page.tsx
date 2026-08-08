"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { formatBRL } from "@/lib/scheduling-client";
import type { PatientOffer, PlanEnrollment, PricingSnapshot } from "@/lib/plans";

type DoctorPlans = {
  doctorId: string;
  doctorName: string;
  plans: {
    id: string;
    name: string;
    description?: string;
    priceCents: number;
    consultations: number;
    duration: string;
    customDays?: number;
  }[];
  promotions: { id: string; name: string; discountType: string; discountValue: number }[];
};

type Selection = {
  doctorId: string;
  doctorName: string;
  planId?: string;
  offerId?: string;
  title: string;
  basePriceCents: number;
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "🟢 Ativo",
  aguardando_pagamento: "🟡 Aguardando pagamento",
  aguardando_confirmacao: "🟡 Aguardando confirmação",
  suspenso: "🟠 Suspenso",
  expirado: "⚪ Expirado",
  cancelado: "🔴 Cancelado",
  concluido: "🔵 Concluído",
};

export default function AcompanhamentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<PlanEnrollment[]>([]);
  const [offers, setOffers] = useState<(PatientOffer & { expired?: boolean })[]>([]);
  const [doctors, setDoctors] = useState<DoctorPlans[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);

  async function loadAll() {
    const [e, o, p] = await Promise.all([
      fetch("/api/patient/enrollments").then((r) => (r.status === 401 ? null : r.json())),
      fetch("/api/patient/offers").then((r) => (r.status === 401 ? null : r.json())),
      fetch("/api/patient/plans").then((r) => (r.status === 401 ? null : r.json())),
    ]);
    if (!e) {
      router.replace("/paciente/entrar");
      return;
    }
    setEnrollments(e.enrollments || []);
    setOffers((o?.offers || []).filter((x: PatientOffer) => x.status === "enviada"));
    setDoctors(p?.doctors || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-[560px] px-4 py-20 text-center text-[var(--text-muted)]">Carregando…</div>;
  }

  const active = enrollments.filter((e) => ["ativo", "suspenso", "concluido", "aguardando_confirmacao"].includes(e.status));

  return (
    <div className="mx-auto min-h-screen max-w-[560px] px-4 pb-28 pt-6">
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Meu acompanhamento</h1>

      {offers.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Propostas para você</h2>
          <div className="mt-2 grid gap-3">
            {offers.map((o) => (
              <div key={o.id} className="panel">
                <p className="text-sm text-[var(--text-muted)]">{o.doctorName} disponibilizou uma condição especial:</p>
                <p className="mt-1 font-bold text-[var(--text)]">{o.planName}</p>
                {o.description && <p className="text-sm text-[var(--text-soft)]">{o.description}</p>}
                <div className="mt-2 flex items-baseline gap-2">
                  {o.finalPriceCents < o.originalPriceCents && (
                    <span className="text-sm text-[var(--text-muted)] line-through">{formatBRL(o.originalPriceCents)}</span>
                  )}
                  <span className="text-lg font-bold text-[var(--gold)]">{formatBRL(o.finalPriceCents)}</span>
                </div>
                {o.validUntil && <p className="text-xs text-[var(--text-muted)]">Válido até {new Date(o.validUntil).toLocaleDateString("pt-BR")}</p>}
                <button
                  type="button"
                  className="btn-gold mt-3 w-full"
                  onClick={() => setSelection({ doctorId: o.doctorId, doctorName: o.doctorName || "", offerId: o.id, title: o.planName, basePriceCents: o.finalPriceCents })}
                >
                  Aceitar e pagar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Meus planos</h2>
          <div className="mt-2 grid gap-3">
            {active.map((e) => (
              <div key={e.id} className="panel">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[var(--text)]">{e.planName}</p>
                  <span className="text-sm">{STATUS_LABEL[e.status] ?? e.status}</span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{e.doctorName}</p>
                {e.startAt && e.endAt && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {new Date(e.startAt).toLocaleDateString("pt-BR")} → {new Date(e.endAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                  Consultas: {e.consultationsUsed} de {e.consultationsTotal} realizadas
                </p>
                <div className="mt-2 flex gap-1.5">
                  {Array.from({ length: e.consultationsTotal }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 flex-1 rounded-full ${i < e.consultationsUsed ? "bg-[var(--gold)]" : "bg-[var(--border)]"}`}
                    />
                  ))}
                </div>
                {e.status === "aguardando_confirmacao" && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Aguardando o médico confirmar o recebimento do Pix.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="/paciente/exames" className="btn-ghost text-sm">Ver exames</a>
                  <a href="/paciente/inicio" className="btn-ghost text-sm">Meu rim hoje</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Planos disponíveis</h2>
        {doctors.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum plano disponível dos seus médicos no momento.</p>}
        {doctors.map((d) => (
          <div key={d.doctorId} className="mt-2">
            <p className="text-sm font-semibold text-[var(--text-soft)]">{d.doctorName}</p>
            <div className="mt-2 grid gap-3">
              {d.plans.map((pl) => {
                const promo = d.promotions[0];
                return (
                  <div key={pl.id} className="panel">
                    {promo && (
                      <p className="mb-1 inline-block rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--gold)]">
                        Condição especial · {promo.name}
                      </p>
                    )}
                    <p className="font-bold text-[var(--text)]">{pl.name}</p>
                    {pl.description && <p className="text-sm text-[var(--text-soft)]">{pl.description}</p>}
                    <p className="text-sm text-[var(--text-muted)]">{pl.consultations} consultas</p>
                    <p className="mt-1 text-lg font-bold text-[var(--gold)]">{formatBRL(pl.priceCents)}</p>
                    <button
                      type="button"
                      className="btn-gold mt-2 w-full"
                      onClick={() => setSelection({ doctorId: d.doctorId, doctorName: d.doctorName, planId: pl.id, title: pl.name, basePriceCents: pl.priceCents })}
                    >
                      Contratar plano
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {selection && <Checkout selection={selection} onClose={() => setSelection(null)} onDone={() => { setSelection(null); loadAll(); }} />}

      <PatientNav />
    </div>
  );
}

function Checkout({ selection, onClose, onDone }: { selection: Selection; onClose: () => void; onDone: () => void }) {
  const [coupon, setCoupon] = useState("");
  const [pricing, setPricing] = useState<PricingSnapshot | null>(null);
  const [method, setMethod] = useState<"pix" | "card" | "pix_direto">("pix");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isOffer = Boolean(selection.offerId);

  useEffect(() => {
    if (isOffer) return; // ofertas já têm preço fechado
    preview("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function preview(code: string) {
    setErr("");
    const res = await fetch("/api/patient/plans/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId: selection.doctorId, serviceType: "plan", planId: selection.planId, couponCode: code || undefined }),
    });
    const d = await res.json();
    if (res.ok) {
      setPricing(d.pricing);
      if (code) setMsg("Cupom aplicado.");
    } else {
      setErr(d.error || "Erro ao calcular preço.");
      if (code) setPricing((p) => p); // mantém preço anterior
    }
  }

  async function confirm() {
    setBusy(true);
    setErr("");
    const url = isOffer ? "/api/patient/offers" : "/api/patient/enrollments";
    const body = isOffer
      ? { offerId: selection.offerId, method }
      : { doctorId: selection.doctorId, planId: selection.planId, couponCode: coupon || undefined, method };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(d.error || "Não foi possível concluir.");
      return;
    }
    if (d.provider === "mercadopago" && d.redirectUrl) {
      window.location.href = d.redirectUrl;
      return;
    }
    if (d.status === "aguardando_confirmacao") {
      setMsg("Pagamento por Pix direto registrado. O plano será ativado após o médico confirmar o recebimento.");
      setTimeout(onDone, 1800);
      return;
    }
    setMsg("Plano ativado! 🎉");
    setTimeout(onDone, 1200);
  }

  const original = isOffer ? selection.basePriceCents : pricing?.originalPriceCents ?? selection.basePriceCents;
  const final = isOffer ? selection.basePriceCents : pricing?.finalPriceCents ?? selection.basePriceCents;
  const discount = original - final;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-[var(--text)]">Resumo</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-[var(--text-muted)]">×</button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Médico: {selection.doctorName}</p>
        <p className="text-sm text-[var(--text-muted)]">Serviço: {selection.title}</p>

        {!isOffer && (
          <div className="mt-3 flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Cupom"
              className="input-field flex-1 uppercase"
            />
            <button type="button" className="btn-ghost" onClick={() => preview(coupon)}>Aplicar</button>
          </div>
        )}

        <div className="mt-3 space-y-1 rounded-2xl border border-[var(--border)] p-3 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Preço original</span><span>{formatBRL(original)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-[var(--gold)]">
              <span>Desconto{pricing?.appliedLabel ? ` (${pricing.appliedLabel})` : ""}</span>
              <span>- {formatBRL(discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]">
            <span>Total</span><span>{formatBRL(final)}</span>
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Forma de pagamento</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {([["pix", "Pix online"], ["card", "Cartão"], ["pix_direto", "Pix direto"]] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${method === m ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--text-soft)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {method === "pix_direto" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No Pix direto, o plano é ativado somente depois que o médico confirmar o recebimento. O comprovante não confirma o pagamento automaticamente.
          </p>
        )}

        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
        {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}

        <button type="button" className="btn-gold mt-4 w-full" onClick={confirm} disabled={busy}>
          {busy ? "Processando…" : `Confirmar e pagar ${formatBRL(final)}`}
        </button>
      </div>
    </div>
  );
}
