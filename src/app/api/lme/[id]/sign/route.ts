import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getLme, markLmeSigned } from "@/lib/lme-store";

// Marca a LME como assinada (à mão ou digital) — ou desfaz. Só o médico dono.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });
  if (lme.doctorId && lme.doctorId !== doctorId) {
    return NextResponse.json({ error: "Você não tem acesso a esta LME." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const signed = body.signed !== false; // default: marcar como assinada
  const updated = await markLmeSigned(id, signed, doctorId);
  return NextResponse.json({ ok: true, signedAt: updated?.signedAt ?? null });
}
