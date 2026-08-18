import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getGoals } from "@/lib/nutrition-diary-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const goals = await getGoals(email);
  return NextResponse.json({ goals });
}
