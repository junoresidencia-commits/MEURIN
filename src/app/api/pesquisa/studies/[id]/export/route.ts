import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { exportGate, logExport } from "@/lib/research-governance-store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  const gate = await exportGate(id, doctorId, study.type);
  if (!gate.ok) return NextResponse.json({ error: gate.reason, export: gate }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  await logExport({
    studyId: id,
    doctorId,
    format: String(body.format || "xlsx"),
    rowCount: Number(body.rowCount || 0),
  });
  return NextResponse.json({ ok: true, export: gate });
}
