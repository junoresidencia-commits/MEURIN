import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { listNutritionLinksForNutritionist } from "@/lib/nutritionists-store";
import { getDoctorById } from "@/lib/store";

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const links = await listNutritionLinksForNutritionist(nut.id);
  const doctors: { id: string; name: string }[] = [];
  for (const l of links) {
    const d = await getDoctorById(l.doctorId);
    if (d) doctors.push({ id: d.id, name: d.name });
  }
  return NextResponse.json({
    nutritionist: { id: nut.id, name: nut.name, crn: nut.crn, uf: nut.uf, email: nut.email, specialty: nut.specialty },
    doctors,
  });
}
