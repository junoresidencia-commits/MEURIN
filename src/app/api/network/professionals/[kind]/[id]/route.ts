import { NextResponse } from "next/server";
import { getNetworkActor, getProfessionalCard } from "@/lib/network-actor";
import { isProfessionalKind } from "@/lib/network-types";

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { kind, id } = await params;
  if (!isProfessionalKind(kind)) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
  const professional = await getProfessionalCard(kind, id);
  if (!professional) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
  return NextResponse.json({ professional });
}
