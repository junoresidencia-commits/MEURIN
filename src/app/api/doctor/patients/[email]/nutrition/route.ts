import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { listConsultationsForPatient } from "@/lib/nutritionists-store";
import { getGoals, listDiary } from "@/lib/nutrition-diary-store";
import { computeDailyTotals, trafficLight } from "@/lib/nutrition-tracking";

// Visão read-only da nutrição para o médico (acompanhamento conjunto).
export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const access = await resolvePatientAccess(decodeURIComponent(email));
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
  const [goals, consultations, entries] = await Promise.all([
    getGoals(access.key),
    listConsultationsForPatient(access.key),
    listDiary(access.key, date),
  ]);
  const totals = computeDailyTotals(entries);
  const tracks = trafficLight(totals, goals?.targets);
  return NextResponse.json({
    goals,
    tracksToday: tracks,
    totalsToday: totals,
    entriesToday: entries.length,
    consultations: consultations.map((c) => ({ id: c.id, createdAt: c.createdAt, nutritionistName: c.nutritionistName, sharedWithPatient: c.sharedWithPatient, documentId: c.documentId })),
  });
}
