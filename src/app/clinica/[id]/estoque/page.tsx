"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  STOCK_ADJUST_REASON_LABEL,
  STOCK_ADJUST_REASONS,
  STOCK_OUT_REASON_LABEL,
  STOCK_OUT_REASONS,
  STOCK_REQUEST_PRIORITY,
  STOCK_REQUEST_PRIORITY_LABEL,
  STOCK_STATUS_LABEL,
  categoryLabel,
  unitLabel,
  type StockStatus,
} from "@/lib/clinic-stock-labels";
import { CASH_ORIGIN_LABEL, EXPENSE_METHOD_LABEL } from "@/lib/clinic-cash-labels";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Perms = {
  stock_view: boolean;
  stock_out: boolean;
  stock_in: boolean;
  stock_request: boolean;
  stock_manage: boolean;
};
type Lot = { id: string; code: string; qty: number; expiresAt: string | null; manufacturedAt: string | null };
type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  minQty: number;
  idealQty: number;
  location: string | null;
  preferredSupplierId: string | null;
  notes: string | null;
  active: boolean;
  avgCostCents: number;
  lastPurchaseAt: string | null;
  status: StockStatus;
  lots: Lot[];
  nearestExpiry: string | null;
  expiry: "ok" | "90" | "60" | "30" | "expired";
};
type Supplier = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  productsNote: string | null;
  notes: string | null;
  active: boolean;
};
type RequestRow = {
  id: string;
  productId: string;
  qty: number;
  priority: string;
  reason: string | null;
  status: string;
  requestedByName: string;
  createdAt: string;
};
type Move = {
  id: string;
  productId: string;
  kind: string;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  supplierName: string | null;
  totalCents: number | null;
  expenseId: string | null;
  attachmentPath: string | null;
  occurredAt: string;
  actorName: string | null;
};
type Alert = { tone: "red" | "yellow"; text: string };
type CatalogItem = { key: string; label: string };

const STATUS_CLASS: Record<StockStatus, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
  baixo: "border-amber-200 bg-amber-50 text-amber-900",
  critico: "border-orange-200 bg-orange-50 text-orange-900",
  zerado: "border-red-200 bg-red-50 text-red-800",
};

const PANELS = [
  { id: "lista", label: "Estoque" },
  { id: "compras", label: "Compras" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "historico", label: "Histórico" },
  { id: "relatorios", label: "Relatórios" },
  { id: "config", label: "Ajustes" },
] as const;

