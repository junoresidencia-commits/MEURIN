import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { findPatientByClinicalKey, findByEmailAny, clinicalKey } from "@/lib/patients-store";
import { getNetworkReferral, updateNetworkReferral } from "@/lib/network-referrals-store";
import { notifyReferralRecipient, revokeReferralAccess } from "@/lib/network-referral-actions";

async function patientOwnsReferral(patientKeyHint: string, referralPatientKey: string): Promise<boolean> {
  const keys = new Set<string>();
  if (patientKeyHint) keys.add(patientKeyHint.toLowerCase().trim());
  const byEmail = patientKeyHint.includes("@") ? await findByEmailAny(patientKeyHint) : null;
  const byKey = await findPatientByClinicalKey(patientKeyHint);
  if (byEmail) keys.add(clinicalKey(byEmail));
  if (byKey) keys.add(clinicalKey(byKey));
  return keys.has(referralPatientKey.toLowerCase().trim());
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const referral = await getNetworkReferral(id);
  if (!referral) return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  if (!(await patientOwnsReferral(email, referral.patientKey))) {
    return NextResponse.json({ error: "Este encaminhamento não é seu." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const authorize = body.authorize === true || body.autorizar === true;

  if (!authorize) {
    await revokeReferralAccess(referral, referral.patientName || "Paciente", email, "paciente");
    await updateNetworkReferral(
      referral.id,
      { status: "declined", consentConfirmed: false },
      {
        action: "patient_denied",
        actorKind: "paciente",
        actorId: email,
        actorName: referral.patientName,
        detail: { message: "Encaminhamento não autorizado pelo paciente." },
      }
    );
    return NextResponse.json({
      ok: true,
      authorized: false,
      message: "Encaminhamento não autorizado pelo paciente.",
    });
  }

  const now = new Date().toISOString();
  const updated = await updateNetworkReferral(
    referral.id,
    {
      consentConfirmed: true,
      consentAt: now,
      consentByKind: "paciente",
      consentById: email,
      consentByName: referral.patientName,
      status: "pending",
    },
    {
      action: "patient_authorized",
      actorKind: "paciente",
      actorId: email,
      actorName: referral.patientName,
      detail: {
        to: referral.toName,
        purpose: "continuidade do cuidado / encaminhamento",
        shareSlices: referral.shareSlices,
      },
    }
  );
  try {
    if (updated) await notifyReferralRecipient(updated);
  } catch (err) {
    console.error("[network] notificar após autorização", err);
  }
  return NextResponse.json({
    ok: true,
    authorized: true,
    message: "Encaminhamento autorizado com sucesso.",
    referral: updated,
  });
}
