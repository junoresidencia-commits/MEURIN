import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, updateDb } from "@/lib/store";
import { signatureProviderStatus } from "@/lib/signature/provider";
import type { SignatureVisual } from "@/lib/types";

const MAX_DATAURL = 400_000; // ~400 KB para imagem/desenho

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  return NextResponse.json({
    icp: signatureProviderStatus(),
    visual: doctor.signatureVisual ?? null,
    doctor: {
      name: doctor.name,
      crm: [doctor.crm, doctor.crmState].filter(Boolean).join("-"),
      rqe: doctor.rqe ?? null,
    },
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const v = body?.visual as Partial<SignatureVisual> | null | undefined;

  if (v === null) {
    await updateDb((c) => ({ ...c, doctors: c.doctors.map((d) => (d.id === doctorId ? { ...d, signatureVisual: undefined } : d)) }));
    return NextResponse.json({ ok: true, visual: null });
  }

  const kind = v?.kind === "image" || v?.kind === "draw" || v?.kind === "typed" ? v.kind : null;
  const value = typeof v?.value === "string" ? v.value : "";
  if (!kind || !value.trim()) return NextResponse.json({ error: "Assinatura visual inválida." }, { status: 400 });
  if ((kind === "image" || kind === "draw") && value.length > MAX_DATAURL) {
    return NextResponse.json({ error: "Imagem muito grande. Use uma assinatura menor." }, { status: 400 });
  }
  const visual: SignatureVisual = { kind, value, updatedAt: new Date().toISOString() };
  await updateDb((c) => ({ ...c, doctors: c.doctors.map((d) => (d.id === doctorId ? { ...d, signatureVisual: visual } : d)) }));
  return NextResponse.json({ ok: true, visual });
}
