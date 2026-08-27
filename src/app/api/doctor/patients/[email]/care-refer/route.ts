import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { ALLIED_ROLES, addAlliedReferral, getAlliedLink, type AlliedRole } from "@/lib/allied-store";
import { addReferral, getNutritionLink } from "@/lib/nutritionists-store";
import { firstName, sendNotification } from "@/lib/notify";
import { careRoleLabel, isCareChatRole, notifyRoleForCare, professionalChatUrl } from "@/lib/care-messages-access";
import type { CareChatRole } from "@/lib/care-messages-store";

async function notifyReferral(role: CareChatRole, professionalId: string, patientKey: string, patientName: string) {
  const label = careRoleLabel(role);
  await sendNotification({
    userId: patientKey,
    role: "paciente",
    type: "care_referral",
    title: "Você foi encaminhado(a)",
    body: `Seu nefrologista indicou um(a) ${label}. Abra Minha Equipe de Saúde para enviar uma mensagem.`,
    targetUrl: "/paciente/inicio#equipe",
    relatedType: "care_referral",
    relatedId: professionalId,
  });
  await sendNotification({
    userId: professionalId,
    role: notifyRoleForCare(role),
    type: "care_referral",
    title: "Novo paciente encaminhado",
    body: `${firstName(patientName)} foi encaminhado(a) para você.`,
    targetUrl: professionalChatUrl(role, patientKey),
    relatedType: "care_referral",
    relatedId: patientKey,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolvePatientAccess(decodeURIComponent((await params).email));
  if (!access?.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const role = String(b.role || "");
  const professionalId = String(b.professionalId || "");
  if (!professionalId) return NextResponse.json({ error: "Escolha o profissional." }, { status: 400 });
  const doctor = await getDoctorById(doctorId);
  const patientName = (access.name || String(b.patientName || "")).trim() || "Paciente";

  if (role === "nutrition") {
    const link = await getNutritionLink(professionalId, doctorId);
    if (!link?.active) return NextResponse.json({ error: "Este nutricionista não está na sua equipe ativa." }, { status: 400 });
    const ref = await addReferral({
      doctorId, doctorName: doctor?.name ?? null, nutritionistId: professionalId,
      patientKey: access.key, patientName,
      reason: b.reason ? String(b.reason) : null, notes: b.notes ? String(b.notes) : null,
      objective: null, restrictions: null, priority: "normal",
    });
    await notifyReferral("nutrition", professionalId, access.key, patientName);
    return NextResponse.json({ ok: true, referral: ref }, { status: 201 });
  }

  if (!ALLIED_ROLES.includes(role as AlliedRole) || !isCareChatRole(role)) {
    return NextResponse.json({ error: "Especialidade inválida." }, { status: 400 });
  }
  const link = await getAlliedLink(professionalId, doctorId);
  if (!link?.active) return NextResponse.json({ error: "Este profissional não está na sua equipe ativa." }, { status: 400 });
  const ref = await addAlliedReferral({
    role: role as AlliedRole, doctorId, doctorName: doctor?.name ?? null, professionalId,
    patientKey: access.key, patientName,
    reason: b.reason ? String(b.reason) : null, notes: b.notes ? String(b.notes) : null,
  });
  await notifyReferral(role as CareChatRole, professionalId, access.key, patientName);
  return NextResponse.json({ ok: true, referral: ref }, { status: 201 });
}
