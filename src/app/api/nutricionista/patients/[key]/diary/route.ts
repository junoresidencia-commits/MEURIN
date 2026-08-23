import { NextResponse } from "next/server";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { getNutritionLink, listConsultationsForPatient } from "@/lib/nutritionists-store";
import { getGoals, listDiary } from "@/lib/nutrition-diary-store";
import { computeDailyTotals, trafficLight } from "@/lib/nutrition-tracking";
import { getPlanCheckin } from "@/lib/nutrition-plan-checkins-store";

// Nutricionista visualiza o diário alimentar do paciente (por data) + semáforo vs metas.
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { key } = await params;
  const access = await resolveNutritionPatientAccess(decodeURIComponent(key));
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const link = await getNutritionLink(nut.id, access.doctorId);
  if (link && !link.permissions.verDiario) {
    return NextResponse.json({ error: "Você não tem permissão para ver o diário deste paciente." }, { status: 403 });
  }
  const date = new URL(req.url).searchParams.get("date") || new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
  const [entries, goals, consults, done] = await Promise.all([
    listDiary(access.key, date),
    getGoals(access.key),
    listConsultationsForPatient(access.key),
    getPlanCheckin(access.key, date),
  ]);
  const totals = computeDailyTotals(entries);
  const tracks = trafficLight(totals, goals?.targets);

  // Aderência ao plano do dia (refeições cumpridas / total do plano vigente).
  const shared = consults.filter((c) => c.sharedWithPatient);
  const planMeals = (shared.find((c) => Array.isArray((c.plan as { meals?: unknown[] })?.meals) && ((c.plan as { meals?: unknown[] }).meals!.length > 0))?.plan as { meals?: { name?: string }[] } | undefined)?.meals || [];
  const planAdherence = planMeals.length > 0
    ? { total: planMeals.length, done: planMeals.filter((m, i) => done.includes(`${i}:${m?.name || `Refeição ${i + 1}`}`)).length }
    : null;

  return NextResponse.json({ date, entries, totals, tracks, goals, planAdherence });
}
