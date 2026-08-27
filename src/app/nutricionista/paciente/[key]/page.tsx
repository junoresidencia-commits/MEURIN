"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CareMessageThread } from "@/components/CareMessageThread";

type Lab = { key: string; label: string; value: number; unit?: string; measuredAt: string };
type Summary = {
  patient: { key: string; name: string; birthdate: string | null; sex: string | null; cpf: string | null };
  renal: { drc: unknown; estagioG: unknown; categoriaA: unknown; etiologia: unknown; pesoKg: unknown; alturaCm: unknown; imc: number | null };
  labs: Lab[];
  consultations: { id: string; createdAt: string; nutritionistName?: string | null; sharedWithPatient: boolean; documentId?: string | null; plan?: Record<string, unknown>; assessment?: Record<string, unknown> }[];
};
type Food = { id: string; name: string; state?: string; source: string; measure?: string; measureGrams?: number; kcal: number; protein_g: number; carb_g: number; fat_g: number; sodium_mg: number; potassium_mg: number; phosphorus_mg: number; calcium_mg: number };
type Item = { food: string; grams: number; household?: string; per100: { kcal: number; protein_g: number; sodium_mg: number; potassium_mg: number; phosphorus_mg: number } };
type Meal = { name: string; time: string; items: Item[] };

