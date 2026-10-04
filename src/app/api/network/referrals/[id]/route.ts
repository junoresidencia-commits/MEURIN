import { NextResponse } from "next/server";
import { getNetworkActor } from "@/lib/network-actor";
import { getNetworkReferral, updateNetworkReferral } from "@/lib/network-referrals-store";
import { applyAcceptedReferral, revokeReferralAccess } from "@/lib/network-referral-actions";
import { isReferralStatus } from "@/lib/network-types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const referral = await getNetworkReferral(id);
  if (!referral) return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  const involved = (referral.fromKind === actor.kind && referral.fromId === actor.id) ||
    (referral.toKind === actor.kind && referral.toId === actor.id);
  if (!involved) return NextResponse.json({ error: "Sem acesso a este encaminhamento." }, { status: 403 });
  if (referral.consentRevokedAt && referral.toKind === actor.kind && referral.toId === actor.id) {
    return NextResponse.json({ error: "O consentimento deste encaminhamento foi revogado." }, { status: 403 });
  }
  if (referral.toKind === actor.kind && referral.toId === actor.id && referral.status === "pending" && referral.consentConfirmed) {
    const viewed = await updateNetworkReferral(
      referral.id,
      { status: "viewed", viewedAt: new Date().toISOString() },
      { action: "viewed", actorKind: actor.kind, actorId: actor.id, actorName: actor.name }
    );
    return NextResponse.json({ referral: viewed || referral });
  }
  return NextResponse.json({ referral });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const referral = await getNetworkReferral(id);
  if (!referral) return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  const isDest = referral.toKind === actor.kind && referral.toId === actor.id;
  const isFrom = referral.fromKind === actor.kind && referral.fromId === actor.id;
  if (!isDest && !isFrom) return NextResponse.json({ error: "Sem acesso a este encaminhamento." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = body.status;

  if (body.revokeConsent === true && isFrom) {
    await revokeReferralAccess(referral, actor.name, actor.id, actor.kind);
    return NextResponse.json({ ok: true, revoked: true });
  }

  if (!isReferralStatus(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!isDest && !["finished"].includes(status)) {
    return NextResponse.json({ error: "Somente o profissional que recebeu pode alterar este status." }, { status: 403 });
  }
  if (!referral.consentConfirmed || referral.consentRevokedAt) {
    return NextResponse.json({ error: "Não é possível avançar sem o consentimento do paciente." }, { status: 400 });
  }
  if (referral.status === "pending_consent") {
    return NextResponse.json({ error: "Aguardando autorização do paciente." }, { status: 400 });
  }

  if (status === "accepted" || status === "following") {
    const updated = await applyAcceptedReferral(referral);
    return NextResponse.json({ referral: updated });
  }
  if (status === "declined") {
    const updated = await updateNetworkReferral(
      referral.id,
      { status: "declined" },
      { action: "declined", actorKind: actor.kind, actorId: actor.id, actorName: actor.name }
    );
    return NextResponse.json({ referral: updated });
  }
  if (status === "finished") {
    const updated = await updateNetworkReferral(
      referral.id,
      { status: "finished", finishedAt: new Date().toISOString() },
      { action: "finished", actorKind: actor.kind, actorId: actor.id, actorName: actor.name }
    );
    return NextResponse.json({ referral: updated });
  }
  if (status === "viewed") {
    const updated = await updateNetworkReferral(
      referral.id,
      { status: "viewed", viewedAt: new Date().toISOString() },
      { action: "viewed", actorKind: actor.kind, actorId: actor.id, actorName: actor.name }
    );
    return NextResponse.json({ referral: updated });
  }
  return NextResponse.json({ error: "Transição de status não permitida." }, { status: 400 });
}
