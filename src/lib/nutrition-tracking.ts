import type { DiaryEntry, NutritionTargets } from "./nutrition-diary-store";

export type LightStatus = "verde" | "amarelo" | "vermelho" | "estimativa";

export interface NutrientTrack {
  key: keyof NutritionTargets;
  label: string;
  unit: string;
  total: number;
  goal: number | null;
  status: LightStatus;
  pct: number | null;
}

export interface DailyTotals {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  sodium_mg: number;
  potassium_mg: number;
  phosphorus_mg: number;
  liquids_ml: number;
}

const TRACKED: { key: keyof NutritionTargets; label: string; unit: string; from: keyof DailyTotals }[] = [
  { key: "kcal", label: "Calorias", unit: "kcal", from: "kcal" },
  { key: "protein_g", label: "Proteína", unit: "g", from: "protein_g" },
  { key: "sodium_mg", label: "Sódio", unit: "mg", from: "sodium_mg" },
  { key: "potassium_mg", label: "Potássio", unit: "mg", from: "potassium_mg" },
  { key: "phosphorus_mg", label: "Fósforo", unit: "mg", from: "phosphorus_mg" },
  { key: "liquids_ml", label: "Líquidos", unit: "mL", from: "liquids_ml" },
];

export function computeDailyTotals(entries: DiaryEntry[]): DailyTotals {
  const t: DailyTotals = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, sodium_mg: 0, potassium_mg: 0, phosphorus_mg: 0, liquids_ml: 0 };
  for (const e of entries) {
    const n = e.nutrients || {};
    t.kcal += n.kcal || 0;
    t.protein_g += n.protein_g || 0;
    t.carb_g += n.carb_g || 0;
    t.fat_g += n.fat_g || 0;
    t.sodium_mg += n.sodium_mg || 0;
    t.potassium_mg += n.potassium_mg || 0;
    t.phosphorus_mg += n.phosphorus_mg || 0;
    if (e.kind === "liquido" && e.volumeMl) t.liquids_ml += e.volumeMl;
  }
  // arredonda
  t.kcal = Math.round(t.kcal);
  t.protein_g = Math.round(t.protein_g * 10) / 10;
  t.carb_g = Math.round(t.carb_g * 10) / 10;
  t.fat_g = Math.round(t.fat_g * 10) / 10;
  t.sodium_mg = Math.round(t.sodium_mg);
  t.potassium_mg = Math.round(t.potassium_mg);
  t.phosphorus_mg = Math.round(t.phosphorus_mg);
  t.liquids_ml = Math.round(t.liquids_ml);
  return t;
}

// Semáforo por nutriente. Sem meta profissional => 'estimativa' (educativo, sem restrição).
export function trafficLight(totals: DailyTotals, targets: NutritionTargets | undefined): NutrientTrack[] {
  return TRACKED.map(({ key, label, unit, from }) => {
    const total = totals[from];
    const goalRaw = targets ? targets[key] : null;
    const goal = typeof goalRaw === "number" && goalRaw > 0 ? goalRaw : null;
    let status: LightStatus = "estimativa";
    let pct: number | null = null;
    if (goal != null) {
      pct = total / goal;
      status = pct <= 0.8 ? "verde" : pct <= 1.0 ? "amarelo" : "vermelho";
    }
    return { key, label, unit, total, goal, status, pct };
  });
}

// Alimentos que mais contribuíram para um nutriente (para orientação).
export function topContributors(entries: DiaryEntry[], nutrient: keyof import("./nutrition-diary-store").DiaryNutrients, limit = 3): { food: string; value: number }[] {
  return entries
    .map((e) => ({ food: e.food, value: (e.nutrients?.[nutrient] as number) || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Mensagem educativa (não alarmista) para status amarelo/vermelho.
export function educationalMessage(track: NutrientTrack): string | null {
  if (track.status === "amarelo") {
    return `Atenção: seu consumo estimado de ${track.label.toLowerCase()} está próximo do limite definido pela sua equipe. Vale conferir os alimentos registrados hoje.`;
  }
  if (track.status === "vermelho") {
    return `Seu consumo estimado de ${track.label.toLowerCase()} passou do limite definido pela sua equipe hoje. Converse com sua nutricionista e confira os alimentos registrados.`;
  }
  return null;
}
