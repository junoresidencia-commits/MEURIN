"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type Track = { key: string; label: string; unit: string; total: number; goal: number | null; status: "verde" | "amarelo" | "vermelho" | "estimativa"; pct: number | null };
type Entry = { id: string; kind: "alimento" | "liquido"; meal?: string | null; timeLabel?: string | null; food: string; grams?: number | null; volumeMl?: number | null; household?: string | null; nutrients: Record<string, number>; note?: string | null; photoUrl?: string | null };
type Alert = { key: string; status: string; label: string; message: string | null; contributors: { food: string; value: number }[] };
type Goals = { targets: Record<string, number | null>; note?: string | null; nutritionistName?: string | null } | null;
type Food = { id: string; name: string; state?: string; source: string; measure?: string; measureGrams?: number; kcal: number; protein_g: number; potassium_mg: number; phosphorus_mg: number; sodium_mg: number };
type PlanItem = { food?: string; grams?: number | string; household?: string; note?: string };
type PlanMeal = { name?: string; time?: string; items?: PlanItem[] };
type Plan = { meals: PlanMeal[]; waterMl?: number | string | null; notes?: string | null; validUntil?: string | null; totals?: Record<string, number> | null } | null;
type PlanResp = { plan: Plan; nutritionistName?: string | null; createdAt?: string; pdfUrl?: string | null };

const LIGHT: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  verde: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Dentro da meta" },
  amarelo: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Próximo do limite" },
  vermelho: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Acima da meta" },
  estimativa: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Estimativa" },
};

