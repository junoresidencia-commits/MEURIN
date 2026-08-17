import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, updateDb } from "@/lib/store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import type { PixKeyType, PixProfile } from "@/lib/types";

const KEY_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  const pix = doctor.pixProfile || (doctor.pixKey ? { key: doctor.pixKey } : {});
  const brCode = pix.key ? buildPixBrCode({ key: pix.key, holderName: pix.holderName || doctor.name, city: pix.city }) : "";
  return NextResponse.json({ pix, brCode });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const p = (body?.pix ?? {}) as Record<string, unknown>;

  const profile: PixProfile = {
    keyType: KEY_TYPES.includes(p.keyType as PixKeyType) ? (p.keyType as PixKeyType) : undefined,
    key: p.key ? String(p.key).trim() : undefined,
    holderName: p.holderName ? String(p.holderName).trim() : undefined,
    holderDoc: p.holderDoc ? String(p.holderDoc).trim() : undefined,
    bank: p.bank ? String(p.bank).trim() : undefined,
    city: p.city ? String(p.city).trim() : undefined,
  };

  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) =>
      d.id === doctorId
        ? { ...d, pixProfile: profile, pixKey: profile.key ?? d.pixKey }
        : d
    ),
  }));

  const brCode = profile.key ? buildPixBrCode({ key: profile.key, holderName: profile.holderName, city: profile.city }) : "";
  return NextResponse.json({ ok: true, pix: profile, brCode });
}
