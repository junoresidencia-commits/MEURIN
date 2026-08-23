import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { listConsultationsForPatient } from "@/lib/nutritionists-store";

type PlanShape = {
  meals?: { name?: string; time?: string; items?: { food?: string; grams?: number | string; household?: string; note?: string }[] }[];
  waterMl?: number | string | null;
  notes?: string | null;
  validUntil?: string | null;
  totals?: Record<string, number> | null;
};

/** Devolve o plano alimentar mais recente que a nutricionista liberou para o paciente. */
export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });

  const consults = await listConsultationsForPatient(email);
  const shared = consults.filter((c) => c.sharedWithPatient);
  const withMeals = shared.find(
    (c) => c.plan && Array.isArray((c.plan as PlanShape).meals) && ((c.plan as PlanShape).meals!.length > 0)
  );
  const chosen = withMeals || shared.find((c) => c.plan && Object.keys(c.plan).length > 0);
  if (!chosen) return NextResponse.json({ plan: null });

  const plan = chosen.plan as PlanShape;
  return NextResponse.json({
    plan: {
      meals: Array.isArray(plan.meals) ? plan.meals : [],
      waterMl: plan.waterMl ?? null,
      notes: plan.notes ?? null,
      validUntil: plan.validUntil ?? null,
      totals: plan.totals ?? null,
    },
    nutritionistName: chosen.nutritionistName ?? null,
    createdAt: chosen.createdAt,
    documentId: chosen.documentId ?? null,
    pdfUrl: chosen.documentId ? `/api/documents/${chosen.documentId}/pdf` : null,
  });
}
