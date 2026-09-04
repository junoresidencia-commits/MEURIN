import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { findPatientByClinicalKey } from "@/lib/patients-store";
import {
  createShare,
  findActiveShare,
  getShare,
  listSharesForDoctor,
  revokeShare,
  upsertPeer,
  writeAudit,
} from "@/lib/patient-shares-store";
import { sendNotification } from "@/lib/notify";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const lists = await listSharesForDoctor(doctorId);
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patientKey = String(body.patientKey || body.patient || "").trim();
  const toDoctorId = String(body.toDoctorId || "").trim();
  const reason = String(body.reason || "").trim() || null;
  if (!patientKey || !toDoctorId) {
    return NextResponse.json({ error: "Informe o paciente e o médico de destino." }, { status: 400 });
  }
  if (toDoctorId === doctorId) {
    return NextResponse.json({ error: "Não é possível encaminhar para você mesmo." }, { status: 400 });
  }

  const access = await resolvePatientAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const from = await getDoctorById(doctorId);
  const to = await getDoctorById(toDoctorId);
  if (!from || !to) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  if ((to.status ?? "approved") !== "approved") {
    return NextResponse.json({ error: "Este médico ainda não está liberado na plataforma." }, { status: 400 });
  }

  const existing = await findActiveShare(toDoctorId, access.key);
  if (existing) {
    return NextResponse.json({ share: existing, alreadyShared: true });
  }

  const share = await createShare({
    patientKey: access.key,
    patientName: access.name,
    fromDoctorId: from.id,
    fromDoctorName: from.name,
    fromSpecialty: from.specialty || null,
    toDoctorId: to.id,
    toDoctorName: to.name,
    toSpecialty: to.specialty || null,
    reason,
  });

  await upsertPeer(from.id, to.id);
  await upsertPeer(to.id, from.id);
  await writeAudit({
    doctorId: from.id,
    doctorName: from.name,
    patientKey: access.key,
    action: "compartilhou",
    detail: `${to.name} (${to.specialty || "Medicina"})${reason ? ` — ${reason}` : ""}`,
  });

  const openKey = access.email || access.key;
  await sendNotification({
    userId: to.id,
    role: "medico",
    type: "paciente_compartilhado",
    title: "Novo paciente compartilhado com você.",
    body: [access.name, `Encaminhado por: ${from.name} — ${from.specialty || "Medicina"}`, reason ? `Motivo: ${reason}` : ""]
      .filter(Boolean)
      .join("\n"),
    targetUrl: `/medicos/paciente/${encodeURIComponent(openKey)}`,
    tag: `share-${share.id}`,
    relatedType: "patient_share",
    relatedId: share.id,
  });

  return NextResponse.json({ share }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || body.shareId || "").trim();
  if (!id) return NextResponse.json({ error: "Informe o encaminhamento." }, { status: 400 });

  const share = await getShare(id);
  if (!share) return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });

  const patient = await findPatientByClinicalKey(share.patientKey);
  const isOwner = Boolean(patient && patient.doctorId === doctorId);
  const canRevoke = share.fromDoctorId === doctorId || share.toDoctorId === doctorId || isOwner;
  if (!canRevoke) {
    return NextResponse.json({ error: "Você não pode revogar este acesso." }, { status: 403 });
  }

  const revoked = await revokeShare(id, doctorId);
  const actor = await getDoctorById(doctorId);
  await writeAudit({
    doctorId,
    doctorName: actor?.name || null,
    patientKey: share.patientKey,
    action: "revogou_acesso",
    detail: `${share.toDoctorName || share.toDoctorId}`,
  });
  return NextResponse.json({ share: revoked });
}
