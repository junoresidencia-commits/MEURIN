import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { FIRST_VISIT_STUDY_ID } from "@/lib/first-visit";
import { exportGate, logExport } from "@/lib/research-governance-store";

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const gate = await exportGate(FIRST_VISIT_STUDY_ID, doctorId, "coorte_retro");
  if (!gate.ok) return NextResponse.json({ error: gate.reason, export: gate }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  await logExport({
    studyId: FIRST_VISIT_STUDY_ID,
    doctorId,
    format: String(body.format || "xlsx"),
    rowCount: Number(body.rowCount || 0),
  });
  return NextResponse.json({ ok: true, export: gate });
}
