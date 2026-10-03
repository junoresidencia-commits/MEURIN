import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { chargesTotals, listPlatformCharges, setPlatformChargeStatus } from "@/lib/platform-charges-store";
import { getPlatformPix } from "@/lib/platform-pix";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const charges = await listPlatformCharges();
  const pix = await getPlatformPix();
  return NextResponse.json({ charges, totals: chargesTotals(charges), pix });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const status = String(b.status || "");
  if (!id || !["due", "declared", "received"].includes(status)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const row = await setPlatformChargeStatus(id, status as "due" | "declared" | "received");
  if (!row) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, charge: row });
}
