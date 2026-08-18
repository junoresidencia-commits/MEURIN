import { NextResponse } from "next/server";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getPatientEmail } from "@/lib/patient-session";
import { getDoctorSessionId } from "@/lib/auth";
import { searchFoods } from "@/lib/foods-br";

// Busca de alimentos (banco TBCA/TACO seed). Acessível a nutricionista, paciente e médico logados.
export async function GET(req: Request) {
  const [nut, patient, doctor] = await Promise.all([getNutritionistId(), getPatientEmail(), getDoctorSessionId()]);
  if (!nut && !patient && !doctor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") || "";
  return NextResponse.json({ foods: searchFoods(q, 20) });
}