export default function ClinicaEstoquePage() {
  const params = useParams<{ id: string }>();
  const clinicId = params.id;
  const [panel, setPanel] = useState<(typeof PANELS)[number]["id"]>("lista");
  const [perms, setPerms] = useState<Perms | null>(null);
  const [canAdmin, setCanAdmin] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState({ products: 0, low: 0, critical: 0, zero: 0, expiring: 0, monthPurchases: 0, monthSpentCents: 0 });
  const [cash, setCash] = useState(0);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [units, setUnits] = useState<CatalogItem[]>([]);
  const [settings, setSettings] = useState({ requireApproval: true, expiryAlertDays: [90, 60, 30] });
  const [clinics, setClinics] = useState<{ clinicId: string; clinicName: string }[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [prices, setPrices] = useState<{ occurredAt: string; unitCostCents: number; qty: number; supplierName: string | null }[]>([]);
  const [priceSum, setPriceSum] = useState<{ last: number | null; min: number | null; max: number | null; avg: number | null } | null>(null);
  const [invLines, setInvLines] = useState<{ productId: string; counted: string }[]>([]);
  const [invJust, setInvJust] = useState("");
  const [invPreview, setInvPreview] = useState(false);

  const [pForm, setPForm] = useState({
    name: "", category: "material_medico", unit: "pacote", qty: "0", minQty: "10", idealQty: "20",
    location: "", preferredSupplierId: "", notes: "", active: true,
  });
  const [inForm, setInForm] = useState({
    productId: "", qty: "", occurredAt: "", supplierId: "", supplierName: "", total: "", method: "dinheiro",
    origin: "conta_clinica", createExpense: "true", fromCash: false, confirmCash: false, invoiceNumber: "",
    notes: "", lotCode: "", manufacturedAt: "", expiresAt: "", requestId: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [outForm, setOutForm] = useState({ productId: "", qty: "", reason: "uso_clinica", notes: "", occurredAt: "" });
  const [adjForm, setAdjForm] = useState({ productId: "", countedQty: "", reason: "erro_contagem", notes: "" });
  const [reqForm, setReqForm] = useState({ productId: "", qty: "", priority: "normal", reason: "" });
  const [supForm, setSupForm] = useState({ name: "", document: "", phone: "", whatsapp: "", email: "", address: "", productsNote: "", notes: "" });
  const [trForm, setTrForm] = useState({ productId: "", qty: "", toClinicId: "", notes: "" });
  const [newCat, setNewCat] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [repKind, setRepKind] = useState("atual");
  const [repFrom, setRepFrom] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [repTo, setRepTo] = useState(new Date().toISOString().slice(0, 10));

  const showCosts = Boolean(perms?.stock_manage || canAdmin);
  const attentionCount = counts.low + counts.critical + counts.zero + counts.expiring;

  function load() {
    fetch(`/api/clinica/${clinicId}/estoque`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não carregou o estoque.");
        setPerms(d.staff?.perms || null);
        setCanAdmin(Boolean(d.staff?.canAdmin));
        setStaffName(d.staff?.name || "");
        setClinicName(d.clinic?.name || "");
        setProducts(d.products || []);
        setSuppliers(d.suppliers || []);
        setRequests(d.requests || []);
        setMoves(d.moves || []);
        setAlerts(d.alerts || []);
        setCounts(d.counts || counts);
        setCash(d.cashAvailableCents || 0);
        setCategories(d.catalog?.categories || []);
        setUnits(d.catalog?.units || []);
        setSettings(d.settings || settings);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }

  useEffect(() => {
    load();
    fetch("/api/clinica/minhas").then((r) => r.json()).then((d) => setClinics(d.clinics || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const productName = (id: string) => products.find((p) => p.id === id)?.name || id;
  const unitCost = useMemo(() => {
    const qty = Number(String(inForm.qty).replace(",", "."));
    const total = Math.round(Number(String(inForm.total).replace(",", ".")) * 100);
    if (!qty || !total) return 0;
    return Math.round(total / qty);
  }, [inForm.qty, inForm.total]);

  async function post(body: Record<string, string>, withFile = false) {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      let res: Response;
      if (withFile) {
        const data = new FormData();
        Object.entries(body).forEach(([k, v]) => data.set(k, v));
        if (file) data.set("attachment", file);
        res = await fetch(`/api/clinica/${clinicId}/estoque`, { method: "POST", body: data });
      } else {
        res = await fetch(`/api/clinica/${clinicId}/estoque`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não concluiu.");
      setMsg("Registrado.");
      setForm(null);
      setFile(null);
      load();
      return d;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function openPrices(p: Product) {
    setSelected(p);
    const q = new URLSearchParams({ productId: p.id });
    const r = await fetch(`/api/clinica/${clinicId}/estoque?${q}`);
    const d = await r.json();
    setPrices(d.prices || []);
    setPriceSum(d.priceSummary || null);
    setForm("preco");
  }

  const invDiffs = useMemo(() => {
    return invLines
      .map((l) => {
        const p = products.find((x) => x.id === l.productId);
        const counted = Number(String(l.counted).replace(",", "."));
        if (!p || !Number.isFinite(counted)) return null;
        const diff = Math.round((counted - p.qty) * 1000) / 1000;
        return { p, counted, diff };
      })
      .filter((x): x is { p: Product; counted: number; diff: number } => x !== null && x.diff !== 0);
  }, [invLines, products]);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Estoque</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {clinicName || "Clínica"} · materiais desta unidade. Compra, caixa e financeiro ficam vinculados na mesma ação.
      </p>

      {attentionCount > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          ⚠️ {attentionCount} {attentionCount === 1 ? "item precisa" : "itens precisam"} de atenção
        </div>
      )}
      <div className="mt-3 space-y-2">
        {alerts.map((a) => (
          <div key={a.text} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${a.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {a.tone === "red" ? "🔴" : "🟡"} {a.text}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produtos</p><p className="font-display text-2xl font-extrabold">{counts.products}</p></div>
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Estoque baixo</p><p className="font-display text-2xl font-extrabold">{counts.low}</p></div>
        <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Crítico / zerado</p><p className="font-display text-2xl font-extrabold">{counts.critical + counts.zero}</p></div>
        <div className="panel">
          <p className="text-xs uppercase text-[var(--text-muted)]">Compras no mês</p>
          <p className="font-display text-2xl font-extrabold">{counts.monthPurchases}</p>
          {showCosts && <p className="text-xs text-[var(--text-muted)]">{brl(counts.monthSpentCents)}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {perms?.stock_in && <button type="button" className="btn-gold min-h-12" onClick={() => { setInForm((f) => ({ ...f, occurredAt: f.occurredAt || todayInput() })); setForm("entrada"); }}> + Entrada</button>}
        {perms?.stock_out && <button type="button" className="btn-ghost min-h-12" onClick={() => setForm("saida")}>− Saída</button>}
        {perms?.stock_request && <button type="button" className="btn-ghost min-h-12" onClick={() => setForm("comprar")}>Comprar</button>}
        {perms?.stock_manage && <button type="button" className="btn-ghost min-h-12" onClick={() => { setInvLines(products.map((p) => ({ productId: p.id, counted: String(p.qty) }))); setInvPreview(false); setInvJust(""); setForm("inventario"); }}>Inventário</button>}
        {perms?.stock_manage && <button type="button" className="btn-ghost min-h-12" onClick={() => setForm("produto")}>+ Novo produto</button>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PANELS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${panel === t.id ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}

      {form === "produto" && (
        <form
          className="panel mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            post({
              action: "product",
              ...pForm,
              active: pForm.active ? "true" : "false",
            });
          }}
        >
          <h2 className="font-display text-lg font-bold sm:col-span-2">Novo produto</h2>
          <input className="input-field sm:col-span-2" required placeholder="Nome do produto" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
          <label>
            <span className="mb-1 block text-xs font-semibold">Categoria</span>
            <select className="input-field" value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Unidade</span>
            <select className="input-field" value={pForm.unit} onChange={(e) => setPForm({ ...pForm, unit: e.target.value })}>
              {units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </label>
          <input className="input-field" type="number" min="0" step="0.01" placeholder="Quantidade atual" value={pForm.qty} onChange={(e) => setPForm({ ...pForm, qty: e.target.value })} />
          <input className="input-field" type="number" min="0" step="0.01" placeholder="Quantidade mínima" value={pForm.minQty} onChange={(e) => setPForm({ ...pForm, minQty: e.target.value })} />
          <input className="input-field" type="number" min="0" step="0.01" placeholder="Quantidade ideal" value={pForm.idealQty} onChange={(e) => setPForm({ ...pForm, idealQty: e.target.value })} />
          <input className="input-field" placeholder="Localização física" value={pForm.location} onChange={(e) => setPForm({ ...pForm, location: e.target.value })} />
          <select className="input-field" value={pForm.preferredSupplierId} onChange={(e) => setPForm({ ...pForm, preferredSupplierId: e.target.value })}>
            <option value="">Fornecedor preferencial</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea className="input-field sm:col-span-2" placeholder="Observação" value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pForm.active} onChange={(e) => setPForm({ ...pForm, active: e.target.checked })} /> Produto ativo</label>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>{saving ? "Salvando…" : "Salvar produto"}</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "entrada" && (
        <form
          className="panel mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            post({
              action: "entrada",
              productId: inForm.productId,
              qty: inForm.qty,
              occurredAt: inForm.occurredAt ? new Date(inForm.occurredAt).toISOString() : new Date().toISOString(),
              supplierId: inForm.supplierId,
              supplierName: inForm.supplierName,
              total: inForm.total,
              method: inForm.fromCash ? "dinheiro" : inForm.method,
              origin: inForm.fromCash ? "caixa_fisico" : inForm.origin,
              createExpense: inForm.fromCash || inForm.createExpense === "true" ? "true" : "false",
              fromCash: inForm.fromCash ? "true" : "false",
              confirmCash: inForm.confirmCash ? "true" : "false",
              invoiceNumber: inForm.invoiceNumber,
              notes: inForm.notes,
              lotCode: inForm.lotCode,
              manufacturedAt: inForm.manufacturedAt,
              expiresAt: inForm.expiresAt,
              requestId: inForm.requestId,
            }, true);
          }}
        >
          <h2 className="font-display text-lg font-bold sm:col-span-2">Entrada de material</h2>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Produto</span>
            <select className="input-field" required value={inForm.productId} onChange={(e) => setInForm({ ...inForm, productId: e.target.value })}>
              <option value="">Escolha</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <input className="input-field" type="number" min="0.01" step="0.01" required placeholder="Quantidade" value={inForm.qty} onChange={(e) => setInForm({ ...inForm, qty: e.target.value })} />
          <input className="input-field" type="datetime-local" value={inForm.occurredAt} onChange={(e) => setInForm({ ...inForm, occurredAt: e.target.value })} />
          <select className="input-field" value={inForm.supplierId} onChange={(e) => setInForm({ ...inForm, supplierId: e.target.value })}>
            <option value="">Fornecedor cadastrado</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input-field" placeholder="Ou nome do fornecedor" value={inForm.supplierName} onChange={(e) => setInForm({ ...inForm, supplierName: e.target.value })} />
          <input className="input-field" type="number" min="0" step="0.01" placeholder="Valor total (R$)" value={inForm.total} onChange={(e) => setInForm({ ...inForm, total: e.target.value })} />
          <p className="self-center text-sm text-[var(--text-soft)]">Unitário: {brl(unitCost)}</p>
          <select className="input-field" value={inForm.method} onChange={(e) => setInForm({ ...inForm, method: e.target.value })} disabled={inForm.fromCash}>
            {Object.entries(EXPENSE_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-field" value={inForm.origin} onChange={(e) => setInForm({ ...inForm, origin: e.target.value })} disabled={inForm.fromCash}>
            {Object.entries(CASH_ORIGIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <fieldset className="sm:col-span-2 rounded-2xl border border-[var(--border)] p-3 text-sm">
            <legend className="px-1 text-xs font-bold">Essa compra deve gerar uma despesa no financeiro?</legend>
            <label className="mr-4"><input type="radio" name="exp" checked={inForm.createExpense === "true"} onChange={() => setInForm({ ...inForm, createExpense: "true" })} /> Sim</label>
            <label><input type="radio" name="exp" checked={inForm.createExpense === "false" && !inForm.fromCash} onChange={() => setInForm({ ...inForm, createExpense: "false", fromCash: false })} /> Não</label>
          </fieldset>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={inForm.fromCash} onChange={(e) => setInForm({ ...inForm, fromCash: e.target.checked, createExpense: e.target.checked ? "true" : inForm.createExpense, method: "dinheiro", origin: "caixa_fisico" })} />
            Dinheiro retirado do caixa
          </label>
          {inForm.fromCash && (
            <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p>Valor disponível no caixa: <strong>{brl(cash)}</strong></p>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={inForm.confirmCash} onChange={(e) => setInForm({ ...inForm, confirmCash: e.target.checked })} />
                Confirmar retirada de {inForm.total ? brl(Math.round(Number(String(inForm.total).replace(",", ".")) * 100)) : "R$ —"} do caixa?
              </label>
            </div>
          )}
          <input className="input-field" placeholder="Número da nota/comprovante" value={inForm.invoiceNumber} onChange={(e) => setInForm({ ...inForm, invoiceNumber: e.target.value })} />
          <input className="input-field" placeholder="Lote (se houver validade)" value={inForm.lotCode} onChange={(e) => setInForm({ ...inForm, lotCode: e.target.value })} />
          <label><span className="mb-1 block text-xs">Fabricação</span><input className="input-field" type="date" value={inForm.manufacturedAt} onChange={(e) => setInForm({ ...inForm, manufacturedAt: e.target.value })} /></label>
          <label><span className="mb-1 block text-xs">Validade</span><input className="input-field" type="date" value={inForm.expiresAt} onChange={(e) => setInForm({ ...inForm, expiresAt: e.target.value })} /></label>
          <input className="input-field sm:col-span-2" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <input className="input-field sm:col-span-2" placeholder="Observação" value={inForm.notes} onChange={(e) => setInForm({ ...inForm, notes: e.target.value })} />
          <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">Responsável: {staffName} · Clínica: {clinicName}</p>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving || (inForm.fromCash && !inForm.confirmCash)}>{saving ? "Registrando…" : "Confirmar entrada"}</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "saida" && (
        <form className="panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); post({ action: "saida", ...outForm, occurredAt: outForm.occurredAt ? new Date(outForm.occurredAt).toISOString() : new Date().toISOString() }); }}>
          <h2 className="font-display text-lg font-bold sm:col-span-2">Registrar saída</h2>
          <select className="input-field sm:col-span-2" required value={outForm.productId} onChange={(e) => setOutForm({ ...outForm, productId: e.target.value })}>
            <option value="">Produto</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.qty} {unitLabel(p.unit)})</option>)}
          </select>
          <input className="input-field" type="number" min="0.01" step="0.01" required placeholder="Quantidade" value={outForm.qty} onChange={(e) => setOutForm({ ...outForm, qty: e.target.value })} />
          <select className="input-field" value={outForm.reason} onChange={(e) => setOutForm({ ...outForm, reason: e.target.value })}>
            {STOCK_OUT_REASONS.map((r) => <option key={r} value={r}>{STOCK_OUT_REASON_LABEL[r]}</option>)}
          </select>
          <input className="input-field sm:col-span-2" placeholder="Observação" value={outForm.notes} onChange={(e) => setOutForm({ ...outForm, notes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>Salvar saída</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "comprar" && (
        <form className="panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); post({ action: "request", ...reqForm }); }}>
          <h2 className="font-display text-lg font-bold sm:col-span-2">Solicitar compra</h2>
          <select className="input-field sm:col-span-2" required value={reqForm.productId} onChange={(e) => setReqForm({ ...reqForm, productId: e.target.value })}>
            <option value="">Produto</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status !== "normal" ? " · atenção" : ""}</option>)}
          </select>
          <input className="input-field" type="number" min="0.01" step="0.01" required placeholder="Quantidade" value={reqForm.qty} onChange={(e) => setReqForm({ ...reqForm, qty: e.target.value })} />
          <select className="input-field" value={reqForm.priority} onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}>
            {STOCK_REQUEST_PRIORITY.map((p) => <option key={p} value={p}>{STOCK_REQUEST_PRIORITY_LABEL[p]}</option>)}
          </select>
          <input className="input-field sm:col-span-2" placeholder="Motivo" value={reqForm.reason} onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })} />
          <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">Solicitante: {staffName}</p>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>Enviar solicitação</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "ajuste" && (
        <form className="panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); post({ action: "ajuste", ...adjForm }); }}>
          <h2 className="font-display text-lg font-bold sm:col-span-2">Ajustar estoque</h2>
          <select className="input-field sm:col-span-2" required value={adjForm.productId} onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}>
            <option value="">Produto</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · sistema {p.qty}</option>)}
          </select>
          <input className="input-field" type="number" min="0" step="0.01" required placeholder="Contagem real" value={adjForm.countedQty} onChange={(e) => setAdjForm({ ...adjForm, countedQty: e.target.value })} />
          <select className="input-field" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}>
            {STOCK_ADJUST_REASONS.map((r) => <option key={r} value={r}>{STOCK_ADJUST_REASON_LABEL[r]}</option>)}
          </select>
          <input className="input-field sm:col-span-2" placeholder="Observação" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>Registrar ajuste</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "inventario" && (
        <form
          className="panel mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invPreview) { setInvPreview(true); return; }
            post({
              action: "inventory",
              lines: JSON.stringify(invLines.map((l) => ({ productId: l.productId, countedQty: Number(String(l.counted).replace(",", ".")) }))),
              justification: invJust,
            });
          }}
        >
          <h2 className="font-display text-lg font-bold">Realizar inventário</h2>
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead><tr className="text-xs uppercase text-[var(--text-muted)]"><th className="py-1">Produto</th><th>Sistema</th><th>Contagem real</th><th>Diferença</th></tr></thead>
              <tbody>
                {products.map((p) => {
                  const line = invLines.find((l) => l.productId === p.id);
                  const counted = Number(String(line?.counted ?? p.qty).replace(",", "."));
                  const diff = Math.round((counted - p.qty) * 1000) / 1000;
                  return (
                    <tr key={p.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-semibold">{p.name}</td>
                      <td>{p.qty}</td>
                      <td><input className="input-field !min-h-10 !py-1" value={line?.counted ?? ""} onChange={(e) => setInvLines((xs) => xs.map((x) => x.productId === p.id ? { ...x, counted: e.target.value } : x))} /></td>
                      <td className={diff ? "font-bold text-red-700" : ""}>{diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {invPreview && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
              {invDiffs.length === 0 ? <p>Nenhuma divergência.</p> : (
                <>
                  <p className="font-bold">{invDiffs.length} divergência(s) serão ajustadas:</p>
                  {invDiffs.map((d) => <p key={d.p.id}>{d.p.name}: {d.p.qty} → {d.counted} ({d.diff > 0 ? "+" : ""}{d.diff})</p>)}
                  <textarea className="input-field mt-2" required minLength={8} placeholder="Justificativa obrigatória" value={invJust} onChange={(e) => setInvJust(e.target.value)} />
                </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-gold" disabled={saving}>{invPreview ? "Confirmar inventário" : "Revisar diferenças"}</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "transfer" && (
        <form className="panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); post({ action: "transfer", ...trForm }); }}>
          <h2 className="font-display text-lg font-bold sm:col-span-2">Transferir estoque</h2>
          <p className="sm:col-span-2 text-sm text-[var(--text-muted)]">Não gera despesa. Só move material entre clínicas.</p>
          <select className="input-field sm:col-span-2" required value={trForm.productId} onChange={(e) => setTrForm({ ...trForm, productId: e.target.value })}>
            <option value="">Produto nesta clínica</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.qty})</option>)}
          </select>
          <input className="input-field" type="number" min="0.01" step="0.01" required placeholder="Quantidade" value={trForm.qty} onChange={(e) => setTrForm({ ...trForm, qty: e.target.value })} />
          <select className="input-field" required value={trForm.toClinicId} onChange={(e) => setTrForm({ ...trForm, toClinicId: e.target.value })}>
            <option value="">Clínica de destino</option>
            {clinics.filter((c) => c.clinicId !== clinicId).map((c) => <option key={c.clinicId} value={c.clinicId}>{c.clinicName}</option>)}
          </select>
          <input className="input-field sm:col-span-2" placeholder="Observação" value={trForm.notes} onChange={(e) => setTrForm({ ...trForm, notes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>Transferir</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "fornecedor" && (
        <form className="panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); post({ action: "supplier", ...supForm }); }}>
          <h2 className="font-display text-lg font-bold sm:col-span-2">Fornecedor</h2>
          <input className="input-field sm:col-span-2" required placeholder="Nome" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
          <input className="input-field" placeholder="CPF/CNPJ" value={supForm.document} onChange={(e) => setSupForm({ ...supForm, document: e.target.value })} />
          <input className="input-field" placeholder="Telefone" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
          <input className="input-field" placeholder="WhatsApp" value={supForm.whatsapp} onChange={(e) => setSupForm({ ...supForm, whatsapp: e.target.value })} />
          <input className="input-field" placeholder="E-mail" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
          <input className="input-field sm:col-span-2" placeholder="Endereço" value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} />
          <input className="input-field sm:col-span-2" placeholder="Produtos fornecidos" value={supForm.productsNote} onChange={(e) => setSupForm({ ...supForm, productsNote: e.target.value })} />
          <input className="input-field sm:col-span-2" placeholder="Observação" value={supForm.notes} onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" disabled={saving}>Salvar</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {form === "preco" && selected && (
        <div className="panel mt-4">
          <h2 className="font-display text-lg font-bold">{selected.name} · histórico de preço</h2>
          {priceSum && (
            <p className="mt-2 text-sm">Último {priceSum.last != null ? brl(priceSum.last) : "—"} · menor {priceSum.min != null ? brl(priceSum.min) : "—"} · maior {priceSum.max != null ? brl(priceSum.max) : "—"} · médio {priceSum.avg != null ? brl(priceSum.avg) : "—"}</p>
          )}
          <div className="mt-3 space-y-2 text-sm">
            {prices.length === 0 && <p className="text-[var(--text-muted)]">Ainda sem compras com valor.</p>}
            {prices.map((p, i) => (
              <p key={i}>{when(p.occurredAt)} · {brl(p.unitCostCents)} por {unitLabel(selected.unit)} · {p.supplierName || "—"}</p>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-3" onClick={() => setForm(null)}>Fechar</button>
        </div>
      )}

      {panel === "lista" && (
        <div className="mt-5 space-y-2">
          {products.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum produto nesta clínica. Cadastre o primeiro.</p>}
          {products.map((p) => (
            <div key={p.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-[var(--text-soft)]">{categoryLabel(p.category)} · {p.qty} {unitLabel(p.unit)} · mínimo {p.minQty}</p>
                  {showCosts && <p className="text-xs text-[var(--text-muted)]">Custo médio {p.avgCostCents ? brl(p.avgCostCents) : "—"} · última compra {when(p.lastPurchaseAt)}</p>}
                  {p.lots.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Lotes: {p.lots.map((l) => `${l.code} (${l.qty}${l.expiresAt ? `, val. ${l.expiresAt}` : ""})`).join(" · ")}
                    </p>
                  )}
                  {p.expiry !== "ok" && <p className="mt-1 text-xs font-semibold text-amber-800">{p.expiry === "expired" ? "Produto vencido" : `Atenção: vence em breve (${p.nearestExpiry})`}</p>}
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_CLASS[p.status]}`}>{STOCK_STATUS_LABEL[p.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {perms?.stock_in && <button type="button" className="rounded-full border px-3 py-1" onClick={() => { setInForm((f) => ({ ...f, productId: p.id, occurredAt: todayInput(), preferred: p.preferredSupplierId || "" })); setForm("entrada"); }}>+ Entrada</button>}
                {perms?.stock_out && <button type="button" className="rounded-full border px-3 py-1" onClick={() => { setOutForm({ ...outForm, productId: p.id }); setForm("saida"); }}>Saída</button>}
                {showCosts && <button type="button" className="rounded-full border px-3 py-1" onClick={() => openPrices(p)}>Preços</button>}
                {perms?.stock_manage && <button type="button" className="rounded-full border px-3 py-1" onClick={() => { setAdjForm({ ...adjForm, productId: p.id, countedQty: String(p.qty) }); setForm("ajuste"); }}>Ajustar</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {panel === "compras" && (
        <div className="mt-5 space-y-2">
          {requests.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma solicitação aberta.</p>}
          {requests.map((r) => (
            <div key={r.id} className="panel">
              <p className="font-bold">{productName(r.productId)} · {r.qty}</p>
              <p className="text-sm">{r.priority} · {r.status} · {r.requestedByName} · {when(r.createdAt)}</p>
              {r.reason && <p className="text-sm text-[var(--text-muted)]">{r.reason}</p>}
              {(canAdmin || perms?.stock_manage) && r.status === "solicitado" && (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-gold !min-h-10" onClick={() => post({ action: "decide", requestId: r.id, decision: "approve" })}>Aprovar</button>
                  <button type="button" className="btn-ghost !min-h-10" onClick={() => post({ action: "decide", requestId: r.id, decision: "reject" })}>Rejeitar</button>
                </div>
              )}
              {perms?.stock_in && r.status === "aprovado" && (
                <button type="button" className="btn-gold mt-2 !min-h-10" onClick={() => { setInForm((f) => ({ ...f, productId: r.productId, qty: String(r.qty), requestId: r.id, occurredAt: todayInput() })); setForm("entrada"); }}>Registrar compra</button>
              )}
            </div>
          ))}
        </div>
      )}

      {panel === "fornecedores" && (
        <div className="mt-5">
          {perms?.stock_manage && <button type="button" className="btn-gold mb-3" onClick={() => setForm("fornecedor")}>+ Fornecedor</button>}
          <div className="space-y-2">
            {suppliers.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum fornecedor.</p>}
            {suppliers.map((s) => (
              <div key={s.id} className="panel">
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-[var(--text-soft)]">{[s.document, s.phone, s.whatsapp, s.email].filter(Boolean).join(" · ")}</p>
                {s.productsNote && <p className="text-sm">{s.productsNote}</p>}
                {!s.active && <p className="text-xs text-red-700">Inativo</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {panel === "historico" && (
        <div className="mt-5 space-y-2">
          {moves.length === 0 && <p className="text-sm text-[var(--text-muted)]">Ainda sem movimentação.</p>}
          {moves.map((m) => (
            <div key={m.id} className="panel text-sm">
              <p className="font-bold">{productName(m.productId)} · {m.kind} {m.qty}</p>
              <p>{m.qtyBefore} → {m.qtyAfter} · {when(m.occurredAt)}</p>
              <p className="text-[var(--text-muted)]">{m.actorName || "—"} · {m.reason || ""} {m.supplierName ? `· ${m.supplierName}` : ""} {showCosts && m.totalCents ? `· ${brl(m.totalCents)}` : ""}</p>
              {(m.attachmentPath || m.expenseId) && <a className="text-[var(--gold)]" href={`/api/clinica/${clinicId}/estoque/arquivo?moveId=${m.id}`} target="_blank" rel="noreferrer">Comprovante</a>}
            </div>
          ))}
        </div>
      )}

      {panel === "relatorios" && (
        <div className="panel mt-5 grid gap-3 sm:grid-cols-2">
          <select className="input-field" value={repKind} onChange={(e) => setRepKind(e.target.value)}>
            {["atual", "entradas", "saidas", "perdas", "vencidos", "compras", "gastos", "precos"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select className="input-field" defaultValue="">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input className="input-field" type="date" value={repFrom} onChange={(e) => setRepFrom(e.target.value)} />
          <input className="input-field" type="date" value={repTo} onChange={(e) => setRepTo(e.target.value)} />
          <a className="btn-gold" href={`/api/clinica/${clinicId}/estoque/relatorio?kind=${repKind}&from=${repFrom}&to=${repTo}&format=pdf`} target="_blank" rel="noreferrer">Exportar PDF</a>
          <a className="btn-ghost" href={`/api/clinica/${clinicId}/estoque/relatorio?kind=${repKind}&from=${repFrom}&to=${repTo}&format=xlsx`}>Exportar Excel</a>
        </div>
      )}

      {panel === "config" && (canAdmin || perms?.stock_manage) && (
        <div className="mt-5 space-y-4">
          {canAdmin && (
            <form className="panel grid gap-3" onSubmit={(e) => { e.preventDefault(); post({ action: "settings", requireApproval: settings.requireApproval ? "true" : "false", expiryAlertDays: settings.expiryAlertDays.join(",") }); }}>
              <h2 className="font-display text-lg font-bold">Configuração</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.requireApproval} onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })} />
                Exigir aprovação da gestora antes da compra
              </label>
              <p className="text-xs text-[var(--text-muted)]">Alertas de validade (dias)</p>
              {[90, 60, 30].map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.expiryAlertDays.includes(d)}
                    onChange={(e) => setSettings((s) => ({ ...s, expiryAlertDays: e.target.checked ? [...s.expiryAlertDays, d] : s.expiryAlertDays.filter((x) => x !== d) }))}
                  />
                  {d} dias
                </label>
              ))}
              <button className="btn-gold" disabled={saving}>Salvar configuração</button>
            </form>
          )}
          {perms?.stock_manage && (
            <>
              <div className="panel grid gap-2 sm:grid-cols-2">
                <input className="input-field" placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                <button type="button" className="btn-ghost" onClick={() => { post({ action: "catalog", kind: "category", label: newCat }); setNewCat(""); }}>Criar categoria</button>
                <input className="input-field" placeholder="Nova unidade" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
                <button type="button" className="btn-ghost" onClick={() => { post({ action: "catalog", kind: "unit", label: newUnit }); setNewUnit(""); }}>Criar unidade</button>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setForm("ajuste")}>Ajustar estoque</button>
              <button type="button" className="btn-ghost ml-2" onClick={() => setForm("transfer")}>Transferir entre clínicas</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
