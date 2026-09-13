import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { listAudit } from "@/lib/platform-store";

export async function GET(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  try {
    const entries = await listAudit({
      limit: 80,
      actorEmail: url.searchParams.get("email") || undefined,
      action: url.searchParams.get("action") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar a auditoria agora. Tente novamente." },
      { status: 500 }
    );
  }
}
