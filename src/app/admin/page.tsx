"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/scheduling-client";

type Doctor = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  crm: string;
  crmState?: string | null;
  rqe?: string | null;
  specialty: string;
  clinic?: string | null;
  consultationPriceCents: number;
  pixKey?: string | null;
  status: "pending" | "approved" | "rejected" | "suspended" | "correction";
  adminNote?: string | null;
  commissionPercent: number;
  platformPercent: number;
  payoutStatus: "active" | "pending" | "blocked";
  mpConnected: boolean;
  createdAt: string;
};

type FunnelSummary = {
  home_view: number;
  doctors_list_view: number;
  doctor_profile_open: number;
  schedule_click: number;
  slot_selected: number;
  payment_started: number;
  payment_completed: number;
  consultation_done: number;
  return_done: number;
  plan_hired: number;
  rates: Record<string, number | null>;
};

const PAYOUT_LABEL: Record<Doctor["payoutStatus"], string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
};

const TABS = [
  { id: "aguardando", label: "Aguardando aprovação", match: ["pending", "correction"] },
  { id: "aprovados", label: "Aprovados", match: ["approved"] },
  { id: "recusados", label: "Recusados", match: ["rejected"] },
  { id: "suspensos", label: "Suspensos", match: ["suspended"] },
  { id: "funil", label: "Funil", match: [] },
] as const;

const STATUS_LABEL: Record<Doctor["status"], string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
  correction: "Correção solicitada",
};

const FUNNEL_STEPS: { key: keyof Omit<FunnelSummary, "rates">; label: string }[] = [
  { key: "home_view", label: "Visitantes (Home)" },
  { key: "doctors_list_view", label: "Lista de médicos" },
  { key: "doctor_profile_open", label: "Perfil médico" },
  { key: "schedule_click", label: "Agenda" },
  { key: "slot_selected", label: "Horário escolhido" },
  { key: "payment_started", label: "Início pagamento" },
  { key: "payment_completed", label: "Pagamento concluído" },
  { key: "consultation_done", label: "Consulta realizada" },
  { key: "return_done", label: "Retorno" },
  { key: "plan_hired", label: "Acompanhamento" },
];

