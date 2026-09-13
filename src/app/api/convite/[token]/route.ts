import { NextResponse } from "next/server";
import { acceptInvite, getInviteByToken } from "@/lib/clinic-ops-store";
import { getClinic } from "@/lib/platform-store";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Convite inválido ou já utilizado." }, { status: 404 });
  }
  const clinic = await getClinic(invite.clinicId);
  return NextResponse.json({
    invite: {
      kind: invite.kind,
      name: invite.name,
      email: invite.email,
      crm: invite.crm,
      specialty: invite.specialty,
      clinicName: clinic?.name || "Clínica",
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const accepted = await acceptInvite(token, String(body.password || ""));
    return NextResponse.json({
      ok: true,
      actorKind: accepted.actorKind,
      loginPath: accepted.actorKind === "doctor" ? "/medicos/login" : "/atendente/login",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível aceitar." }, { status: 400 });
  }
}
