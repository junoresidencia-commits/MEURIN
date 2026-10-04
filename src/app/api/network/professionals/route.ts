import { NextResponse } from "next/server";
import { getNetworkActor } from "@/lib/network-actor";
import { parseKindParam, searchNetworkProfessionals } from "@/lib/network-professionals";

export async function GET(req: Request) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || searchParams.get("nome") || "";
  const profession = searchParams.get("profession") || searchParams.get("profissao") || "";
  const specialty = searchParams.get("specialty") || searchParams.get("especialidade") || "";
  const city = searchParams.get("city") || searchParams.get("cidade") || "";
  const state = searchParams.get("state") || searchParams.get("uf") || "";
  const clinic = searchParams.get("clinic") || searchParams.get("clinica") || "";
  const kind = parseKindParam(searchParams.get("kind"));

  const professionals = await searchNetworkProfessionals({
    q,
    profession,
    specialty,
    city,
    state,
    clinic,
    kind,
    excludeKind: actor.kind,
    excludeId: actor.id,
  });

  return NextResponse.json({ professionals });
}
