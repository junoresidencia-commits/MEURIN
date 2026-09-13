import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { collectIntegrityCounts } from "@/lib/platform-integrity";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const counts = await collectIntegrityCounts();
  return NextResponse.json({ counts, at: new Date().toISOString() });
}
