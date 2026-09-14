import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { listConsultationsForPatient, getNutritionist } from "@/lib/nutritionists-store";
import {
  hasPaidNutritionConsult,
  resolvePatientNutritionContext,
  toPublicNutritionistContact,
} from "@/lib/nutrition-plan-access";

type PlanShape = {
  meals?: { name?: string; time?: string; items?: { food?: string; grams?: number | string; household?: string; note?: string }[] }[];
  waterMl?: number | string | null;
  notes?: string | null;
  validUntil?: string | null;
  totals?: Record<string, number> | null;
};

/** Devolve o plano alimentar somente depois do pagamento confirmado. */
export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });

  const { nutritionist, contact } = await resolvePatientNutritionContext(email);
  const consults = await listConsultationsForPatient(email);
  const shared = consults.filter((c) => c.sharedWithPatient);
  const withMeals = shared.find(
    (c) => c.plan && Array.isArray((c.plan as PlanShape).meals) && ((c.plan as PlanShape).meals!.length > 0)
  );
  const chosen = withMeals || shared.find((c) => c.plan && Object.keys(c.plan).length > 0);
  const paid = await hasPaidNutritionConsult(email, nutritionist?.id);

  const nutFromPlan = chosen?.nutritionistId ? await getNutritionist(chosen.nutritionistId) : null;
  const publicNut = nutritionist
    ? toPublicNutritionistContact(nutritionist)
    : nutFromPlan
      ? toPublicNutritionistContact(nutFromPlan)
      : contact;

  if (!paid) {
    return NextResponse.json({
      paid: false,
      locked: true,
      hasPlan: Boolean(chosen),
      plan: null,
      nutritionist: publicNut,
      nutritionistName: publicNut?.name ?? chosen?.nutritionistName ?? null,
      nutritionistPhotoUrl: publicNut?.photoUrl ?? null,
    });
  }

  if (!chosen) {
    return NextResponse.json({
      paid: true,
      locked: false,
      hasPlan: false,
      plan: null,
      nutritionist: publicNut,
      nutritionistName: publicNut?.name ?? null,
      nutritionistPhotoUrl: publicNut?.photoUrl ?? null,
    });
  }

  const plan = chosen.plan as PlanShape;
  const nut = nutFromPlan || nutritionist;
  return NextResponse.json({
    paid: true,
    locked: false,
    hasPlan: true,
    plan: {
      meals: Array.isArray(plan.meals) ? plan.meals : [],
      waterMl: plan.waterMl ?? null,
      notes: plan.notes ?? null,
      validUntil: plan.validUntil ?? null,
      totals: plan.totals ?? null,
    },
    nutritionist: publicNut,
    nutritionistName: chosen.nutritionistName ?? nut?.name ?? null,
    nutritionistPhotoUrl: nut?.photoUrl ?? publicNut?.photoUrl ?? null,
    createdAt: chosen.createdAt,
    documentId: chosen.documentId ?? null,
    pdfUrl: chosen.documentId ? `/api/documents/${chosen.documentId}/pdf` : null,
  });
}
