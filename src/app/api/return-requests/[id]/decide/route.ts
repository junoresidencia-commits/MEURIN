import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getAlliedSessionId } from "@/lib/allied-session";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getAttendantId } from "@/lib/attendant-session";
import { listLinksForAttendant } from "@/lib/attendants-store";
import { getDoctorById } from "@/lib/store";
import { getAlliedProfessional } from "@/lib/allied-store";
import { getNutritionist } from "@/lib/nutritionists-store";
import { getReturnRequest } from "@/lib/return-request-store";
import { applyProfessionalDecision } from "@/lib/return-request-flow";
import { RETURN_DECISIONS, type ReturnDecision } from "@/lib/return-request-types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReturnRequest(id);
  if (!row) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });

  let actor: { id: string; name: string; role: "professional" | "attendant" } | null = null;
  const doctorId = await getDoctorSessionId();
  if (doctorId && row.professionalKind === "doctor" && row.professionalId === doctorId) {
    const d = await getDoctorById(doctorId);
    actor = { id: doctorId, name: d?.name || "Médico", role: "professional" };
  }
  const alliedId = await getAlliedSessionId();
  if (!actor && alliedId && row.professionalId === alliedId) {
    const p = await getAlliedProfessional(alliedId);
    if (p) actor = { id: p.id, name: p.name, role: "professional" };
  }
  const nutId = await getNutritionistId();
  if (!actor && nutId && row.professionalId === nutId) {
    const n = await getNutritionist(nutId);
    if (n) actor = { id: n.id, name: n.name, role: "professional" };
  }
  const attId = await getAttendantId();
  if (!actor && attId && row.professionalKind === "doctor" && row.attendantInvited) {
    const links = await listLinksForAttendant(attId);
    if (links.some((l) => l.doctorId === row.professionalId && l.active)) {
      actor = { id: attId, name: "Atendente", role: "attendant" };
    }
  }
  if (!actor) return NextResponse.json({ error: "Sem permissão para validar esta solicitação." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision || "") as ReturnDecision;
  if (!RETURN_DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  }
  try {
    const updated = await applyProfessionalDecision(id, actor, {
      decision,
      message: body.message ? String(body.message) : undefined,
      slotStart: body.slotStart ? String(body.slotStart) : undefined,
      slotEnd: body.slotEnd ? String(body.slotEnd) : undefined,
      refusalReason: body.refusalReason ? String(body.refusalReason) : undefined,
    });
    return NextResponse.json({ ok: true, request: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível decidir." }, { status: 400 });
  }
}
