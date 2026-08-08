import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  createPlan,
  deletePlan,
  listPlansByDoctor,
  logPlansAudit,
  updatePlan,
} from "@/lib/plans-store";
import {
  PLAN_INCLUDED_ITEMS,
  type PlanAvailability,
  type PlanDurationKind,
  type PlanModality,
  type PlanStatus,
} from "@/lib/plans";

const VALID_DURATION: PlanDurationKind[] = ["30d", "3m", "6m", "12m", "custom"];
const VALID_MODALITY: PlanModality[] = ["presencial", "teleconsulta", "ambas"];
const VALID_AVAILABILITY: PlanAvailability[] = ["publico", "selecionados", "convite"];
const VALID_STATUS: PlanStatus[] = ["ativo", "rascunho", "pausado"];
const INCLUDED_KEYS = new Set(PLAN_INCLUDED_ITEMS.map((i) => i.key));

function sanitizeIncluded(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && INCLUDED_KEYS.has(v));
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const plans = await listPlansByDoctor(doctorId);
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Informe o nome do plano." }, { status: 400 });

  const duration = VALID_DURATION.includes(b.duration) ? b.duration : "30d";
  const plan = await createPlan({
    doctorId,
    name,
    description: b.description ? String(b.description) : undefined,
    priceCents: Math.max(0, Math.round(Number(b.priceCents) || 0)),
    duration,
    customDays: duration === "custom" ? Math.max(1, Math.round(Number(b.customDays) || 30)) : undefined,
    consultations: Math.max(1, Math.round(Number(b.consultations) || 1)),
    intervalSuggestion: b.intervalSuggestion ? String(b.intervalSuggestion) : undefined,
    modality: VALID_MODALITY.includes(b.modality) ? b.modality : "teleconsulta",
    availability: VALID_AVAILABILITY.includes(b.availability) ? b.availability : "publico",
    status: VALID_STATUS.includes(b.status) ? b.status : "rascunho",
    included: sanitizeIncluded(b.included),
    otherBenefits: b.otherBenefits ? String(b.otherBenefits) : undefined,
  });
  await logPlansAudit({
    actor: "medico",
    actorId: doctorId,
    doctorId,
    action: "plan.create",
    entity: "plan_template",
    entityId: plan.id,
    detail: { name: plan.name, priceCents: plan.priceCents },
  });
  return NextResponse.json({ ok: true, plan }, { status: 201 });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = String(b.name).trim();
  if (b.description !== undefined) patch.description = b.description ? String(b.description) : undefined;
  if (b.priceCents !== undefined) patch.priceCents = Math.max(0, Math.round(Number(b.priceCents) || 0));
  if (b.duration !== undefined && VALID_DURATION.includes(b.duration)) patch.duration = b.duration;
  if (b.customDays !== undefined) patch.customDays = Math.max(1, Math.round(Number(b.customDays) || 30));
  if (b.consultations !== undefined) patch.consultations = Math.max(1, Math.round(Number(b.consultations) || 1));
  if (b.intervalSuggestion !== undefined)
    patch.intervalSuggestion = b.intervalSuggestion ? String(b.intervalSuggestion) : undefined;
  if (b.modality !== undefined && VALID_MODALITY.includes(b.modality)) patch.modality = b.modality;
  if (b.availability !== undefined && VALID_AVAILABILITY.includes(b.availability))
    patch.availability = b.availability;
  if (b.status !== undefined && VALID_STATUS.includes(b.status)) patch.status = b.status;
  if (b.included !== undefined) patch.included = sanitizeIncluded(b.included);
  if (b.otherBenefits !== undefined) patch.otherBenefits = b.otherBenefits ? String(b.otherBenefits) : undefined;

  const updated = await updatePlan(id, doctorId, patch);
  if (!updated) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  await logPlansAudit({
    actor: "medico",
    actorId: doctorId,
    doctorId,
    action: "plan.update",
    entity: "plan_template",
    entityId: id,
    detail: patch,
  });
  return NextResponse.json({ ok: true, plan: updated });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const ok = await deletePlan(id, doctorId);
  if (!ok) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "plan.delete", entity: "plan_template", entityId: id });
  return NextResponse.json({ ok: true });
}
