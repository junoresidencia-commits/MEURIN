import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateBooking } from "@/lib/store";
import { saveProof, readProof } from "@/lib/proofs-store";
import { sendEmail } from "@/lib/email";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Paciente envia o comprovante do PIX. NÃO marca como pago — só o médico confirma. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b) => b.id === id);
    if (!booking) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
    if (booking.status === "confirmed") {
      return NextResponse.json({ error: "Esta consulta já está confirmada." }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Anexe o comprovante (foto ou PDF)." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Formato não aceito. Envie JPG, PNG ou PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (máx. 10 MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveProof(id, { name: file.name || "comprovante", type: file.type, buffer });

    await updateBooking(id, {
      proofStatus: "enviado",
      proofPath: saved.proofPath,
      proofMime: saved.mime,
      proofUploadedAt: new Date().toISOString(),
      proofNote: undefined,
    });

    const doctor = db.doctors.find((d) => d.id === booking.doctorId);
    if (doctor?.email) {
      await sendEmail({
        to: doctor.email,
        subject: `Comprovante PIX recebido — ${booking.patientName}`,
        body: `${booking.patientName} enviou o comprovante do PIX (R$ ${(booking.priceCents / 100).toFixed(2)}). Confira em Financeiro → Comprovantes pendentes e confirme o recebimento.`,
      });
    }
    return NextResponse.json({ ok: true, status: "comprovante_enviado" });
  } catch (error) {
    console.error("Erro ao enviar comprovante:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o comprovante agora. Tente novamente." },
      { status: 500 }
    );
  }
}

/** Médico visualiza o comprovante (autenticado e dono da consulta). */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking || booking.doctorId !== doctorId) {
    return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  }
  if (!booking.proofPath) return NextResponse.json({ error: "Sem comprovante." }, { status: 404 });
  const buffer = await readProof(booking.proofPath);
  if (!buffer) return NextResponse.json({ error: "Comprovante indisponível." }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": booking.proofMime || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
