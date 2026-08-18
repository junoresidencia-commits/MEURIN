import { NextResponse } from "next/server";
import { resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { listConsultationsForPatient, listReferralsForPatient } from "@/lib/nutritionists-store";
import { getGoals } from "@/lib/nutrition-diary-store";
import { buildNutritionTimeline } from "@/lib/nutrition-timeline";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const access = await resolveNutritionPatientAccess(decodeURIComponent(key));
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const [consultations, referrals, goals] = await Promise.all([
    listConsultationsForPatient(access.key),
    listReferralsForPatient(access.key),
    getGoals(access.key),
  ]);
  return NextResponse.json({ timeline: buildNutritionTimeline({ referrals, consultations, goals }) });
}
