import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { readDb } from "@/lib/store";
import { listActiveRoles } from "@/lib/platform-store";

/** Lista somente leitura — não altera senha, ID nem status. */
export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const db = await readDb();
  const doctors = await Promise.all(
    db.doctors.map(async (d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      crm: d.crm,
      specialty: d.specialty,
      status: d.status,
      roles: await listActiveRoles("doctor", d.id),
    }))
  );
  return NextResponse.json({ doctors });
}
