"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { formatBRL } from "@/lib/scheduling-client";
import {
  PLAN_DURATIONS,
  PLAN_INCLUDED_ITEMS,
  effectivePromotionStatus,
  type Coupon,
  type DiscountType,
  type PlanEnrollment,
  type PlanTemplate,
  type Promotion,
} from "@/lib/plans";

type Tab = "planos" | "promocoes" | "cupons" | "acompanhamentos";

const DISCOUNT_LABEL: Record<DiscountType, string> = {
  percent: "Percentual (%)",
  fixed: "Valor fixo (R$)",
  promo_price: "Preço promocional (R$)",
};

const STATUS_BADGE: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-700",
  ativa: "bg-emerald-100 text-emerald-700",
  rascunho: "bg-slate-100 text-slate-600",
  pausado: "bg-amber-100 text-amber-700",
  pausada: "bg-amber-100 text-amber-700",
  agendada: "bg-sky-100 text-sky-700",
  encerrada: "bg-slate-100 text-slate-500",
  aguardando_pagamento: "bg-amber-100 text-amber-700",
  aguardando_confirmacao: "bg-amber-100 text-amber-700",
  suspenso: "bg-amber-100 text-amber-700",
  cancelado: "bg-rose-100 text-rose-700",
  expirado: "bg-slate-100 text-slate-500",
  concluido: "bg-sky-100 text-sky-700",
};

function discountText(type: DiscountType, value: number): string {
  if (type === "percent") return `${value}% de desconto`;
  if (type === "fixed") return `- ${formatBRL(value)}`;
  return `Preço: ${formatBRL(value)}`;
}

