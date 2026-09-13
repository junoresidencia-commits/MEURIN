import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { getClosing, listAdjustments } from "@/lib/clinic-closing-store";
import { buildPayoutReceiptPdf } from "@/lib/clinic-closing-pdf";
import { getClinic } from "@/lib/platform-store";
import { listDoctors } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; closingId: string }> }) {
  const { id, closingId } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const closing = await getClosing(closingId);
    if (!closing || closing.clinicId !== id) return NextResponse.json({ error: "Fechamento não encontrado." }, { status: 404 });
    if (closing.status !== "paid") return NextResponse.json({ error: "Comprovante só após o repasse." }, { status: 400 });
    const [clinic, doctors, adjustments] = await Promise.all([getClinic(id), listDoctors(), listAdjustments(closing.id)]);
    const bytes = await buildPayoutReceiptPdf({
      clinicName: clinic?.name || "Clínica",
      doctorName: doctors.find((d) => d.id === closing.doctorId)?.name || "Médico",
      closing,
      adjustments,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${closing.code}-comprovante.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Estamos com dificuldade temporária para gerar PDFs. Seus dados estão salvos." },
      { status: 500 }
    );
  }
}
