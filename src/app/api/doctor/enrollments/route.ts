import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  getEnrollment,
  listEnrollmentsByDoctor,
  logPlansAudit,
  updateEnrollment,
} from "@/lib/plans-store";
import { activateEnrollment } from "@/lib/plan-billing";
import type { EnrollmentStatus, PlanEnrollment } from "@/lib/plans";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const enrollments = await listEnrollmentsByDoctor(doctorId);
  return NextResponse.json({ enrollments });
}

function withStatus(e: PlanEnrollment, status: EnrollmentStatus, by: string) {
  return [...e.statusHistory, { status, at: new Date().toISOString(), by }];
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const action = String(b.action || "");
  if (!id || !action) return NextResponse.json({ error: "id e action obrigatórios." }, { status: 400 });

  const enrollment = await getEnrollment(id);
  if (!enrollment || enrollment.doctorId !== doctorId) {
    return NextResponse.json({ error: "Contratação não encontrada." }, { status: 404 });
  }

  if (action === "confirm_pix") {
    // Pix direto: só o médico confirma o recebimento manualmente.
    if (enrollment.paymentMethod !== "pix_direto") {
      return NextResponse.json({ error: "Esta contratação não é Pix direto." }, { status: 400 });
    }
    if (enrollment.status === "ativo") return NextResponse.json({ ok: true, enrollment });
    const activated = await activateEnrollment(id, { by: `medico:${doctorId}` });
    await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "enrollment.confirm_pix", entity: "plan_enrollment", entityId: id });
    return NextResponse.json({ ok: true, enrollment: activated });
  }

  if (action === "use_consultation") {
    if (enrollment.status !== "ativo") {
      return NextResponse.json({ error: "Plano não está ativo." }, { status: 400 });
    }
    const used = Math.min(enrollment.consultationsTotal, enrollment.consultationsUsed + 1);
    const done = used >= enrollment.consultationsTotal;
    const updated = await updateEnrollment(id, {
      consultationsUsed: used,
      status: done ? "concluido" : enrollment.status,
      statusHistory: done ? withStatus(enrollment, "concluido", `medico:${doctorId}`) : enrollment.statusHistory,
    });
    await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "enrollment.use_consultation", entity: "plan_enrollment", entityId: id, detail: { used } });
    return NextResponse.json({ ok: true, enrollment: updated });
  }

  if (action === "cancel" || action === "suspend") {
    const status: EnrollmentStatus = action === "cancel" ? "cancelado" : "suspenso";
    const updated = await updateEnrollment(id, {
      status,
      statusHistory: withStatus(enrollment, status, `medico:${doctorId}`),
    });
    await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: `enrollment.${action}`, entity: "plan_enrollment", entityId: id });
    return NextResponse.json({ ok: true, enrollment: updated });
  }

  if (action === "reactivate") {
    if (enrollment.status !== "suspenso") {
      return NextResponse.json({ error: "Só é possível reativar planos suspensos." }, { status: 400 });
    }
    const updated = await updateEnrollment(id, {
      status: "ativo",
      statusHistory: withStatus(enrollment, "ativo", `medico:${doctorId}`),
    });
    return NextResponse.json({ ok: true, enrollment: updated });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
