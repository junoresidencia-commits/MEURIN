import { NextResponse } from "next/server";
import { getPlatformActor } from "@/lib/platform-access";
import { getClinic, listClinics } from "@/lib/platform-store";

export async function GET() {
  const actor = await getPlatformActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (actor.isSuperAdmin) {
    const clinics = await listClinics();
    return NextResponse.json({
      clinics: clinics.map((c) => ({ clinicId: c.id, clinicName: c.name, role: "SUPER_ADMIN" as const })),
    });
  }
  const clinics = [];
  for (const m of actor.clinicAdmin) {
    const clinic = await getClinic(m.clinicId);
    if (clinic) clinics.push(m);
  }
  return NextResponse.json({ clinics });
}
