import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { getAppointment, listAppointmentsForNutritionist, updateAppointment, type NutritionAppointmentStatus } from "@/lib/nutrition-appointments-store";
import { nutritionFeeRule } from "@/lib/nutritionists-store";
import { recordPlatformCharge } from "@/lib/platform-charges-store";

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const appointments = await listAppointmentsForNutritionist(nut.id);
  return NextResponse.json({ appointments });
}

// Nutricionista confirma recebimento (Pix), cancela ou marca como realizada.
export async function PATCH(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const status = String(b.status || "") as NutritionAppointmentStatus;
  const valid: NutritionAppointmentStatus[] = ["aguardando_pagamento", "aguardando_confirmacao", "confirmada", "cancelada", "realizada"];
  if (!id || !valid.includes(status)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const appt = await getAppointment(id);
  if (!appt || appt.nutritionistId !== nut.id) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  const updated = await updateAppointment(id, { status });
  if (status === "confirmada") {
    await recordPlatformCharge({
      actorKind: "nutrition",
      professionalId: nut.id,
      professionalName: nut.name,
      kind: "atendimento",
      sourceId: appt.id,
      rule: nutritionFeeRule(nut),
      priceCents: appt.priceCents,
      note: appt.note || "consulta nutrição",
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, appointment: updated });
}
