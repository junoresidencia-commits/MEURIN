import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { createPlan } from "@/lib/saas-store";
import { writeAudit } from "@/lib/platform-store";

export async function POST(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const plan = await createPlan({
      name: String(body.name || ""),
      monthlyCents: Math.round(Number(body.monthlyReais || 0) * 100) || Number(body.monthlyCents || 0),
      doctorSeats: Number(body.doctorSeats || 1),
    });
    await writeAudit({
      actorKind: "doctor",
      actorId: actor.doctorId,
      actorEmail: actor.email,
      action: "create_saas_plan",
      entity: "saas_plan",
      entityId: plan.id,
      detail: `${plan.name} · ${plan.monthlyCents} cents · ${plan.doctorSeats} assentos`,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível criar o plano." }, { status: 400 });
  }
}