export default function PlanosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("planos");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanTemplate[]>([]);
  const [promotions, setPromotions] = useState<(Promotion & { effectiveStatus?: string })[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [enrollments, setEnrollments] = useState<PlanEnrollment[]>([]);

  async function loadAll() {
    const [p, pr, c, e] = await Promise.all([
      fetch("/api/doctor/plans").then((r) => r.json()),
      fetch("/api/doctor/promotions").then((r) => r.json()),
      fetch("/api/doctor/coupons").then((r) => r.json()),
      fetch("/api/doctor/enrollments").then((r) => r.json()),
    ]);
    setPlans(p.plans || []);
    setPromotions(pr.promotions || []);
    setCoupons(c.coupons || []);
    setEnrollments(e.enrollments || []);
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then(async (auth) => {
        if (!auth.doctor) {
          router.replace("/medicos/login");
          return;
        }
        await loadAll();
        setLoading(false);
      });
  }, [router]);

  const metrics = useMemo(() => {
    const active = enrollments.filter((e) => e.status === "ativo");
    const soon = active.filter(
      (e) => e.endAt && new Date(e.endAt).getTime() - Date.now() < 15 * 24 * 60 * 60 * 1000
    );
    const pendingConsults = active.reduce(
      (s, e) => s + Math.max(0, e.consultationsTotal - e.consultationsUsed),
      0
    );
    const revenue = enrollments
      .filter((e) => ["ativo", "concluido", "expirado", "suspenso"].includes(e.status))
      .reduce((s, e) => s + (e.pricing?.doctorAmountCents ?? 0), 0);
    return {
      activePlans: plans.filter((p) => p.status === "ativo").length,
      inCare: active.length,
      soon: soon.length,
      pendingConsults,
      revenue,
    };
  }, [plans, enrollments]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-8">
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Planos e promoções</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Você cria seus planos, promoções e cupons. O percentual de repasse é definido pela administração.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Metric label="Planos ativos" value={String(metrics.activePlans)} />
            <Metric label="Em acompanhamento" value={String(metrics.inCare)} />
            <Metric label="Próx. do vencimento" value={String(metrics.soon)} />
            <Metric label="Consultas pendentes" value={String(metrics.pendingConsults)} />
            <Metric label="Receita dos planos" value={formatBRL(metrics.revenue)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(["planos", "promocoes", "cupons", "acompanhamentos"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  tab === t
                    ? "bg-[var(--gold)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
                }`}
              >
                {t === "planos" ? "Planos" : t === "promocoes" ? "Promoções" : t === "cupons" ? "Cupons" : "Acompanhamentos"}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "planos" && <PlansTab plans={plans} reload={loadAll} />}
            {tab === "promocoes" && <PromotionsTab promotions={promotions} plans={plans} reload={loadAll} />}
            {tab === "cupons" && <CouponsTab coupons={coupons} plans={plans} reload={loadAll} />}
            {tab === "acompanhamentos" && <EnrollmentsTab enrollments={enrollments} reload={loadAll} />}
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------- Planos ----------

const emptyPlan = {
  name: "",
  description: "",
  price: "",
  duration: "6m",
  customDays: "30",
  consultations: "4",
  intervalSuggestion: "",
  modality: "teleconsulta",
  availability: "publico",
  status: "ativo",
  included: [] as string[],
  otherBenefits: "",
};

function PlansTab({ plans, reload }: { plans: PlanTemplate[]; reload: () => Promise<void> }) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyPlan });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function startCreate() {
    setEditId(null);
    setForm({ ...emptyPlan });
    setShow(true);
    setErr("");
  }
  function startEdit(p: PlanTemplate) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.priceCents / 100),
      duration: p.duration,
      customDays: String(p.customDays || 30),
      consultations: String(p.consultations),
      intervalSuggestion: p.intervalSuggestion || "",
      modality: p.modality,
      availability: p.availability,
      status: p.status,
      included: [...p.included],
      otherBenefits: p.otherBenefits || "",
    });
    setShow(true);
    setErr("");
  }

  function toggleIncluded(key: string) {
    setForm((f) => ({
      ...f,
      included: f.included.includes(key) ? f.included.filter((k) => k !== key) : [...f.included, key],
    }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    const payload = {
      id: editId || undefined,
      name: form.name,
      description: form.description,
      priceCents: Math.round(Number(form.price.replace(",", ".")) * 100),
      duration: form.duration,
      customDays: Number(form.customDays),
      consultations: Number(form.consultations),
      intervalSuggestion: form.intervalSuggestion,
      modality: form.modality,
      availability: form.availability,
      status: form.status,
      included: form.included,
      otherBenefits: form.otherBenefits,
    };
    const res = await fetch("/api/doctor/plans", {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setShow(false);
      await reload();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Não foi possível salvar.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este plano? (contratações existentes são mantidas)")) return;
    await fetch(`/api/doctor/plans?id=${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div>
      <button type="button" className="btn-gold" onClick={startCreate}>
        + Criar plano
      </button>

      {show && (
        <div className="panel mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do plano">
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acompanhamento Renal" />
            </Field>
            <Field label="Valor (R$)">
              <input type="number" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Duração">
              <select className="input-field" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                {PLAN_DURATIONS.map((d) => (
                  <option key={d.kind} value={d.kind}>{d.label}</option>
                ))}
                <option value="custom">Personalizado</option>
              </select>
            </Field>
            {form.duration === "custom" && (
              <Field label="Dias (personalizado)">
                <input type="number" className="input-field" value={form.customDays} onChange={(e) => setForm({ ...form, customDays: e.target.value })} />
              </Field>
            )}
            <Field label="Qtd. de consultas">
              <input type="number" className="input-field" value={form.consultations} onChange={(e) => setForm({ ...form, consultations: e.target.value })} />
            </Field>
            <Field label="Intervalo sugerido">
              <input className="input-field" value={form.intervalSuggestion} onChange={(e) => setForm({ ...form, intervalSuggestion: e.target.value })} placeholder="A cada 6 semanas" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Modalidade">
              <select className="input-field" value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
                <option value="teleconsulta">Teleconsulta</option>
                <option value="presencial">Presencial</option>
                <option value="ambas">Ambas</option>
              </select>
            </Field>
            <Field label="Disponibilidade">
              <select className="input-field" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })}>
                <option value="publico">Público para meus pacientes</option>
                <option value="selecionados">Apenas selecionados</option>
                <option value="convite">Somente por convite</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ativo">Ativo</option>
                <option value="rascunho">Rascunho</option>
                <option value="pausado">Pausado</option>
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">O que está incluído</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PLAN_INCLUDED_ITEMS.map((i) => (
                <label key={i.key} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input type="checkbox" checked={form.included.includes(i.key)} onChange={() => toggleIncluded(i.key)} />
                  {i.label}
                </label>
              ))}
            </div>
          </div>
          <Field label="Outros benefícios (texto livre)">
            <textarea className="input-field" rows={2} value={form.otherBenefits} onChange={(e) => setForm({ ...form, otherBenefits: e.target.value })} />
          </Field>
          <p className="rounded-lg bg-[var(--gold-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
            Este plano não substitui atendimento de urgência ou emergência.
          </p>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-gold" onClick={save} disabled={saving || !form.name}>
              {saving ? "Salvando…" : editId ? "Salvar alterações" : "Criar plano"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {plans.length === 0 && <p className="text-[var(--text-muted)]">Nenhum plano criado ainda.</p>}
        {plans.map((p) => (
          <div key={p.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-[var(--text)]">{p.name}</p>
                  <Badge status={p.status} />
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {p.consultations} consultas · {PLAN_DURATIONS.find((d) => d.kind === p.duration)?.label || `${p.customDays} dias`}
                </p>
                {p.description && <p className="mt-1 text-sm text-[var(--text-soft)]">{p.description}</p>}
              </div>
              <p className="text-lg font-bold text-[var(--gold)]">{formatBRL(p.priceCents)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => startEdit(p)}>Editar</button>
              <button type="button" className="btn-ghost" onClick={() => remove(p.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Promoções ----------

function PromotionsTab({
  promotions,
  plans,
  reload,
}: {
  promotions: (Promotion & { effectiveStatus?: string })[];
  plans: PlanTemplate[];
  reload: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "all_plans",
    discountType: "percent" as DiscountType,
    discountValue: "10",
    startAt: "",
    endAt: "",
    planIds: [] as string[],
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setErr("");
    const value =
      form.discountType === "percent"
        ? Number(form.discountValue)
        : Math.round(Number(form.discountValue.replace(",", ".")) * 100);
    const res = await fetch("/api/doctor/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        scope: form.scope,
        planIds: form.planIds,
        discountType: form.discountType,
        discountValue: value,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShow(false);
      setForm({ name: "", description: "", scope: "all_plans", discountType: "percent", discountValue: "10", startAt: "", endAt: "", planIds: [] });
      await reload();
    } else {
      setErr((await res.json().catch(() => ({}))).error || "Erro ao criar.");
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/doctor/promotions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    await reload();
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir promoção?")) return;
    await fetch(`/api/doctor/promotions?id=${id}`, { method: "DELETE" });
    await reload();
  }
  async function duplicate(p: Promotion) {
    await fetch("/api/doctor/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${p.name} (cópia)`, description: p.description, scope: p.scope, planIds: p.planIds, discountType: p.discountType, discountValue: p.discountValue, startAt: p.startAt, endAt: p.endAt, status: "pausada" }),
    });
    await reload();
  }

  return (
    <div>
      <button type="button" className="btn-gold" onClick={() => setShow((v) => !v)}>+ Criar promoção</button>
      {show && (
        <div className="panel mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mês da Nefrologia" /></Field>
            <Field label="Onde aplicar">
              <select className="input-field" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="consulta">Consulta avulsa</option>
                <option value="all_plans">Todos os planos</option>
                <option value="consulta_plans">Consulta + planos</option>
                <option value="selected_plans">Planos específicos</option>
              </select>
            </Field>
          </div>
          {form.scope === "selected_plans" && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input type="checkbox" checked={form.planIds.includes(p.id)} onChange={() => setForm((f) => ({ ...f, planIds: f.planIds.includes(p.id) ? f.planIds.filter((x) => x !== p.id) : [...f.planIds, p.id] }))} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <Field label="Descrição"><input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="10% de desconto durante o Mês da Nefrologia" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de desconto">
              <select className="input-field" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}>
                {Object.entries(DISCOUNT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={form.discountType === "percent" ? "Percentual (%)" : "Valor (R$)"}>
              <input type="number" className="input-field" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Início"><input type="datetime-local" className="input-field" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
            <Field label="Término (vazio = sem fim)"><input type="datetime-local" className="input-field" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Field>
          </div>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-gold" onClick={create} disabled={saving || !form.name}>{saving ? "Criando…" : "Criar promoção"}</button>
            <button type="button" className="btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {promotions.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma promoção.</p>}
        {promotions.map((p) => {
          const eff = p.effectiveStatus || effectivePromotionStatus(p);
          return (
            <div key={p.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[var(--text)]">{p.name}</p>
                    <Badge status={eff} />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">{discountText(p.discountType, p.discountValue)}</p>
                  {(p.startAt || p.endAt) && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {p.startAt ? new Date(p.startAt).toLocaleDateString("pt-BR") : "—"} → {p.endAt ? new Date(p.endAt).toLocaleDateString("pt-BR") : "sem fim"}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.status !== "pausada" && <button type="button" className="btn-ghost" onClick={() => patch(p.id, { status: "pausada" })}>Pausar</button>}
                {p.status === "pausada" && <button type="button" className="btn-ghost" onClick={() => patch(p.id, { status: "ativa" })}>Reativar</button>}
                {p.status !== "encerrada" && <button type="button" className="btn-ghost" onClick={() => patch(p.id, { status: "encerrada" })}>Encerrar</button>}
                <button type="button" className="btn-ghost" onClick={() => duplicate(p)}>Duplicar</button>
                <button type="button" className="btn-ghost" onClick={() => remove(p.id)}>Excluir</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Cupons ----------

function CouponsTab({ coupons, plans, reload }: { coupons: Coupon[]; plans: PlanTemplate[]; reload: () => Promise<void> }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percent" as DiscountType,
    discountValue: "10",
    scope: "all_plans",
    startAt: "",
    endAt: "",
    maxRedemptions: "",
    perPatientOnce: true,
    newPatientsOnly: false,
    planIds: [] as string[],
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setErr("");
    const value = form.discountType === "percent" ? Number(form.discountValue) : Math.round(Number(form.discountValue.replace(",", ".")) * 100);
    const res = await fetch("/api/doctor/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        discountType: form.discountType,
        discountValue: value,
        scope: form.scope,
        planIds: form.planIds,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
        maxRedemptions: form.maxRedemptions || undefined,
        perPatientOnce: form.perPatientOnce,
        newPatientsOnly: form.newPatientsOnly,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShow(false);
      setForm({ code: "", discountType: "percent", discountValue: "10", scope: "all_plans", startAt: "", endAt: "", maxRedemptions: "", perPatientOnce: true, newPatientsOnly: false, planIds: [] });
      await reload();
    } else {
      setErr((await res.json().catch(() => ({}))).error || "Erro ao criar.");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir cupom?")) return;
    await fetch(`/api/doctor/coupons?id=${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div>
      <button type="button" className="btn-gold" onClick={() => setShow((v) => !v)}>+ Criar cupom</button>
      {show && (
        <div className="panel mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código"><input className="input-field uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="NEFRO10" /></Field>
            <Field label="Onde aplicar">
              <select className="input-field" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="consulta">Consulta avulsa</option>
                <option value="all_plans">Todos os planos</option>
                <option value="consulta_plans">Consulta + planos</option>
                <option value="selected_plans">Planos específicos</option>
              </select>
            </Field>
          </div>
          {form.scope === "selected_plans" && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input type="checkbox" checked={form.planIds.includes(p.id)} onChange={() => setForm((f) => ({ ...f, planIds: f.planIds.includes(p.id) ? f.planIds.filter((x) => x !== p.id) : [...f.planIds, p.id] }))} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de desconto">
              <select className="input-field" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}>
                {Object.entries(DISCOUNT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={form.discountType === "percent" ? "Percentual (%)" : "Valor (R$)"}>
              <input type="number" className="input-field" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Início"><input type="datetime-local" className="input-field" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
            <Field label="Término"><input type="datetime-local" className="input-field" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Field>
            <Field label="Limite total de usos"><input type="number" className="input-field" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="ilimitado" /></Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]"><input type="checkbox" checked={form.perPatientOnce} onChange={(e) => setForm({ ...form, perPatientOnce: e.target.checked })} /> Uma vez por paciente</label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]"><input type="checkbox" checked={form.newPatientsOnly} onChange={(e) => setForm({ ...form, newPatientsOnly: e.target.checked })} /> Apenas novos pacientes</label>
          </div>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-gold" onClick={create} disabled={saving || !form.code}>{saving ? "Criando…" : "Criar cupom"}</button>
            <button type="button" className="btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {coupons.length === 0 && <p className="text-[var(--text-muted)]">Nenhum cupom.</p>}
        {coupons.map((c) => (
          <div key={c.id} className="panel flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-lg font-bold text-[var(--text)]">{c.code}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {discountText(c.discountType, c.discountValue)} · usos: {c.redemptions}{c.maxRedemptions ? `/${c.maxRedemptions}` : ""}
                {c.newPatientsOnly ? " · novos pacientes" : ""}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => remove(c.id)}>Excluir</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Acompanhamentos ----------

function EnrollmentsTab({ enrollments, reload }: { enrollments: PlanEnrollment[]; reload: () => Promise<void> }) {
  async function action(id: string, act: string) {
    if ((act === "cancel" || act === "suspend") && !window.confirm("Confirmar ação?")) return;
    await fetch("/api/doctor/enrollments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: act }) });
    await reload();
  }

  return (
    <div className="grid gap-3">
      {enrollments.length === 0 && <p className="text-[var(--text-muted)]">Nenhuma contratação ainda.</p>}
      {enrollments.map((e) => (
        <div key={e.id} className="panel">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-[var(--text)]">{e.patientName}</p>
                <Badge status={e.status} />
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {e.planName} · {e.consultationsUsed}/{e.consultationsTotal} consultas · {formatBRL(e.pricing.finalPriceCents)}
                {e.pricing.appliedLabel ? ` · ${e.pricing.appliedLabel}` : ""}
              </p>
              {e.endAt && <p className="text-xs text-[var(--text-muted)]">Válido até {new Date(e.endAt).toLocaleDateString("pt-BR")}</p>}
              <p className="text-xs text-[var(--text-muted)]">
                Pagamento: {e.paymentMethod === "pix_direto" ? "Pix direto" : e.paymentMethod === "card" ? "Cartão" : "Pix"} · repasse {e.pricing.doctorPercent}% ({formatBRL(e.pricing.doctorAmountCents)})
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {e.status === "aguardando_confirmacao" && e.paymentMethod === "pix_direto" && (
              <button type="button" className="btn-gold" onClick={() => action(e.id, "confirm_pix")}>Confirmar recebimento (Pix)</button>
            )}
            {e.status === "ativo" && (
              <button type="button" className="btn-ghost" onClick={() => action(e.id, "use_consultation")}>Registrar consulta usada</button>
            )}
            {e.status === "ativo" && <button type="button" className="btn-ghost" onClick={() => action(e.id, "suspend")}>Suspender</button>}
            {e.status === "suspenso" && <button type="button" className="btn-ghost" onClick={() => action(e.id, "reactivate")}>Reativar</button>}
            {["ativo", "suspenso", "aguardando_confirmacao", "aguardando_pagamento"].includes(e.status) && (
              <button type="button" className="btn-ghost" onClick={() => action(e.id, "cancel")}>Cancelar</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
