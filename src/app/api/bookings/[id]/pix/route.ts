import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readDb } from "@/lib/store";
import { buildPixCode } from "@/lib/pix";

/**
 * Dados de PIX direto do médico para PAGAR esta consulta. Só expõe a chave quando
 * o médico habilitou PIX direto — e apenas no contexto do pagamento daquele médico.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  const doctor = db.doctors.find((d) => d.id === booking.doctorId);
  if (!doctor || !doctor.pixAccept || !doctor.pixKey?.trim()) {
    return NextResponse.json({ error: "Este médico não recebe por PIX direto." }, { status: 400 });
  }

  const favorecido = doctor.pixBusinessName?.trim() || doctor.pixHolderName?.trim() || doctor.name;
  const code = buildPixCode({
    key: doctor.pixKey.trim(),
    name: favorecido,
    city: "BRASIL",
    amountCents: booking.priceCents,
    txid: booking.id.replace(/-/g, "").slice(0, 25),
  });
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(code, { margin: 1, width: 260 });
  } catch {
    qr = null;
  }

  return NextResponse.json({
    favorecido,
    holderDoc: doctor.pixHolderDoc ?? null,
    bank: doctor.pixBank ?? null,
    keyType: doctor.pixKeyType ?? null,
    pixKey: doctor.pixKey.trim(),
    amountCents: booking.priceCents,
    copiaECola: code,
    qrDataUrl: qr,
    proofStatus: booking.proofStatus ?? null,
    bookingStatus: booking.status,
  });
}
