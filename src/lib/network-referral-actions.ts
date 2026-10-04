import "server-only";
import { createShare, findActiveShare, revokeShare } from "./patient-shares-store";
import { addReferral, getNutritionLink } from "./nutritionists-store";
import { addAlliedReferral, getAlliedLink } from "./allied-store";
import { upsertProfessionalLink, updateNetworkReferral } from "./network-referrals-store";
import type { PatientNetworkReferral } from "./network-types";
import { sendNotification } from "./notify";
import { honorific } from "./network-types";

export async function applyAcceptedReferral(referral: PatientNetworkReferral): Promise<PatientNetworkReferral> {
  let shareId = referral.shareId;
  if (referral.toKind === "doctor" && referral.fromKind === "doctor") {
    const existing = await findActiveShare(referral.toId, referral.patientKey);
    if (existing) {
      shareId = existing.id;
    } else {
      const share = await createShare({
        patientKey: referral.patientKey,
        patientName: referral.patientName,
        fromDoctorId: referral.fromId,
        fromDoctorName: referral.fromName,
        fromSpecialty: referral.fromSpecialty,
        toDoctorId: referral.toId,
        toDoctorName: referral.toName,
        toSpecialty: referral.toSpecialty,
        reason: referral.reason,
      });
      shareId = share.id;
    }
  } else if (referral.toKind === "nutrition") {
    try {
      const doctorId = referral.fromKind === "doctor" ? referral.fromId : referral.toId;
      if (referral.fromKind === "doctor") {
        const link = await getNutritionLink(referral.toId, referral.fromId).catch(() => null);
        void link;
      }
      await addReferral({
        doctorId,
        doctorName: referral.fromName,
        nutritionistId: referral.toId,
        patientKey: referral.patientKey,
        patientName: referral.patientName,
        reason: referral.reason,
        notes: referral.notes,
        objective: null,
        restrictions: null,
        priority: "normal",
      });
    } catch (err) {
      console.error("[network] legado nutrição", err);
    }
  } else if (referral.toKind === "psychology" || referral.toKind === "nursing") {
    try {
      if (referral.fromKind === "doctor") {
        await getAlliedLink(referral.toId, referral.fromId).catch(() => null);
      }
      await addAlliedReferral({
        role: referral.toKind,
        doctorId: referral.fromKind === "doctor" ? referral.fromId : referral.toId,
        doctorName: referral.fromName,
        professionalId: referral.toId,
        patientKey: referral.patientKey,
        patientName: referral.patientName,
        reason: referral.reason,
        notes: referral.notes,
      });
    } catch (err) {
      console.error("[network] legado assistencial", err);
    }
  }

  await upsertProfessionalLink({
    patientKey: referral.patientKey,
    patientName: referral.patientName,
    professionalKind: referral.toKind,
    professionalId: referral.toId,
    origin: "referral",
    referralId: referral.id,
  });

  const updated = await updateNetworkReferral(
    referral.id,
    { status: "following", acceptedAt: new Date().toISOString(), shareId },
    {
      action: "accepted",
      actorKind: referral.toKind,
      actorId: referral.toId,
      actorName: referral.toName,
      detail: { shareId, shareSlices: referral.shareSlices },
    }
  );
  return updated || { ...referral, status: "following", shareId };
}

export async function revokeReferralAccess(referral: PatientNetworkReferral, actorName: string, actorId: string, actorKind: string) {
  if (referral.shareId) {
    try {
      await revokeShare(referral.shareId, referral.toKind === "doctor" ? referral.toId : referral.fromId);
    } catch (err) {
      console.error("[network] revogar share", err);
    }
  }
  await updateNetworkReferral(
    referral.id,
    { consentRevokedAt: new Date().toISOString(), status: "declined" },
    {
      action: "consent_revoked",
      actorKind,
      actorId,
      actorName,
      detail: { shareId: referral.shareId },
    }
  );
}

export async function notifyReferralRecipient(referral: PatientNetworkReferral) {
  await sendNotification({
    userId: referral.toId,
    role: "medico",
    type: "paciente_encaminhado",
    title: `Você recebeu um novo paciente encaminhado por ${honorific(referral.fromName, referral.fromKind)}.`,
    body: referral.reason ? `Motivo informado pelo profissional.` : "Abra a área de encaminhamentos para aceitar.",
    targetUrl: referral.toKind === "doctor" ? "/medicos/encaminhamentos" : "/encaminhamentos",
    tag: `network-ref-${referral.id}`,
    relatedType: "network_referral",
    relatedId: referral.id,
  });
}

export async function notifyPatientConsentRequest(referral: PatientNetworkReferral, patientUserId: string) {
  await sendNotification({
    userId: patientUserId,
    role: "paciente",
    type: "encaminhamento_consentimento",
    title: `${honorific(referral.fromName, referral.fromKind)} deseja encaminhá-lo para ${honorific(referral.toName, referral.toKind)}.`,
    body: referral.toSpecialty
      ? `Especialista em ${referral.toSpecialty}. Você autoriza o compartilhamento das informações necessárias?`
      : "Você autoriza o compartilhamento das informações necessárias para este encaminhamento?",
    targetUrl: "/paciente/encaminhamentos",
    tag: `network-consent-${referral.id}`,
    relatedType: "network_referral",
    relatedId: referral.id,
  });
}
