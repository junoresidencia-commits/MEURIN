import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { cancelLicense } from "@/lib/saas-store";
import { writeAudit } from "@/lib/platform-store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (String(body.action || "") !== "cancel") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const license = await cancelLicense(id);
    await writeAudit({
      actorKind: "doctor",
      actorId: actor.doctorId,
      actorEmail: actor.email,
      action: "cancel_saas_license",
      entity: "saas_license",
      entityId: license.id,
      detail: "Cancelada. Área médica permanece liberada.",
    });
    return NextResponse.json({ license });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível cancelar." }, { status: 400 });
  }
}
