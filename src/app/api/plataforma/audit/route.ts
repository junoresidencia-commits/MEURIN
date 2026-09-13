import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { listAudit } from "@/lib/platform-store";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const entries = await listAudit(50);
  return NextResponse.json({ entries });
}
