import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { clinicExecutiveResumo } from "@/lib/clinic-resumo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const resumo = await clinicExecutiveResumo(id);
    return NextResponse.json({ resumo });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar o financeiro agora. Tente novamente." },
      { status: 500 }
    );
  }
}
