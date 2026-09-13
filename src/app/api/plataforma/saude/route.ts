import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { collectSystemHealth, readinessFromHealth } from "@/lib/platform-health";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const health = await collectSystemHealth();
    return NextResponse.json({ health, readiness: readinessFromHealth(health) });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar a saúde do sistema agora. Tente novamente." },
      { status: 500 }
    );
  }
}
