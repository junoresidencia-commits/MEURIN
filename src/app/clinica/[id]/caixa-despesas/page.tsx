"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CASH_ORIGIN_LABEL,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_METHOD_LABEL,
  NFSE_STATUS_LABEL,
} from "@/lib/clinic-cash-labels";
import { CLINIC_CASH_ORIGINS, CLINIC_EXPENSE_CATEGORIES, CLINIC_EXPENSE_METHODS } from "@/lib/platform-types";
import { reportRangeFor, type ReportPeriodKey } from "@/lib/report-period";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

type Perms = {
  expense: boolean;
  close_cash: boolean;
  receipt: boolean;
  nfse_request: boolean;
  finance_view: boolean;
};
type Expense = {
  id: string;
  occurredAt: string;
  amountCents: number;
  category: keyof typeof EXPENSE_CATEGORY_LABEL;
  description: string;
  method: keyof typeof EXPENSE_METHOD_LABEL;
  origin: keyof typeof CASH_ORIGIN_LABEL;
  responsibleName: string;
  notes: string | null;
  attachmentPath: string | null;
  voidedAt: string | null;
};
type Flow = {
  openingCents: number;
  inCents: number;
  outCents: number;
  closingCents: number;
  byMethod: Record<string, { inCents: number; outCents: number }>;
};
type Session = {
  id: string;
  day: string;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  justification: string | null;
  closedByName: string | null;
  createdAt: string;
};
type Fiscal = {
  id: string;
  kind: string;
  status: string;
  patientName: string;
  amountCents: number;
  number: string | null;
  serviceLabel: string;
  doctorName: string | null;
  createdAt: string;
  pdfPath: string | null;
};

const TABS = [
  { id: "fluxo", label: "Fluxo" },
  { id: "despesas", label: "Despesas" },
  { id: "fechar", label: "Fechar caixa" },
  { id: "notas", label: "Notas" },
] as const;

