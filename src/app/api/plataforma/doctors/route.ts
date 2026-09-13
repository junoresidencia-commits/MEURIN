import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { listDoctors } from "@/lib/store";
import { listActiveRolesByActors } from "@/lib/platform-store";

/** Lista somente leitura — não altera senha, ID nem status. */
export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const doctors = await listDoctors();
  const rolesById = await listActiveRolesByActors(
    "doctor",
    doctors.map((d) => d.id)
  );
  return NextResponse.json({
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      crm: d.crm,
      specialty: d.specialty,
      status: d.status,
      roles: rolesById[d.id] || [],
    })),
  });
}
