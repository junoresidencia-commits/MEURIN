import type { NutritionReferral, NutritionConsultation } from "./nutritionists-store";
import type { NutritionGoals } from "./nutrition-diary-store";

export interface TimelineEvent {
  at: string;
  type: "encaminhamento" | "consulta" | "metas";
  label: string;
  by?: string | null;
  documentId?: string | null;
}

// Linha do tempo conjunta (médico ↔ nutricionista): encaminhamentos, consultas e metas.
export function buildNutritionTimeline(input: { referrals?: NutritionReferral[]; consultations?: NutritionConsultation[]; goals?: NutritionGoals | null }): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const r of input.referrals || []) {
    events.push({
      at: r.createdAt, type: "encaminhamento", by: r.doctorName,
      label: `Encaminhamento para nutrição${r.reason ? " — " + r.reason : ""}${r.priority === "alta" ? " (prioridade alta)" : ""}`,
    });
  }
  for (const c of input.consultations || []) {
    events.push({
      at: c.createdAt, type: "consulta", by: c.nutritionistName,
      label: `Consulta nutricional${c.documentId ? " + plano alimentar" : ""}`,
      documentId: c.documentId,
    });
  }
  if (input.goals && (input.goals.updatedAt)) {
    events.push({ at: input.goals.updatedAt, type: "metas", by: input.goals.nutritionistName, label: "Metas nutricionais definidas/atualizadas" });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