export default function PacienteNutricaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attention, setAttention] = useState<{ key: string; level: string; title: string; message: string }[]>([]);
  const [goals, setGoals] = useState<Goals>(null);
  const [hasGoals, setHasGoals] = useState(false);
  const [date, setDate] = useState("");
  const [plan, setPlan] = useState<PlanResp | null>(null);

  // formulário
  const [kind, setKind] = useState<"alimento" | "liquido">("alimento");
  const [foodQ, setFoodQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [meal, setMeal] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // leitor de rótulo
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelFields, setLabelFields] = useState<Record<string, string | boolean> | null>(null);
  const [labelMsg, setLabelMsg] = useState("");
  // consultas de nutrição
  const [appts, setAppts] = useState<{ id: string; status: string; priceCents: number; slotStart?: string | null; pixCopiaCola?: string | null; modality?: string }[]>([]);
  const [apptMsg, setApptMsg] = useState("");
  // comparar alimentos
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpQ, setCmpQ] = useState("");
  const [cmpFoods, setCmpFoods] = useState<Food[]>([]);
  const [cmpA, setCmpA] = useState<Food | null>(null);
  const [cmpB, setCmpB] = useState<Food | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/nutrition/diary");
    if (res.status === 401) { router.replace("/paciente/entrar"); return; }
    const d = await res.json();
    setEntries(d.entries || []);
    setTracks(d.tracks || []);
    setAlerts(d.alerts || []);
    setAttention(d.attention || []);
    setGoals(d.goals || null);
    setHasGoals(Boolean(d.hasGoals));
    setDate(d.date || "");
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/patient/nutrition/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.plan) setPlan(d); })
      .catch(() => {});
  }, []);

  const loadAppts = useCallback(async () => {
    const r = await fetch("/api/patient/nutrition/appointments");
    if (!r.ok) return;
    const d = await r.json();
    setAppts(d.appointments || []);
  }, []);
  useEffect(() => { loadAppts(); }, [loadAppts]);

  async function sendProof(id: string, file: File) {
    if (file.size > 1400000) { setApptMsg("Comprovante muito grande (máx. ~1,4 MB)."); return; }
    setApptMsg("");
    const dataUrl: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result || "")); rd.onerror = rej; rd.readAsDataURL(file); });
    const resp = await fetch("/api/patient/nutrition/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, proofUrl: dataUrl }) });
    if (resp.ok) { setApptMsg("Comprovante enviado. A nutricionista vai confirmar."); await loadAppts(); }
    else { const d = await resp.json().catch(() => ({})); setApptMsg(d.error || "Erro ao enviar."); }
  }
  function copyPix(code: string) { navigator.clipboard?.writeText(code); setApptMsg("Pix copiado!"); setTimeout(() => setApptMsg(""), 1500); }

  useEffect(() => {
    if (kind !== "alimento") return;
    const t = setTimeout(() => {
      fetch(`/api/nutrition/foods?q=${encodeURIComponent(foodQ)}`).then((r) => r.json()).then((d) => setFoods(d.foods || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [foodQ, kind]);

  useEffect(() => {
    if (!cmpOpen) return;
    const t = setTimeout(() => {
      fetch(`/api/nutrition/foods?q=${encodeURIComponent(cmpQ)}`).then((r) => r.json()).then((d) => setCmpFoods(d.foods || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [cmpQ, cmpOpen]);

  function pick(f: Food) {
    setPicked(f); setFoodName(f.name + (f.state ? ` (${f.state})` : "")); setGrams(String(f.measureGrams || 100)); setFoodQ("");
  }
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 800000) { setErr("Foto muito grande (máx. ~800 KB)."); return; }
    const r = new FileReader(); r.onload = () => setPhoto(String(r.result || "")); r.readAsDataURL(f);
  }

  async function add() {
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { kind, meal, timeLabel, note, photoUrl: photo || undefined };
      if (kind === "alimento") { body.foodId = picked?.id; body.food = foodName; body.grams = grams; }
      else { body.food = foodName || "Água"; body.volumeMl = volumeMl; }
      const res = await fetch("/api/patient/nutrition/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setPicked(null); setFoodName(""); setGrams(""); setVolumeMl(""); setMeal(""); setTimeLabel(""); setNote(""); setPhoto("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }
  async function del(id: string) {
    await fetch(`/api/patient/nutrition/diary?id=${id}`, { method: "DELETE" });
    await load();
  }
  async function readLabel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2000000) { setLabelMsg("Foto muito grande (máx. ~2 MB)."); return; }
    setLabelBusy(true); setLabelMsg("");
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = rej; r.readAsDataURL(f); });
      const resp = await fetch("/api/patient/nutrition/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(d.error || "Erro ao ler rótulo.");
      setLabelFields(d.fields || {});
      setLabelMsg(d.note || (d.manual ? "Confira e preencha os dados do rótulo." : "Confira os dados lidos antes de adicionar."));
    } catch (er) { setLabelMsg(er instanceof Error ? er.message : "Erro"); }
    finally { setLabelBusy(false); }
  }
  function setLF(k: string, v: string | boolean) { setLabelFields((f) => ({ ...(f || {}), [k]: v })); }
  async function saveLabel() {
    if (!labelFields) return;
    const f = labelFields;
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
    const nutrients: Record<string, number> = {};
    for (const [src, dst] of [["sodium_mg", "sodium_mg"], ["protein_g", "protein_g"], ["carb_g", "carb_g"], ["fat_g", "fat_g"], ["potassium_mg", "potassium_mg"], ["phosphorus_mg", "phosphorus_mg"]] as const) {
      const val = num(f[src]); if (val !== undefined) nutrients[dst] = val;
    }
    const noteBits = [f.additivesPhosphorus ? "aditivo de fósforo" : "", f.additivesPotassium ? "sal de potássio" : ""].filter(Boolean).join("; ");
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/patient/nutrition/diary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "alimento", food: String(f.food || "Produto (rótulo)"), grams: num(f.portion_g) || 100, nutrients, note: `via rótulo${noteBits ? " — " + noteBits : ""}` }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Erro"); }
      setLabelFields(null); setLabelMsg("");
      await load();
    } catch (er) { setErr(er instanceof Error ? er.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Meu diário alimentar</p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">O que comi e bebi hoje</h1>
        </div>
        <Link href="/paciente/nutricao/educacao" className="btn-ghost text-sm">Entenda sua alimentação →</Link>
      </div>

      {/* Plano alimentar da nutricionista (interativo) */}
      {plan?.plan && (
        <section className="mt-5 overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-gradient-to-br from-[var(--gold-soft)] to-white shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Seu plano alimentar</p>
              <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Prescrito pela sua nutricionista</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {plan.nutritionistName ? `Por ${plan.nutritionistName}` : "Plano individualizado"}
                {plan.createdAt ? ` · ${new Date(plan.createdAt).toLocaleDateString("pt-BR")}` : ""}
                {plan.plan.validUntil ? ` · revisão: ${plan.plan.validUntil}` : ""}
              </p>
            </div>
            {plan.pdfUrl && (
              <a href={plan.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">Ver PDF</a>
            )}
          </div>

          <div className="mt-3 grid gap-2 px-5">
            {plan.plan.meals.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">O plano foi liberado. Toque em “Ver PDF” para os detalhes.</p>
            )}
            {plan.plan.meals.map((m, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-white p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                  {m.time && <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-bold text-[var(--gold)]">{m.time}</span>}
                  {m.name || `Refeição ${i + 1}`}
                </p>
                {Array.isArray(m.items) && m.items.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {m.items.map((it, j) => (
                      <li key={j} className="flex items-baseline justify-between gap-3 text-sm text-[var(--text-soft)]">
                        <span>• {it.food}{it.note ? <span className="text-xs text-[var(--text-muted)]"> — {it.note}</span> : null}</span>
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">{it.grams ? `${it.grams} g` : ""}{it.household ? ` · ${it.household}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">—</p>
                )}
              </div>
            ))}
          </div>

          {(plan.plan.waterMl || plan.plan.totals || plan.plan.notes) && (
            <div className="mt-3 px-5 pb-5">
              {plan.plan.waterMl ? (
                <p className="text-sm text-[var(--text-soft)]"><b>Líquidos:</b> {plan.plan.waterMl} mL/dia</p>
              ) : null}
              {plan.plan.totals && Object.keys(plan.plan.totals).length > 0 && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Estimativa diária: {plan.plan.totals.kcal ? `${plan.plan.totals.kcal} kcal · ` : ""}
                  {plan.plan.totals.protein_g ? `Proteína ${plan.plan.totals.protein_g} g · ` : ""}
                  {plan.plan.totals.sodium_mg ? `Sódio ${plan.plan.totals.sodium_mg} mg · ` : ""}
                  {plan.plan.totals.potassium_mg ? `Potássio ${plan.plan.totals.potassium_mg} mg · ` : ""}
                  {plan.plan.totals.phosphorus_mg ? `Fósforo ${plan.plan.totals.phosphorus_mg} mg` : ""}
                </p>
              )}
              {plan.plan.notes ? (
                <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-[var(--text)]"><b>Observações:</b> {plan.plan.notes}</p>
              ) : null}
              <p className="mt-3 text-[11px] text-[var(--text-muted)]">Registre abaixo o que você comeu para acompanhar se está seguindo o plano e as metas.</p>
            </div>
          )}
        </section>
      )}

      {/* Acompanhamento (semáforo) */}
      <section className="mt-4">
        {!hasGoals && (
          <p className="mb-3 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Sua nutricionista ainda não definiu metas individuais. Os valores abaixo são apenas uma <b>estimativa educativa</b> —
            não representam uma restrição. Converse com sua equipe para metas personalizadas.
          </p>
        )}
        {goals?.note && (
          <p className="mb-3 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text)]">
            <b>Orientação da nutricionista:</b> {goals.note}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tracks.map((t) => {
            const l = LIGHT[t.status];
            return (
              <div key={t.key} className={`rounded-2xl border border-[var(--border)] p-3 ${l.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t.label}</p>
                </div>
                <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{t.total}<span className="text-xs font-normal text-[var(--text-muted)]"> {t.unit}</span></p>
                <p className={`text-[11px] font-semibold ${l.text}`}>{t.goal != null ? `meta ${t.goal} ${t.unit} · ${l.label}` : l.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Alertas educativos */}
      {alerts.length > 0 && (
        <section className="mt-4 space-y-2">
          {alerts.map((a) => (
            <div key={a.key} className={`rounded-xl border px-3 py-2 text-sm ${a.status === "vermelho" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <p>{a.message}</p>
              {a.contributors.length > 0 && (
                <p className="mt-1 text-xs opacity-90">Mais contribuíram hoje: {a.contributors.map((c) => c.food).join(", ")}.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Consultas de nutrição (pagamento por Pix direto) */}
      {appts.length > 0 && (
        <section className="panel mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Consultas de nutrição</p>
          {apptMsg && <p className="mt-1 text-sm font-semibold text-[var(--green,#0d9488)]">{apptMsg}</p>}
          <div className="mt-2 grid gap-2">
            {appts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[var(--text)]">R$ {(a.priceCents / 100).toFixed(2)} <span className="text-xs font-normal text-[var(--text-muted)]">· {a.modality || "teleconsulta"}{a.slotStart ? " · " + new Date(a.slotStart).toLocaleString("pt-BR") : ""}</span></p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "confirmada" || a.status === "realizada" ? "bg-emerald-100 text-emerald-700" : a.status === "cancelada" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                    {a.status === "aguardando_pagamento" ? "Pague via Pix" : a.status === "aguardando_confirmacao" ? "Aguardando confirmação" : a.status === "confirmada" ? "Confirmada" : a.status === "realizada" ? "Realizada" : "Cancelada"}
                  </span>
                </div>
                {a.status === "aguardando_pagamento" && a.pixCopiaCola && (
                  <div className="mt-2">
                    <p className="break-all rounded-lg bg-[var(--bg)] p-2 text-xs text-[var(--text-soft)]">{a.pixCopiaCola}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost text-sm" onClick={() => copyPix(a.pixCopiaCola!)}>Copiar Pix</button>
                      <label className="btn-gold cursor-pointer text-sm">Enviar comprovante<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendProof(a.id, f); }} /></label>
                    </div>
                  </div>
                )}
                {a.status === "aguardando_pagamento" && !a.pixCopiaCola && <p className="mt-1 text-xs text-[var(--text-muted)]">A nutricionista ainda não configurou a chave Pix. Combine o pagamento com ela.</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nível de atenção pelos exames/estágio (educativo) */}
      {attention.length > 0 && (
        <section className="mt-4 space-y-2">
          {attention.map((a) => (
            <div key={a.key} className={`rounded-xl border px-3 py-2 text-sm ${a.level === "alerta" ? "border-orange-200 bg-orange-50 text-orange-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs opacity-90">{a.message}</p>
            </div>
          ))}
        </section>
      )}

      {/* Registrar */}
      <section className="panel mt-5">
        <div className="flex gap-2">
          {(["alimento", "liquido"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${kind === k ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
              {k === "alimento" ? "Alimento" : "Líquido"}
            </button>
          ))}
        </div>

        {kind === "alimento" ? (
          <>
            <div className="mt-3">
              <input className="input-field" placeholder="Buscar alimento (ex.: banana, arroz, feijão)…" value={foodQ} onChange={(e) => setFoodQ(e.target.value)} />
              {foods.length > 0 && foodQ && (
                <div className="mt-1 grid gap-1">
                  {foods.slice(0, 6).map((f) => (
                    <button key={f.id} type="button" onClick={() => pick(f)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-sm hover:border-[var(--border-gold)]">
                      <span>{f.name} <span className="text-xs text-[var(--text-muted)]">{f.state ? `· ${f.state}` : ""} · K {f.potassium_mg}/P {f.phosphorus_mg}/Na {f.sodium_mg} (100g)</span></span>
                      <span className="text-[var(--gold)]">selecionar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Alimento</span><input className="input-field" value={foodName} onChange={(e) => { setFoodName(e.target.value); setPicked(null); }} placeholder="Nome do alimento" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quantidade (g)</span><input className="input-field" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
            </div>
            {!picked && foodName && <p className="mt-1 text-xs text-[var(--text-muted)]">Sem alimento do banco selecionado: será registrado sem estimativa de nutrientes.</p>}
          </>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Líquido</span><input className="input-field" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="Água, suco, café…" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quantidade (mL)</span><input className="input-field" inputMode="numeric" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} /></label>
          </div>
        )}

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Refeição</span>
            <select className="input-field" value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option value="">—</option><option>Café da manhã</option><option>Lanche da manhã</option><option>Almoço</option><option>Lanche da tarde</option><option>Jantar</option><option>Ceia</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Horário</span><input className="input-field" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="Ex.: 12:30" /></label>
        </div>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observação (opcional)</span><input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sem sal; pouca fome" /></label>
        <div className="mt-2 flex items-center gap-3">
          <label className="btn-ghost cursor-pointer text-sm">{photo ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Prato" className="h-12 w-12 rounded-lg border border-[var(--border)] object-cover" />
          )}
        </div>
        {err && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{err}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-gold" onClick={add} disabled={saving}>{saving ? "Registrando…" : "Registrar"}</button>
          <label className="btn-ghost cursor-pointer text-sm">{labelBusy ? "Lendo rótulo…" : "Ler rótulo (foto)"}<input type="file" accept="image/*" className="hidden" onChange={readLabel} disabled={labelBusy} /></label>
        </div>
        {labelMsg && <p className="mt-2 text-xs text-[var(--text-muted)]">{labelMsg}</p>}
      </section>

      {/* Confirmação do rótulo */}
      {labelFields && (
        <section className="panel mt-3 border-[var(--border-gold)]">
          <p className="font-semibold text-[var(--text)]">Confirme os dados do rótulo</p>
          <p className="text-xs text-[var(--text-muted)]">Revise/edite antes de adicionar ao diário. Nada é salvo sem sua confirmação.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="block sm:col-span-3"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Produto</span><input className="input-field" value={String(labelFields.food || "")} onChange={(e) => setLF("food", e.target.value)} /></label>
            {([["portion_g", "Porção (g)"], ["sodium_mg", "Sódio (mg)"], ["protein_g", "Proteína (g)"], ["carb_g", "Carboidrato (g)"], ["fat_g", "Gordura (g)"], ["potassium_mg", "Potássio (mg)"], ["phosphorus_mg", "Fósforo (mg)"]] as const).map(([k, lbl]) => (
              <label key={k} className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{lbl}</span><input className="input-field" inputMode="decimal" value={String(labelFields[k] || "")} onChange={(e) => setLF(k, e.target.value)} /></label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]"><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={Boolean(labelFields.additivesPhosphorus)} onChange={(e) => setLF("additivesPhosphorus", e.target.checked)} /> Aditivo de fósforo</label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]"><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={Boolean(labelFields.additivesPotassium)} onChange={(e) => setLF("additivesPotassium", e.target.checked)} /> Sal de potássio</label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-gold" onClick={saveLabel} disabled={saving}>Adicionar ao diário</button>
            <button type="button" className="btn-ghost" onClick={() => setLabelFields(null)}>Cancelar</button>
          </div>
        </section>
      )}

      {/* Lista do dia */}
      <section className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Registros de hoje {date && `(${date.split("-").reverse().join("/")})`}</p>
        <div className="mt-2 grid gap-2">
          {entries.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nada registrado ainda hoje.</p>}
          {entries.map((e) => (
            <div key={e.id} className="panel flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {e.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : null}
                <div>
                  <p className="font-semibold text-[var(--text)]">{e.food} {e.kind === "alimento" && e.grams ? <span className="text-xs font-normal text-[var(--text-muted)]">· {e.grams} g</span> : null}{e.kind === "liquido" && e.volumeMl ? <span className="text-xs font-normal text-[var(--text-muted)]">· {e.volumeMl} mL</span> : null}</p>
                  <p className="text-xs text-[var(--text-muted)]">{[e.meal, e.timeLabel].filter(Boolean).join(" · ")}{e.kind === "alimento" && e.nutrients?.potassium_mg ? ` · K ${e.nutrients.potassium_mg} mg` : ""}</p>
                </div>
              </div>
              <button type="button" className="text-sm text-[var(--danger)]" onClick={() => del(e.id)}>Remover</button>
            </div>
          ))}
        </div>
      </section>

      {/* Comparar alimentos */}
      <section className="panel mt-5">
        <button type="button" className="flex w-full items-center justify-between" onClick={() => setCmpOpen((v) => !v)}>
          <span className="font-semibold text-[var(--text)]">Comparar alimentos</span>
          <span className="text-[var(--gold)]">{cmpOpen ? "−" : "+"}</span>
        </button>
        {cmpOpen && (
          <div className="mt-3">
            <input className="input-field" placeholder="Buscar alimento para comparar…" value={cmpQ} onChange={(e) => setCmpQ(e.target.value)} />
            {cmpFoods.length > 0 && cmpQ && (
              <div className="mt-1 grid gap-1">
                {cmpFoods.slice(0, 6).map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
                    <span>{f.name} {f.state ? <span className="text-xs text-[var(--text-muted)]">· {f.state}</span> : null}</span>
                    <span className="flex gap-2">
                      <button type="button" className="text-xs font-semibold text-[var(--gold)]" onClick={() => { setCmpA(f); setCmpQ(""); }}>A</button>
                      <button type="button" className="text-xs font-semibold text-[var(--gold)]" onClick={() => { setCmpB(f); setCmpQ(""); }}>B</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(cmpA || cmpB) && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
                    <tr><th className="p-2 text-left">Por 100 g</th><th className="p-2 text-left">{cmpA?.name || "A"}</th><th className="p-2 text-left">{cmpB?.name || "B"}</th></tr>
                  </thead>
                  <tbody>
                    {([["kcal", "Calorias (kcal)"], ["protein_g", "Proteína (g)"], ["sodium_mg", "Sódio (mg)"], ["potassium_mg", "Potássio (mg)"], ["phosphorus_mg", "Fósforo (mg)"]] as const).map(([k, lbl]) => (
                      <tr key={k} className="border-t border-[var(--border)]">
                        <td className="p-2 text-[var(--text-muted)]">{lbl}</td>
                        <td className="p-2 font-semibold text-[var(--text)]">{cmpA ? (cmpA as unknown as Record<string, number>)[k] : "—"}</td>
                        <td className="p-2 font-semibold text-[var(--text)]">{cmpB ? (cmpB as unknown as Record<string, number>)[k] : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">Use os botões A/B para escolher os dois alimentos. Valores por 100 g (TBCA/TACO).</p>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">Os valores são estimativas com base em tabelas nutricionais (TBCA/TACO). Não substituem a avaliação da sua equipe.</p>
      <PatientNav />
    </div>
  );
}