export default function CaixaDespesasPage() {
  const params = useParams<{ id: string }>();
  const clinicId = params.id;
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("fluxo");
  const [perms, setPerms] = useState<Perms | null>(null);
  const [period, setPeriod] = useState<ReportPeriodKey>("hoje");
  const [from, setFrom] = useState(reportRangeFor("hoje").from);
  const [to, setTo] = useState(reportRangeFor("hoje").to);
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState("");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [preview, setPreview] = useState<{ expectedCents: number; openingCents: number; inCents: number; outCents: number; byMethod: Flow["byMethod"] } | null>(null);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [docs, setDocs] = useState<Fiscal[]>([]);
  const [nfseConfigured, setNfseConfigured] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counted, setCounted] = useState("");
  const [justification, setJustification] = useState("");
  const [form, setForm] = useState({
    occurredAt: "",
    amount: "",
    category: "material_medico",
    description: "",
    method: "dinheiro",
    origin: "caixa_fisico",
    responsibleName: "",
    locationLabel: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  function applyPeriod(key: ReportPeriodKey) {
    const r = reportRangeFor(key);
    setPeriod(key);
    setFrom(r.from);
    setTo(r.to);
  }

  function loadMe() {
    fetch(`/api/clinica/${clinicId}/me`)
      .then((r) => r.json())
      .then((d) => {
        setPerms(d.staff?.perms || null);
        setForm((f) => ({
          ...f,
          responsibleName: f.responsibleName || d.staff?.name || "",
          locationLabel: f.locationLabel || d.clinic?.name || "",
          occurredAt: f.occurredAt || toLocalInput(new Date()),
        }));
      })
      .catch(() => {});
  }

  function loadFlow() {
    const q = new URLSearchParams({ from, to, period });
    if (category) q.set("category", category);
    if (method) q.set("method", method);
    fetch(`/api/clinica/${clinicId}/fluxo-caixa?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não carregou o fluxo.");
        setFlow(d.flow);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }

  function loadExpenses() {
    const q = new URLSearchParams({ from, to });
    fetch(`/api/clinica/${clinicId}/despesas?${q}`)
      .then((r) => r.json())
      .then((d) => setExpenses(d.expenses || []))
      .catch(() => {});
  }

  function loadClose() {
    fetch(`/api/clinica/${clinicId}/fechamento-caixa?day=${from === to ? from : new Date().toISOString().slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setTodaySession(d.session || null);
        setPreview(d.preview || null);
      })
      .catch(() => {});
  }

  function loadFiscal() {
    fetch(`/api/clinica/${clinicId}/fiscal`)
      .then((r) => r.json())
      .then((d) => {
        setDocs(d.docs || []);
        setNfseConfigured(Boolean(d.nfseConfigured));
      })
      .catch(() => {});
  }

  useEffect(() => { loadMe(); }, [clinicId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadFlow();
    loadExpenses();
    loadClose();
    loadFiscal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, from, to, category, method]);

  const expected = preview?.expectedCents ?? 0;
  const countedCents = Math.round(Number(String(counted).replace(",", ".")) * 100) || 0;
  const diff = counted === "" ? null : countedCents - expected;

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const data = new FormData();
      data.set("occurredAt", form.occurredAt ? new Date(form.occurredAt).toISOString() : new Date().toISOString());
      data.set("amount", form.amount);
      data.set("category", form.category);
      data.set("description", form.description);
      data.set("method", form.method);
      data.set("origin", form.origin);
      data.set("responsibleName", form.responsibleName);
      data.set("locationLabel", form.locationLabel);
      data.set("notes", form.notes);
      if (file) data.set("attachment", file);
      const res = await fetch(`/api/clinica/${clinicId}/despesas`, { method: "POST", body: data });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não registrou.");
      setMsg("Despesa registrada. O caixa já considera esta saída.");
      setShowForm(false);
      setForm((f) => ({ ...f, amount: "", description: "", notes: "", occurredAt: toLocalInput(new Date()) }));
      setFile(null);
      loadFlow();
      loadExpenses();
      loadClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function submitClose(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/clinica/${clinicId}/fechamento-caixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counted, justification }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não fechou o caixa.");
      setMsg("Caixa fechado. O registro ficou no histórico.");
      setCounted("");
      setJustification("");
      loadClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function attachNf(docId: string, formEl: HTMLFormElement) {
    setSaving(true);
    setErr("");
    try {
      const data = new FormData(formEl);
      data.set("docId", docId);
      const res = await fetch(`/api/clinica/${clinicId}/fiscal`, { method: "PATCH", body: data });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não anexou.");
      setMsg("Nota marcada como emitida e vinculada ao paciente.");
      loadFiscal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const visibleExpenses = useMemo(
    () => expenses.filter((e) => !category || e.category === category),
    [expenses, category]
  );

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Caixa e despesas</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Check-in de paciente continua em Check-in. Fechamento de honorário do médico continua em Fechamentos.
        Aqui entra e sai o dinheiro da clínica.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${
              tab === t.id ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["hoje", "semana", "mes"] as ReportPeriodKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => applyPeriod(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              period === k ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"
            }`}
          >
            {k === "hoje" ? "Hoje" : k === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs">
          De
          <input className="input-field !py-1" type="date" value={from} onChange={(e) => { setPeriod("livre"); setFrom(e.target.value); }} />
        </label>
        <label className="flex items-center gap-1 text-xs">
          Até
          <input className="input-field !py-1" type="date" value={to} onChange={(e) => { setPeriod("livre"); setTo(e.target.value); }} />
        </label>
        <select className="input-field !py-1 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CLINIC_EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <select className="input-field !py-1 text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Todas as formas</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao">Cartão</option>
          <option value="outras">Outras</option>
        </select>
      </div>

      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}

      {tab === "fluxo" && flow && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[var(--text-soft)]">
            Saldo inicial + Entradas − Saídas = Saldo atual
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Saldo inicial</p><p className="font-display text-2xl font-extrabold">{brl(flow.openingCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Entradas</p><p className="font-display text-2xl font-extrabold">{brl(flow.inCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Saídas</p><p className="font-display text-2xl font-extrabold">{brl(flow.outCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Saldo atual</p><p className="font-display text-2xl font-extrabold">{brl(flow.closingCents)}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["dinheiro", "pix", "cartao", "outras"] as const).map((k) => (
              <div key={k} className="panel">
                <p className="text-xs uppercase text-[var(--text-muted)]">{k === "dinheiro" ? "Dinheiro" : k === "pix" ? "PIX" : k === "cartao" ? "Cartão" : "Outras formas"}</p>
                <p className="text-sm">Entrou {brl(flow.byMethod[k]?.inCents || 0)} · Saiu {brl(flow.byMethod[k]?.outCents || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "despesas" && (
        <div className="mt-5">
          {perms?.expense && (
            <button type="button" className="btn-gold min-h-12" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancelar" : "+ Registrar despesa / saída"}
            </button>
          )}
          {showForm && (
            <form onSubmit={submitExpense} className="panel mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold">Data e hora</span>
                <input className="input-field" type="datetime-local" required value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Valor (R$)</span>
                <input className="input-field" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Categoria</span>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CLINIC_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold">Descrição</span>
                <input className="input-field" required placeholder="Ex.: Compra de algodão" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Forma de pagamento</span>
                <select className="input-field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {CLINIC_EXPENSE_METHODS.map((m) => <option key={m} value={m}>{EXPENSE_METHOD_LABEL[m]}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Origem do dinheiro</span>
                <select className="input-field" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                  {CLINIC_CASH_ORIGINS.map((o) => <option key={o} value={o}>{CASH_ORIGIN_LABEL[o]}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Responsável</span>
                <input className="input-field" required value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">Clínica / local</span>
                <input className="input-field" value={form.locationLabel} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold">Observações</span>
                <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold">Comprovante (foto ou PDF, opcional)</span>
                <input className="input-field" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <button type="submit" className="btn-gold sm:col-span-2" disabled={saving}>{saving ? "Salvando…" : "Registrar saída"}</button>
            </form>
          )}
          <div className="mt-4 space-y-2">
            {visibleExpenses.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma despesa neste período.</p>}
            {visibleExpenses.map((e) => (
              <div key={e.id} className={`panel ${e.voidedAt ? "opacity-60" : ""}`}>
                <p className="text-xs text-[var(--text-muted)]">{when(e.occurredAt)}</p>
                <p className="font-bold">{e.description}{e.voidedAt ? " · corrigida" : ""}</p>
                <p className="text-sm">{brl(e.amountCents)} · {EXPENSE_METHOD_LABEL[e.method]} · {CASH_ORIGIN_LABEL[e.origin]}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {EXPENSE_CATEGORY_LABEL[e.category]} · Responsável: {e.responsibleName}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
                {e.attachmentPath && (
                  <a className="mt-1 inline-block text-sm font-semibold text-[var(--gold)]" href={`/api/clinica/${clinicId}/despesas/${e.id}/comprovante`} target="_blank" rel="noreferrer">
                    Ver comprovante
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "fechar" && (
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Sistema (caixa físico)</p><p className="font-display text-2xl font-extrabold">{brl(expected)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Diferença</p><p className="font-display text-2xl font-extrabold">{diff == null ? "—" : brl(diff)}</p></div>
          </div>
          {preview && (
            <p className="text-sm text-[var(--text-soft)]">
              Abertura {brl(preview.openingCents)} + dinheiro {brl(preview.inCents)} − saídas {brl(preview.outCents)}.
              PIX {brl(preview.byMethod.pix?.inCents || 0)} · Cartão {brl(preview.byMethod.cartao?.inCents || 0)}.
            </p>
          )}
          {todaySession ? (
            <div className="panel">
              <p className="font-bold">Caixa do dia já fechado</p>
              <p className="text-sm">Sistema {brl(todaySession.expectedCents)} · Contado {brl(todaySession.countedCents)} · Diferença {brl(todaySession.differenceCents)}</p>
              {todaySession.justification && <p className="text-sm">{todaySession.justification}</p>}
              <p className="text-xs text-[var(--text-muted)]">{todaySession.closedByName} · {when(todaySession.createdAt)}</p>
            </div>
          ) : perms?.close_cash ? (
            <form onSubmit={submitClose} className="panel grid gap-3">
              <label>
                <span className="mb-1 block text-xs font-semibold">Valor informado fisicamente (R$)</span>
                <input className="input-field" type="number" min="0" step="0.01" required value={counted} onChange={(e) => setCounted(e.target.value)} />
              </label>
              {diff != null && diff !== 0 && (
                <label>
                  <span className="mb-1 block text-xs font-semibold">Justificativa da diferença</span>
                  <input className="input-field" required minLength={8} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Obrigatório quando o valor não bate" />
                </label>
              )}
              <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Fechando…" : "Fechar caixa do dia"}</button>
            </form>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Sem permissão para fechar o caixa.</p>
          )}
          <h2 className="font-display text-xl font-bold">Histórico</h2>
          {sessions.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum fechamento ainda.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="panel">
              <p className="font-bold">{s.day.split("-").reverse().join("/")}</p>
              <p className="text-sm">Sistema {brl(s.expectedCents)} · Contado {brl(s.countedCents)} · Diferença {brl(s.differenceCents)}</p>
              {s.justification && <p className="text-sm">{s.justification}</p>}
              <p className="text-xs text-[var(--text-muted)]">{s.closedByName} · {when(s.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "notas" && (
        <div className="mt-5 space-y-2">
          <p className="text-sm text-[var(--text-muted)]">
            Recibo é gerado pelo sistema. NFS-e só existe com emissão fiscal válida
            {nfseConfigured ? " (provedor configurado)." : " — por enquanto a gestora solicita e anexa depois."}
          </p>
          {docs.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum recibo ou solicitação de nota ainda. Use o prontuário do paciente.</p>}
          {docs.map((d) => (
            <div key={d.id} className="panel">
              <p className="text-xs uppercase text-[var(--text-muted)]">{d.kind === "recibo" ? "Recibo" : "NFS-e"}</p>
              <p className="font-bold">{d.patientName}</p>
              <p className="text-sm">{brl(d.amountCents)} · {d.serviceLabel} · {d.kind === "recibo" ? d.number : (NFSE_STATUS_LABEL[d.status] || d.status)}</p>
              {d.doctorName && <p className="text-xs text-[var(--text-muted)]">{d.doctorName}</p>}
              {d.pdfPath && (
                <a className="mt-1 mr-3 inline-block text-sm font-semibold text-[var(--gold)]" href={`/api/clinica/${clinicId}/fiscal/${d.id}/arquivo`} target="_blank" rel="noreferrer">
                  Visualizar / baixar
                </a>
              )}
              {d.kind === "nfse" && d.status !== "issued" && d.status !== "cancelled" && perms?.nfse_request && (
                <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); attachNf(d.id, e.currentTarget); }}>
                  <input className="input-field" name="number" placeholder="Número da NFS-e" />
                  <input className="input-field" type="file" name="pdf" accept="application/pdf,image/*" />
                  <input className="input-field" type="file" name="xml" accept=".xml,application/xml,text/xml" />
                  <button type="submit" className="btn-gold" disabled={saving}>Marcar nota emitida</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
