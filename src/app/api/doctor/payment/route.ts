import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, setDoctorMpToken, setDoctorPixProfile } from "@/lib/store";
import { getMercadoPagoToken } from "@/lib/payments";
import type { PixKeyType } from "@/lib/types";

const VALID_PIX_TYPES: PixKeyType[] = ["cpf", "cnpj", "telefone", "email", "aleatoria"];

/**
 * Recebimentos do médico: Mercado Pago (token) E PIX próprio (perfil).
 * O token do MP é segredo (só status). O perfil PIX é do próprio médico — pode
 * ser devolvido a ele para edição.
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
    pix: {
      accept: Boolean(doctor.pixAccept),
      key: doctor.pixKey ?? "",
      keyType: doctor.pixKeyType ?? "",
      holderName: doctor.pixHolderName ?? "",
      holderDoc: doctor.pixHolderDoc ?? "",
      bank: doctor.pixBank ?? "",
      businessName: doctor.pixBusinessName ?? "",
    },
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: {
    accessToken?: unknown;
    pix?: {
      accept?: unknown;
      key?: unknown;
      keyType?: unknown;
      holderName?: unknown;
      holderDoc?: unknown;
      bank?: unknown;
      businessName?: unknown;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // Atualização do PIX próprio do médico (recebimento direto).
  if (body.pix !== undefined) {
    const p = body.pix || {};
    const accept = Boolean(p.accept);
    const key = typeof p.key === "string" ? p.key.trim() : "";
    const keyType = VALID_PIX_TYPES.includes(p.keyType as PixKeyType) ? (p.keyType as PixKeyType) : undefined;
    if (accept && !key) {
      return NextResponse.json({ error: "Informe a chave PIX para aceitar pagamentos por PIX direto." }, { status: 400 });
    }
    await setDoctorPixProfile(doctorId, {
      pixAccept: accept,
      pixKey: key || null,
      pixKeyType: keyType ?? null,
      pixHolderName: typeof p.holderName === "string" ? p.holderName.trim() || null : null,
      pixHolderDoc: typeof p.holderDoc === "string" ? p.holderDoc.trim() || null : null,
      pixBank: typeof p.bank === "string" ? p.bank.trim() || null : null,
      pixBusinessName: typeof p.businessName === "string" ? p.businessName.trim() || null : null,
    });
    return NextResponse.json({ ok: true, pixAccept: accept });
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
