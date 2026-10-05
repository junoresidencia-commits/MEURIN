import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getReturnRequest } from "@/lib/return-request-store";
import { addReturnEvent } from "@/lib/return-request-store";
import { patientAcceptSuggestedSlot, patientConfirmConvertedConsult } from "@/lib/return-request-flow";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Entre como paciente." }, { status: 401 });
  const { id } = await params;
  const row = await getReturnRequest(id);
  if (!row) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  const mine = row.patientKey.toLowerCase() === subject.toLowerCase() || (row.patientEmail || "").toLowerCase() === subject.toLowerCase();
  if (!mine) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    if (action === "accept_slot") {
      const updated = await patientAcceptSuggestedSlot(id);
      return NextResponse.json({ ok: true, request: updated });
    }
    if (action === "confirm_new") {
      const updated = await patientConfirmConvertedConsult(id);
      return NextResponse.json({ ok: true, request: updated });
    }
    if (action === "choose_other") {
      await addReturnEvent(id, "paciente", "escolheu_outro_horario", "Paciente preferiu escolher outro horário.");
      return NextResponse.json({ ok: true, redirect: `/paciente/agendar/${row.professionalKind}/${row.professionalId}?tipo=consulta` });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir." }, { status: 400 });
  }
}
