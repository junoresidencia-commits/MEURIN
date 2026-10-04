import { NextResponse } from "next/server";
import { getNetworkActor } from "@/lib/network-actor";
import { registerOrLinkPatient } from "@/lib/network-patients";
import { listLinksForProfessional } from "@/lib/network-referrals-store";
import { clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";

export async function GET() {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const links = await listLinksForProfessional(actor.kind, actor.id);
  let created: { key: string; name: string; origin: string }[] = [];
  if (actor.kind === "doctor") {
    const mine = await listPatientsByDoctor(actor.id);
    created = mine
      .filter((p) => p.status !== "archived")
      .map((p) => ({ key: clinicalKey(p), name: p.name, origin: "registered" }));
  }
  const byKey = new Map<string, { key: string; name: string; origin: string }>();
  for (const row of created) byKey.set(row.key, row);
  for (const link of links) {
    if (!byKey.has(link.patientKey)) {
      byKey.set(link.patientKey, {
        key: link.patientKey,
        name: link.patientName || link.patientKey,
        origin: link.origin,
      });
    }
  }
  return NextResponse.json({ patients: [...byKey.values()] });
}

export async function POST(req: Request) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const result = await registerOrLinkPatient(actor, body as Record<string, unknown>);
    return NextResponse.json({
      ok: true,
      id: result.patient.id,
      key: result.patient.email || `pid:${result.patient.id}`,
      linkedExisting: result.linkedExisting,
      matchedBy: result.matchedBy,
    }, { status: result.linkedExisting ? 200 : 201 });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    console.error("[network] cadastro de paciente", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível cadastrar o paciente." },
      { status }
    );
  }
}