export default function AdminPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("aguardando");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [funnel, setFunnel] = useState<FunnelSummary | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/doctors");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setDoctors(data.doctors || []);
    setLoading(false);
  }, [router]);

  const loadFunnel = useCallback(async () => {
    const res = await fetch("/api/analytics");
    if (res.status === 401) return;
    const data = await res.json();
    setFunnel(data.summary || null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "funil") loadFunnel();
  }, [tab, loadFunnel]);

  async function setStatus(id: string, status: string, adminNote?: string) {
    await fetch("/api/admin/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminNote }),
    });
    await load();
  }

  async function setCommission(id: string, currentPercent: number) {
    const input = window.prompt("Percentual de repasse do médico (0–100):", String(currentPercent));
    if (input === null) return;
    const pct = Number(input.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      window.alert("Informe um número entre 0 e 100.");
      return;
    }
    const res = await fetch("/api/admin/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, commissionPercent: Math.round(pct) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Não foi possível alterar o percentual.");
    }
    await load();
  }

  async function setPayout(id: string, payoutStatus: "active" | "pending" | "blocked") {
    await fetch("/api/admin/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, payoutStatus }),
    });
    await load();
  }

  async function resetPassword(id: string, name: string) {
    const newPassword = window.prompt(`Nova senha para ${name} (mín. 6 caracteres):`);
    if (!newPassword) return;
    const res = await fetch("/api/admin/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newPassword }),
    });
    const data = await res.json();
    window.alert(res.ok ? "Senha redefinida com sucesso." : data.error || "Falha ao redefinir.");
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
  }

  const current = TABS.find((t) => t.id === tab)!;
  const list =
    tab === "funil"
      ? []
      : doctors.filter((d) => (current.match as readonly string[]).includes(d.status));
  const countFor = (t: (typeof TABS)[number]) =>
    t.id === "funil"
      ? 0
      : doctors.filter((d) => (t.match as readonly string[]).includes(d.status)).length;

  if (loading) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--gold)]">Administração</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Médicos cadastrados</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Fechar" : "+ Criar médico"}
          </button>
          <a href="/admin/empresa" className="btn-ghost">Dados da empresa</a>
          <a href="/admin/protocolos" className="btn-ghost">Protocolos CEAF</a>
          <a href="/admin/nutricionistas" className="btn-ghost">Nutricionistas</a>
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      {showCreate && <CreateDoctor onCreated={load} />}

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {t.label}
            {t.id !== "funil" ? ` (${countFor(t)})` : ""}
          </button>
        ))}
      </div>

      {tab === "funil" ? (
        <div className="mt-5 space-y-4">
          <div className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Funil de conversão</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Visitantes → perfil médico → agenda → pagamento → consulta → retorno
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Métricas de negócio — não interferem no prontuário clínico.
            </p>
          </div>
          {!funnel && <p className="text-[var(--text-muted)]">Carregando métricas…</p>}
          {funnel && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {FUNNEL_STEPS.map((s) => (
                  <div key={s.key} className="panel flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--text-soft)]">{s.label}</span>
                    <span className="text-xl font-extrabold text-[var(--text)]">
                      {Number(funnel[s.key] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="panel space-y-2 text-sm text-[var(--text-soft)]">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Taxas (%)</p>
                <p>Home → médicos: {fmtRate(funnel.rates.homeToDoctors)}</p>
                <p>Médicos → perfil: {fmtRate(funnel.rates.doctorsToProfile)}</p>
                <p>Perfil → agenda: {fmtRate(funnel.rates.profileToSchedule)}</p>
                <p>Agenda → horário: {fmtRate(funnel.rates.scheduleToSlot)}</p>
                <p>Horário → pagamento: {fmtRate(funnel.rates.slotToPayment)}</p>
                <p>Pagamento → pago: {fmtRate(funnel.rates.paymentToPaid)}</p>
                <p>Pago → consulta: {fmtRate(funnel.rates.paidToConsult)}</p>
                <p>Consulta → retorno: {fmtRate(funnel.rates.consultToReturn)}</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {list.length === 0 && <p className="text-[var(--text-muted)]">Nenhum médico nesta categoria.</p>}
          {list.map((d) => (
            <div key={d.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[var(--text)]">{d.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{d.specialty} · {STATUS_LABEL[d.status]}</p>
                </div>
                <p className="text-sm font-bold text-[var(--gold)]">{formatBRL(d.consultationPriceCents)}</p>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-[var(--text-soft)] sm:grid-cols-2">
                <p><span className="text-[var(--text-muted)]">E-mail:</span> {d.email}</p>
                <p><span className="text-[var(--text-muted)]">Telefone:</span> {d.phone || "—"}</p>
                <p><span className="text-[var(--text-muted)]">CRM:</span> {d.crm}{d.crmState ? ` / ${d.crmState}` : ""}</p>
                <p><span className="text-[var(--text-muted)]">RQE:</span> {d.rqe || "—"}</p>
                <p><span className="text-[var(--text-muted)]">Clínica:</span> {d.clinic || "—"}</p>
                <p><span className="text-[var(--text-muted)]">Solicitado em:</span> {new Date(d.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              {d.adminNote && (
                <p className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
                  Aviso ao médico: {d.adminNote}
                </p>
              )}

              <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Financeiro</p>
                <div className="mt-2 grid gap-1 text-sm text-[var(--text-soft)] sm:grid-cols-2">
                  <p><span className="text-[var(--text-muted)]">Valor da consulta:</span> {formatBRL(d.consultationPriceCents)}</p>
                  <p><span className="text-[var(--text-muted)]">Repasse do médico:</span> {d.commissionPercent}%</p>
                  <p><span className="text-[var(--text-muted)]">Parte da plataforma:</span> {d.platformPercent}%</p>
                  <p>
                    <span className="text-[var(--text-muted)]">Mercado Pago:</span>{" "}
                    {d.mpConnected ? "Conectado" : "Não conectado"}
                  </p>
                  <p>
                    <span className="text-[var(--text-muted)]">Recebimento:</span>{" "}
                    <span className={d.payoutStatus === "active" ? "font-semibold text-[var(--green,#0d9488)]" : "font-semibold text-[var(--danger)]"}>
                      {PAYOUT_LABEL[d.payoutStatus]}
                    </span>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setCommission(d.id, d.commissionPercent)}>
                    Alterar percentual
                  </button>
                  {d.payoutStatus !== "active" && (
                    <button type="button" className="btn-ghost" onClick={() => setPayout(d.id, "active")}>
                      Aprovar recebimento
                    </button>
                  )}
                  {d.payoutStatus !== "blocked" && (
                    <button type="button" className="btn-ghost" onClick={() => setPayout(d.id, "blocked")}>
                      Bloquear recebimento
                    </button>
                  )}
                  {d.payoutStatus !== "pending" && (
                    <button type="button" className="btn-ghost" onClick={() => setPayout(d.id, "pending")}>
                      Solicitar reconexão
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(d.status === "pending" || d.status === "correction" || d.status === "rejected") && (
                  <button type="button" className="btn-gold" onClick={() => setStatus(d.id, "approved")}>Aprovar médico</button>
                )}
                {(d.status === "pending" || d.status === "correction") && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        const note = window.prompt("O que precisa ser corrigido?") || "";
                        setStatus(d.id, "correction", note);
                      }}
                    >
                      Solicitar correção
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setStatus(d.id, "rejected")}>Recusar cadastro</button>
                  </>
                )}
                {d.status === "approved" && (
                  <button type="button" className="btn-ghost" onClick={() => setStatus(d.id, "suspended")}>Suspender acesso</button>
                )}
                {d.status === "suspended" && (
                  <button type="button" className="btn-gold" onClick={() => setStatus(d.id, "approved")}>Reativar acesso</button>
                )}
                <button type="button" className="btn-ghost" onClick={() => resetPassword(d.id, d.name)}>
                  Redefinir senha
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtRate(v: number | null | undefined) {
  return v == null ? "—" : `${v}%`;
}

function CreateDoctor({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", crm: "", crmState: "", specialty: "Nefrologia", clinic: "", pixKey: "", consultationPriceCents: "350" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSaving(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consultationPriceCents: Math.round(Number(form.consultationPriceCents) * 100) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar.");
      setMsg("Médico criado e aprovado.");
      setForm({ name: "", email: "", password: "", phone: "", crm: "", crmState: "", specialty: "Nefrologia", clinic: "", pixKey: "", consultationPriceCents: "350" });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["name", "Nome completo"],
    ["email", "E-mail"],
    ["password", "Senha"],
    ["phone", "Telefone"],
    ["crm", "CRM"],
    ["crmState", "UF do CRM"],
    ["specialty", "Especialidade"],
    ["clinic", "Clínica"],
    ["pixKey", "Chave Pix"],
  ] as const;

  return (
    <div className="panel mt-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Criar médico (já aprovado)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
            <input
              type={k === "password" ? "password" : "text"}
              className="input-field"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor (R$)</span>
          <input type="number" className="input-field" value={form.consultationPriceCents} onChange={(e) => set("consultationPriceCents", e.target.value)} />
        </label>
      </div>
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
      <button type="button" className="btn-gold" onClick={submit} disabled={saving || !form.name || !form.email || !form.password || !form.crm}>
        {saving ? "Criando…" : "Criar médico"}
      </button>
    </div>
  );
}
