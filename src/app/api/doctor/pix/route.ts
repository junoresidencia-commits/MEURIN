import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, setDoctorPixProfile } from "@/lib/store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import { PIX_ERRORS, parsePixProfileInput } from "@/lib/pix-key";
import { pixKeyAlreadyTaken } from "@/lib/pix-taken";

function brCodeFor(doctorName: string, pix: { key?: string; holderName?: string; city?: string } | null) {
  if (!pix?.key) return "";
  return buildPixBrCode({ key: pix.key, holderName: pix.holderName || doctorName, city: pix.city });
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  const pix = doctor.pixProfile || (doctor.pixKey ? { key: doctor.pixKey } : {});
  return NextResponse.json({ pix, brCode: brCodeFor(doctor.name, pix) });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = parsePixProfileInput((body?.pix ?? body) as Record<string, unknown>);
  if (!parsed.ok) {
    console.error("[pix] validação médico", { doctorId, error: parsed.error });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    if (await pixKeyAlreadyTaken(parsed.profile.key!, { kind: "doctor", id: doctorId })) {
      return NextResponse.json({ error: PIX_ERRORS.duplicate }, { status: 409 });
    }
    await setDoctorPixProfile(doctorId, parsed.profile);
    return NextResponse.json({
      ok: true,
      pix: parsed.profile,
      brCode: brCodeFor(parsed.profile.holderName || doctor.name, parsed.profile),
      message: PIX_ERRORS.saved,
    });
  } catch (err) {
    console.error("[pix] falha ao salvar chave do médico", err);
    return NextResponse.json({ error: PIX_ERRORS.saveFailed }, { status: 500 });
  }
}

export async function DELETE() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    await setDoctorPixProfile(doctorId, null);
    return NextResponse.json({ ok: true, pix: {}, brCode: "", message: PIX_ERRORS.deleted });
  } catch (err) {
    console.error("[pix] falha ao excluir chave do médico", err);
    return NextResponse.json({ error: PIX_ERRORS.saveFailed }, { status: 500 });
  }
}
