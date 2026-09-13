import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { assignLicense } from "@/lib/saas-store";
import { writeAudit } from "@/lib/platform-store";

export async function POST(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const license = await assignLicense({
      planId: String(body.planId || ""),
      clinicId: body.clinicId ? String(body.clinicId) : undefined,
      doctorId: body.doctorId ? String(body.doctorId) : undefined,
      status: body.status === "trial" ? "trial" : "active",
    });
    await writeAudit({
      actorKind: "doctor",
      actorId: actor.doctorId,
      actorEmail: actor.email,
      action: "assign_saas_license",
      entity: "saas_license",
      entityId: license.id,
      detail: `${license.status} · clínica ${license.clinicId || "—"} · médico ${license.doctorId || "—"}`,
    });
    return NextResponse.json({
      license,
      note: "Licença registrada. Não altera login, pacientes nem o financeiro da clínica.",
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível licenciar." }, { status: 400 });
  }
}
