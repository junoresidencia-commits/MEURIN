import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { getActiveLicenseForClinic, getPlan } from "@/lib/saas-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const license = await getActiveLicenseForClinic(id);
    const plan = license ? await getPlan(license.planId) : null;
    return NextResponse.json({
      license,
      plan,
      note: "A área médica não depende desta licença. Sem plano o prontuário continua no médico.",
    });
  } catch (err) {
    console.error("[clinica/license] ignorado", err);
    return NextResponse.json({
      license: null,
      plan: null,
      note: "A área médica não depende desta licença. Sem plano o prontuário continua no médico.",
    });
  }
}
