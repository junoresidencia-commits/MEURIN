import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { listPlatformProtocols } from "@/lib/research-governance-store";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const protocols = await listPlatformProtocols();
  return NextResponse.json({
    protocols: protocols.map((p) => ({
      studyId: p.studyId,
      studyTitle: p.studyTitle,
      ethicsStatus: p.ethicsStatus,
      protocolCode: p.protocolCode,
      ethicsBody: p.ethicsBody,
      updatedAt: p.updatedAt,
    })),
    note: "Sem nome de paciente, CPF ou prontuário. Governança separada do financeiro da clínica.",
  });
}