export default function NutriPacientePage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const referralId = search.get("ref");
  const key = Array.isArray(params.key) ? params.key[0] : params.key;

  const [sum, setSum] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Avaliação
  const [assessment, setAssessment] = useState({ pesoAtual: "", altura: "", apetite: "normal", diagnostico: "", metas: "", conduta: "", retorno: "" });
  // Plano alimentar
  const [meals, setMeals] = useState<Meal[]>([{ name: "Café da manhã", time: "07:00", items: [] }]);
  const [waterMl, setWaterMl] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [share, setShare] = useState(true);
  // Busca de alimentos
  const [foodQ, setFoodQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [activeMeal, setActiveMeal] = useState(0);
  const [loadedFromPrevious, setLoadedFromPrevious] = useState(false);

  useEffect(() => {
    fetch(`/api/nutricionista/patients/${encodeURIComponent(key)}`).then(async (r) => {
      if (r.status === 401) { router.replace("/nutricionista/login"); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro");
      setSum(d);
      // Pré-carrega o último plano/avaliação para permitir editar/atualizar em vez de recomeçar do zero.
      const last = Array.isArray(d.consultations) ? d.consultations[0] : null;
      const p = last?.plan as { meals?: Meal[]; waterMl?: unknown; notes?: unknown; validUntil?: unknown } | undefined;
      if (p && Array.isArray(p.meals) && p.meals.length > 0) {
        setMeals(p.meals as Meal[]);
        setWaterMl(p.waterMl != null ? String(p.waterMl) : "");
        setNotes(p.notes != null ? String(p.notes) : "");
        setValidUntil(p.validUntil != null ? String(p.validUntil) : "");
        setLoadedFromPrevious(true);
      }
      const a = last?.assessment as Record<string, string> | undefined;
      if (a && Object.keys(a).length > 0) {
        setAssessment((prev) => ({
          pesoAtual: a.pesoAtual ?? prev.pesoAtual,
          altura: a.altura ?? prev.altura,
          apetite: a.apetite ?? prev.apetite,
          diagnostico: a.diagnostico ?? prev.diagnostico,
          metas: a.metas ?? prev.metas,
          conduta: a.conduta ?? prev.conduta,
          retorno: prev.retorno,
        }));
      }
    }).catch((e) => setError(e.message));
  }, [key, router]);

  function startBlank() {
    setMeals([{ name: "Café da manhã", time: "07:00", items: [] }]);
    setWaterMl(""); setNotes(""); setValidUntil("");
    setLoadedFromPrevious(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/nutrition/foods?q=${encodeURIComponent(foodQ)}`).then((r) => r.json()).then((d) => setFoods(d.foods || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [foodQ]);

  const totals = useMemo(() => {
    const t = { kcal: 0, protein_g: 0, sodium_mg: 0, potassium_mg: 0, phosphorus_mg: 0 };
    for (const m of meals) for (const it of m.items) {
      const f = it.grams / 100;
      t.kcal += it.per100.kcal * f;
      t.protein_g += it.per100.protein_g * f;
      t.sodium_mg += it.per100.sodium_mg * f;
      t.potassium_mg += it.per100.potassium_mg * f;
      t.phosphorus_mg += it.per100.phosphorus_mg * f;
    }
    return {
      kcal: Math.round(t.kcal), protein_g: Math.round(t.protein_g * 10) / 10,
      sodium_mg: Math.round(t.sodium_mg), potassium_mg: Math.round(t.potassium_mg), phosphorus_mg: Math.round(t.phosphorus_mg),
    };
  }, [meals]);

  function addMeal() { setMeals((m) => [...m, { name: "Refeição", time: "", items: [] }]); }
  function updateMeal(i: number, patch: Partial<Meal>) { setMeals((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m))); }
  function removeMeal(i: number) { setMeals((ms) => ms.filter((_, idx) => idx !== i)); }
  function addFood(f: Food) {
    const grams = f.measureGrams || 100;
    const item: Item = { food: f.name + (f.state ? ` (${f.state})` : ""), grams, household: f.measure, per100: { kcal: f.kcal, protein_g: f.protein_g, sodium_mg: f.sodium_mg, potassium_mg: f.potassium_mg, phosphorus_mg: f.phosphorus_mg } };
    setMeals((ms) => ms.map((m, idx) => (idx === activeMeal ? { ...m, items: [...m.items, item] } : m)));
  }
  function updateItem(mi: number, ii: number, grams: number) {
    setMeals((ms) => ms.map((m, idx) => idx === mi ? { ...m, items: m.items.map((it, j) => j === ii ? { ...it, grams } : it) } : m));
  }
  function removeItem(mi: number, ii: number) {
    setMeals((ms) => ms.map((m, idx) => idx === mi ? { ...m, items: m.items.filter((_, j) => j !== ii) } : m));
  }

  async function save() {
    setSaving(true); setError(""); setOkMsg(null); setPdfUrl(null);
    try {
      const res = await fetch(`/api/nutricionista/patients/${encodeURIComponent(key)}/consulta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment, shareWithPatient: share, generatePlanPdf: true, referralId: referralId || undefined,
          plan: { meals, waterMl, notes, validUntil, totals },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro ao salvar.");
      setOkMsg(share ? "Consulta salva e plano liberado ao paciente." : "Consulta salva. Plano gerado (não liberado ao paciente).");
      setPdfUrl(d.pdfUrl || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (error && !sum) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--danger)]">{error}</div>;
  if (!sum) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const drcLabel = [sum.renal.drc === true || sum.renal.drc === "sim" ? "DRC" : null, sum.renal.estagioG, sum.renal.categoriaA].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/nutricionista/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">{sum.patient.name}</h1>

      <section className="panel mt-4">
        <h2 className="font-display text-lg text-[var(--text)]">Mensagens com o paciente</h2>
        <p className="text-sm text-[var(--text-muted)]">O paciente vê você na área dele e pode escrever por aqui. Chega alerta no sino.</p>
        <CareMessageThread role="nutrition" patientKey={key} viewer="professional" />
      </section>

      {/* Resumo renal (somente leitura) */}
      <section className="panel mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Resumo renal (somente leitura)</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <p><span className="text-[var(--text-muted)]">DRC:</span> {drcLabel || "—"}</p>
          <p><span className="text-[var(--text-muted)]">Etiologia:</span> {String(sum.renal.etiologia || "—")}</p>
          <p><span className="text-[var(--text-muted)]">Peso:</span> {sum.renal.pesoKg ? `${sum.renal.pesoKg} kg` : "—"}</p>
          <p><span className="text-[var(--text-muted)]">Altura:</span> {sum.renal.alturaCm ? `${sum.renal.alturaCm} cm` : "—"}</p>
          <p><span className="text-[var(--text-muted)]">IMC:</span> {sum.renal.imc ?? "—"}</p>
          <p><span className="text-[var(--text-muted)]">Sexo:</span> {sum.patient.sex || "—"}</p>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exames liberados</p>
        {sum.labs.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">Nenhum exame disponível.</p>
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {sum.labs.map((l) => (
              <p key={l.key}><span className="text-[var(--text-muted)]">{l.label}:</span> <b>{l.value}</b> {l.unit || ""}</p>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Não é possível alterar diagnóstico, prescrição ou evolução médica.</p>
      </section>

      <GoalsAndDiary patientKey={key} />

      {/* Avaliação nutricional */}
      <section className="panel mt-4">
        <h2 className="font-display text-lg text-[var(--text)]">Consulta nutricional</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Peso atual (kg)</span><input className="input-field" inputMode="decimal" value={assessment.pesoAtual} onChange={(e) => setAssessment({ ...assessment, pesoAtual: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Altura (cm)</span><input className="input-field" inputMode="decimal" value={assessment.altura} onChange={(e) => setAssessment({ ...assessment, altura: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Apetite</span>
            <select className="input-field" value={assessment.apetite} onChange={(e) => setAssessment({ ...assessment, apetite: e.target.value })}>
              <option value="normal">Normal</option><option value="reduzido">Reduzido</option><option value="aumentado">Aumentado</option>
            </select>
          </label>
        </div>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Diagnóstico nutricional</span><input className="input-field" value={assessment.diagnostico} onChange={(e) => setAssessment({ ...assessment, diagnostico: e.target.value })} /></label>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Metas</span><input className="input-field" value={assessment.metas} onChange={(e) => setAssessment({ ...assessment, metas: e.target.value })} placeholder="Ex.: sódio < 2 g/dia; proteína 0,8 g/kg/dia" /></label>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Conduta</span><textarea className="input-field min-h-[70px]" value={assessment.conduta} onChange={(e) => setAssessment({ ...assessment, conduta: e.target.value })} /></label>
        <label className="mt-2 block max-w-[220px]"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data do retorno</span><input type="date" className="input-field" value={assessment.retorno} onChange={(e) => setAssessment({ ...assessment, retorno: e.target.value })} /></label>
      </section>

      {/* Plano alimentar */}
      <section className="panel mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-[var(--text)]">Plano alimentar</h2>
          <button type="button" className="btn-ghost text-sm" onClick={addMeal}>+ Refeição</button>
        </div>
        {loadedFromPrevious && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
            <span>Carregamos o <b>plano vigente</b> para você editar/atualizar. Ao salvar, gera uma nova versão para o paciente.</span>
            <button type="button" className="font-semibold text-[var(--gold)]" onClick={startBlank}>Começar do zero</button>
          </div>
        )}

        {/* Busca de alimentos */}
        <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Buscar alimento (TBCA/TACO) e adicionar à refeição selecionada</p>
          <div className="mt-1 flex gap-2">
            <input className="input-field" placeholder="Ex.: banana, feijão, frango…" value={foodQ} onChange={(e) => setFoodQ(e.target.value)} />
            <select className="input-field w-40" value={activeMeal} onChange={(e) => setActiveMeal(Number(e.target.value))}>
              {meals.map((m, i) => <option key={i} value={i}>{m.name || `Refeição ${i + 1}`}</option>)}
            </select>
          </div>
          {foods.length > 0 && (
            <div className="mt-2 grid gap-1">
              {foods.slice(0, 8).map((f) => (
                <button key={f.id} type="button" onClick={() => addFood(f)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-sm hover:border-[var(--border-gold)]">
                  <span>{f.name} <span className="text-xs text-[var(--text-muted)]">{f.state ? `· ${f.state}` : ""} · K {f.potassium_mg} · P {f.phosphorus_mg} · Na {f.sodium_mg} (100g) · {f.source}</span></span>
                  <span className="text-[var(--gold)]">+ adicionar</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refeições */}
        <div className="mt-3 grid gap-3">
          {meals.map((m, mi) => (
            <div key={mi} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input-field w-40" value={m.name} onChange={(e) => updateMeal(mi, { name: e.target.value })} placeholder="Refeição" />
                <input className="input-field w-24" value={m.time} onChange={(e) => updateMeal(mi, { time: e.target.value })} placeholder="Horário" />
                <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => removeMeal(mi)}>Remover</button>
              </div>
              {m.items.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">Selecione esta refeição acima e busque alimentos para adicionar.</p>
              ) : (
                <div className="mt-2 grid gap-1">
                  {m.items.map((it, ii) => (
                    <div key={ii} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{it.food} {it.household ? <span className="text-xs text-[var(--text-muted)]">({it.household})</span> : null}</span>
                      <input type="number" className="input-field w-20" value={it.grams} onChange={(e) => updateItem(mi, ii, Number(e.target.value) || 0)} /> <span className="text-xs">g</span>
                      <button type="button" className="text-[var(--danger)]" onClick={() => removeItem(mi, ii)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Meta de líquidos (mL/dia)</span><input className="input-field" inputMode="numeric" value={waterMl} onChange={(e) => setWaterMl(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Validade / revisão</span><input className="input-field" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} placeholder="Ex.: 30 dias" /></label>
        </div>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observações</span><textarea className="input-field min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

        {/* Totais estimados */}
        <div className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-soft)]">
          <b>Estimativa diária (aproximada):</b> {totals.kcal} kcal · Proteína {totals.protein_g} g · Sódio {totals.sodium_mg} mg · Potássio {totals.potassium_mg} mg · Fósforo {totals.phosphorus_mg} mg
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Disponibilizar o plano ao paciente
        </label>
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar consulta e gerar plano (PDF)"}</button>
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {okMsg && <p className="mt-2 text-sm font-semibold text-[var(--green,#0d9488)]">{okMsg}</p>}
      {pdfUrl && <a className="btn-ghost mt-2 inline-block" href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir plano em PDF</a>}
    </div>
  );
}

function ScheduleBox({ patientKey }: { patientKey: string }) {
  const enc = encodeURIComponent(patientKey);
  const [modality, setModality] = useState("teleconsulta");
  const [slot, setSlot] = useState("");
  const [price, setPrice] = useState("");
  const [isReturn, setIsReturn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<string | null>(null);

  async function schedule() {
    setSaving(true); setMsg(null); setPix(null);
    try {
      const res = await fetch(`/api/nutricionista/patients/${enc}/appointment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modality, slotStart: slot ? new Date(slot).toISOString() : null, price: price || undefined, isReturn }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      const a = d.appointment;
      setMsg(`Consulta criada (R$ ${(a.priceCents / 100).toFixed(2)}). O paciente vê o Pix na área dele e envia o comprovante.`);
      setPix(a.pixCopiaCola || null);
      setSlot(""); setPrice("");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <section className="panel mt-4">
      <h2 className="font-display text-lg text-[var(--text)]">Agendar consulta nutricional</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Cria a consulta e o cobrança por Pix direto. Configure seu valor e chave em <Link href="/nutricionista/configuracoes" className="font-semibold text-[var(--gold)]">Recebimentos</Link>.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modalidade</span>
          <select className="input-field" value={modality} onChange={(e) => setModality(e.target.value)}>
            <option value="teleconsulta">Teleconsulta</option><option value="presencial">Presencial</option>
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data e hora</span><input type="datetime-local" className="input-field" value={slot} onChange={(e) => setSlot(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor (R$) — opcional</span><input className="input-field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="usa seu padrão" /></label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-soft)]"><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={isReturn} onChange={(e) => setIsReturn(e.target.checked)} /> É um retorno (usa valor do retorno)</label>
      <button type="button" className="btn-gold mt-3" onClick={schedule} disabled={saving}>{saving ? "Agendando…" : "Agendar consulta"}</button>
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
      {pix && <p className="mt-1 break-all rounded-lg bg-[var(--bg)] p-2 text-xs text-[var(--text-soft)]">Pix: {pix}</p>}
    </section>
  );
}

const GOAL_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "kcal", label: "Calorias", unit: "kcal" },
  { key: "protein_g", label: "Proteína", unit: "g" },
  { key: "sodium_mg", label: "Sódio", unit: "mg" },
  { key: "potassium_mg", label: "Potássio", unit: "mg" },
  { key: "phosphorus_mg", label: "Fósforo", unit: "mg" },
  { key: "liquids_ml", label: "Líquidos", unit: "mL" },
];
const LIGHT_DOT: Record<string, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-500", vermelho: "bg-red-500", estimativa: "bg-slate-400" };

function GoalsAndDiary({ patientKey }: { patientKey: string }) {
  const enc = encodeURIComponent(patientKey);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [diary, setDiary] = useState<{ tracks: { key: string; label: string; unit: string; total: number; goal: number | null; status: string }[]; entries: { id: string; food: string; grams?: number | null; volumeMl?: number | null; meal?: string | null }[]; date: string; planAdherence?: { total: number; done: number } | null } | null>(null);
  const [timeline, setTimeline] = useState<{ at: string; type: string; label: string; by?: string | null }[]>([]);

  useEffect(() => {
    fetch(`/api/nutricionista/patients/${enc}/goals`).then((r) => r.json()).then((d) => {
      const t = d.goals?.targets || {};
      const obj: Record<string, string> = {};
      for (const f of GOAL_FIELDS) obj[f.key] = t[f.key] != null ? String(t[f.key]) : "";
      setTargets(obj);
      setNote(d.goals?.note || "");
    }).catch(() => {});
    fetch(`/api/nutricionista/patients/${enc}/diary`).then((r) => r.json()).then((d) => setDiary(d)).catch(() => {});
    fetch(`/api/nutricionista/patients/${enc}/timeline`).then((r) => r.json()).then((d) => setTimeline(d.timeline || [])).catch(() => {});
  }, [enc]);

  async function saveGoals() {
    setSaving(true); setSavedMsg(null);
    try {
      const res = await fetch(`/api/nutricionista/patients/${enc}/goals`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setSavedMsg("Metas salvas. O paciente já vê o acompanhamento com semáforo.");
    } catch (e) { setSavedMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <section className="panel mt-4">
        <h2 className="font-display text-lg text-[var(--text)]">Metas nutricionais individualizadas</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Defina as metas diárias conforme diagnóstico, estágio, exames, diálise e peso. Deixe em branco o que não quiser limitar (o app não inventa restrição).</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GOAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label} ({f.unit})</span>
              <input className="input-field" inputMode="numeric" value={targets[f.key] || ""} onChange={(e) => setTargets({ ...targets, [f.key]: e.target.value })} placeholder="—" />
            </label>
          ))}
        </div>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Orientação ao paciente (aparece no diário)</span><input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: priorize temperos naturais; evite embutidos." /></label>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="btn-gold" onClick={saveGoals} disabled={saving}>{saving ? "Salvando…" : "Salvar metas"}</button>
          {savedMsg && <span className="text-sm font-semibold text-[var(--text-soft)]">{savedMsg}</span>}
        </div>
      </section>

      <section className="panel mt-4">
        <h2 className="font-display text-lg text-[var(--text)]">Diário alimentar do paciente {diary?.date ? `(${diary.date.split("-").reverse().join("/")})` : ""}</h2>
        {diary?.planAdherence && (
          <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-semibold text-[var(--gold)]">
            Aderência ao plano hoje: {diary.planAdherence.done}/{diary.planAdherence.total} refeições
          </p>
        )}
        {!diary || diary.entries.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">Sem registros do paciente hoje.</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {diary.tracks.map((t) => (
                <div key={t.key} className="rounded-xl border border-[var(--border)] p-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${LIGHT_DOT[t.status]}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t.label}</span>
                  </div>
                  <p className="text-sm font-bold text-[var(--text)]">{t.total} {t.unit}{t.goal != null ? <span className="text-xs font-normal text-[var(--text-muted)]"> / {t.goal}</span> : null}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-1 text-sm">
              {diary.entries.map((e) => (
                <p key={e.id} className="text-[var(--text-soft)]">• {e.food} {e.grams ? `(${e.grams} g)` : e.volumeMl ? `(${e.volumeMl} mL)` : ""} {e.meal ? <span className="text-xs text-[var(--text-muted)]">— {e.meal}</span> : null}</p>
              ))}
            </div>
          </>
        )}
      </section>

      <ScheduleBox patientKey={patientKey} />

      {timeline.length > 0 && (
        <section className="panel mt-4">
          <h2 className="font-display text-lg text-[var(--text)]">Linha do tempo (médico ↔ nutrição)</h2>
          <ul className="mt-2 space-y-1">
            {timeline.map((ev, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--text-soft)]">
                <span className="text-xs text-[var(--text-muted)]">{new Date(ev.at).toLocaleDateString("pt-BR")}</span>
                <span>{ev.label}{ev.by ? <span className="text-[var(--text-muted)]"> — {ev.by}</span> : null}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
