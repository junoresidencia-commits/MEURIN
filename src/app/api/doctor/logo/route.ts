import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, setDoctorLogo } from "@/lib/store";

// Limite defensivo do data URL (base64 infla ~33%): ~700KB de string = imagem pequena.
const MAX_LOGO_CHARS = 700_000;
const ALLOWED = ["data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/webp"];

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  return NextResponse.json({ logoUrl: doctor.logoUrl ?? null });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { logo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const logo = typeof body.logo === "string" ? body.logo.trim() : "";
  if (!logo || !ALLOWED.some((p) => logo.startsWith(p))) {
    return NextResponse.json(
      { error: "Envie uma imagem PNG, JPG ou WEBP." },
      { status: 400 }
    );
  }
  if (logo.length > MAX_LOGO_CHARS) {
    return NextResponse.json(
      { error: "Imagem muito grande. Use uma logo menor (até ~500 KB)." },
      { status: 413 }
    );
  }

  await setDoctorLogo(doctorId, logo);
  return NextResponse.json({ ok: true, logoUrl: logo });
}

export async function DELETE() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await setDoctorLogo(doctorId, null);
  return NextResponse.json({ ok: true });
}
