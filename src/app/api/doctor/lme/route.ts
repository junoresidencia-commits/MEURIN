import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { deleteLme, getLme, listLmeByDoctor } from "@/lib/lme-store";

// Lista as LME do médico (para a página /medicos/lme e "LME para assinar").
export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const list = await listLmeByDoctor(doctorId);
  const items = list.map((l) => ({
    id: l.id,
    patientName: l.patientName || l.patientEmail,
    cid10: l.cid10 || null,
    diagnosis: l.diagnosis || null,
    medsCount: l.medications?.length || 0,
    signedAt: l.signedAt || null,
    createdAt: l.createdAt,
  }));
  return NextResponse.json({ items, paraAssinar: items.filter((i) => !i.signedAt).length });
}

// Exclui uma LME criada pelo médico (só o dono).
export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  const lme = await getLme(id);
  if (!lme) return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });
  if (lme.doctorId && lme.doctorId !== doctorId) {
    return NextResponse.json({ error: "Você não tem acesso a esta LME." }, { status: 403 });
  }
  await deleteLme(id);
  return NextResponse.json({ ok: true });
}
