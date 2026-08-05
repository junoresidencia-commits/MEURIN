import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { addFoodLog } from "@/lib/patient-store";

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }

  const body = await req.json();
  const food = String(body.food || "").trim();
  if (!food) {
    return NextResponse.json({ error: "Informe o alimento ou refeição." }, { status: 400 });
  }

  const log = await addFoodLog({
    patientEmail: email,
    food,
    meal: body.meal ? String(body.meal) : null,
    quantity: body.quantity ? String(body.quantity) : null,
    note: body.note ? String(body.note) : null,
  });

  return NextResponse.json({ log }, { status: 201 });
}
