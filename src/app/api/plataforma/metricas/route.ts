import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { collectUsageMetrics } from "@/lib/platform-health";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    return NextResponse.json(await collectUsageMetrics());
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar as métricas agora. Tente novamente." },
      { status: 500 }
    );
  }
}
