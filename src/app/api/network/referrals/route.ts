import { NextResponse } from "next/server";
import { getNetworkActor, getProfessionalCard } from "@/lib/network-actor";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { findPatientByClinicalKey, clinicalKey } from "@/lib/patients-store";
import {
  createNetworkReferral,
  hasProfessionalPatientAccess,
  listReferralsForProfessional,
  upsertProfessionalLink,
} from "@/lib/network-referrals-store";
import { notifyPatientConsentRequest, notifyReferralRecipient } from "@/lib/network-referral-actions";
import {
  DEFAULT_SHARE_SLICES,
  isConsentMethod,
  isProfessionalKind,
  isShareSlice,
  type ConsentMethod,
  type ShareSlice,
} from "@/lib/network-types";
import { getPatientEmail } from "@/lib/patient-session";

async function actorCanRefer(actor: { kind: "doctor" | "nutrition" | "psychology" | "nursing"; id: string }, patientKey: string) {
  if (actor.kind === "doctor") {
    const access = await resolvePatientAccess(patientKey);
    return Boolean(access?.allowed);
  }
  return hasProfessionalPatientAccess(actor.kind, actor.id, patientKey);
}

export async function GET() {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const lists = await listReferralsForProfessional(actor.kind, actor.id);
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
  const actor = await getNetworkActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patientKey = String(body.patientKey || body.patient || "").trim();
  const toKind = body.toKind;
  const toId = String(body.toId || body.professionalId || "").trim();
  const reason = String(body.reason || "").trim();
  const notes = String(body.notes || body.observation || "").trim() || null;
  const consentChecked = body.consentConfirmed === true || body.patientAuthorized === true;
  const consentMethod: ConsentMethod | null = isConsentMethod(body.consentMethod) ? body.consentMethod : null;
  const shareSlices: ShareSlice[] = Array.isArray(body.shareSlices)
    ? body.shareSlices.filter(isShareSlice)
    : [...DEFAULT_SHARE_SLICES];

  if (!patientKey || !isProfessionalKind(toKind) || !toId) {
    return NextResponse.json({ error: "Informe o paciente e o profissional de destino." }, { status: 400 });
  }
  if (toKind === actor.kind && toId === actor.id) {
    return NextResponse.json({ error: "Não é possível encaminhar para você mesmo." }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "Informe o motivo do encaminhamento." }, { status: 400 });
  if (!consentChecked) {
    return NextResponse.json({ error: "O consentimento do paciente é obrigatório para encaminhar." }, { status: 400 });
  }
  if (!consentMethod) {
    return NextResponse.json({ error: "Informe como o consentimento foi obtido." }, { status: 400 });
  }

  if (!(await actorCanRefer(actor, patientKey))) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const dest = await getProfessionalCard(toKind, toId);
  if (!dest) return NextResponse.json({ error: "Profissional não encontrado na rede do Meu Rim." }, { status: 404 });

  const patient = await findPatientByClinicalKey(patientKey);
  const resolvedKey = patient ? clinicalKey(patient) : patientKey.toLowerCase().trim();
  const patientName = patient?.name || String(body.patientName || "") || null;

  const now = new Date().toISOString();
  const inApp = consentMethod === "in_app" || consentMethod === "digital";
  const referral = await createNetworkReferral({
    patientKey: resolvedKey,
    patientName,
    registeredByKind: actor.kind,
    registeredById: actor.id,
    registeredByName: actor.name,
    fromKind: actor.kind,
    fromId: actor.id,
    fromName: actor.name,
    fromProfession: actor.profession,
    fromSpecialty: actor.specialty,
    toKind: dest.kind,
    toId: dest.id,
    toName: dest.name,
    toProfession: dest.profession,
    toSpecialty: dest.specialty,
    reason,
    notes,
    status: inApp ? "pending_consent" : "pending",
    shareSlices: shareSlices.length ? shareSlices : [...DEFAULT_SHARE_SLICES],
    consentConfirmed: !inApp,
    consentMethod,
    consentAt: inApp ? null : now,
    consentByKind: inApp ? null : actor.kind,
    consentById: inApp ? null : actor.id,
    consentByName: inApp ? null : actor.name,
  });

  await upsertProfessionalLink({
    patientKey: resolvedKey,
    patientName,
    professionalKind: actor.kind,
    professionalId: actor.id,
    origin: "followup",
    referralId: referral.id,
  });

  if (inApp) {
    const patientUser = patient?.email || (await getPatientEmail()) || resolvedKey;
    try {
      await notifyPatientConsentRequest(referral, patientUser);
    } catch (err) {
      console.error("[network] notificar paciente", err);
    }
    return NextResponse.json({
      referral,
      awaitingPatient: true,
      message: "Solicitação enviada ao paciente. O encaminhamento só segue após a autorização.",
    }, { status: 201 });
  }

  try {
    await notifyReferralRecipient(referral);
  } catch (err) {
    console.error("[network] notificar destinatário", err);
  }

  return NextResponse.json({ referral, awaitingPatient: false }, { status: 201 });
}
