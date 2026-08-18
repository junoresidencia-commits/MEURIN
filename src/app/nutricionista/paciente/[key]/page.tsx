"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type Lab = { key: string; label: string; value: number; unit?: string; measuredAt: string };
type Summary = {
  patient: { key: string; name: string; birthdate: string | null; sex: string | null; cpf: string | null };
  renal: { drc: unknown; estagioG: unknown; categoriaA: unknown; etiologia: unknown; pesoKg: unknown; alturaCm: unknown; imc: number | null };
  labs: Lab[];
  consultations: { id: string; createdAt: string; nutritionistName?: string | null; sharedWithPatient: boolean; documentId?: string | null }[];
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

  useEffect(() => {
    fetch(`/api/nutricionista/patients/${encodeURIComponent(key)}`).then(async (r) => {
      if (r.status === 401) { router.replace("/nutricionista/login"); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro");
      setSum(d);
    }).catch((e) => setError(e.message));
  }, [key, router]);

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
