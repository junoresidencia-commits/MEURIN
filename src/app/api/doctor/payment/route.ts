import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, setDoctorMpToken, setDoctorPixKey } from "@/lib/store";
import { getMercadoPagoToken } from "@/lib/payments";

/**
 * Recebimentos do médico via Mercado Pago.
 * O token é um segredo: nunca é devolvido ao navegador — só o status "conectado".
 */
export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  return NextResponse.json({
    connected: Boolean(doctor.mpAccessToken?.trim()),
    // Se o médico não conectou a própria conta, os pagamentos caem na conta da plataforma.
    platformFallback: Boolean(getMercadoPagoToken()),
    // Chave Pix para receber sem Mercado Pago (CNPJ, telefone, e-mail ou aleatória).
    pixKey: doctor.pixKey ?? null,
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { accessToken?: unknown; pixKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // Atualização da chave Pix (recebimento sem Mercado Pago). Vazio = remover.
  if (body.pixKey !== undefined) {
    const pix = typeof body.pixKey === "string" ? body.pixKey.trim() : "";
    await setDoctorPixKey(doctorId, pix || null);
    return NextResponse.json({ ok: true, pixKey: pix || null });
  }

  const token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Informe o Access Token do Mercado Pago." }, { status: 400 });
  }
  // Access tokens do Mercado Pago começam com APP_USR- (produção) ou TEST- (sandbox).
  if (!/^(APP_USR-|TEST-)/.test(token)) {
    return NextResponse.json(
      { error: 'Token inválido. Copie o "Access Token" das suas credenciais do Mercado Pago (começa com APP_USR- ).' },
      { status: 400 }
    );
  }

  await setDoctorMpToken(doctorId, token);
  return NextResponse.json({ ok: true, connected: true });
}

export async function DELETE() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await setDoctorMpToken(doctorId, null);
  return NextResponse.json({ ok: true, connected: false });
}
