import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getPatientEmail } from "@/lib/patient-session";
import { getAppointment, listAppointmentsForPatient, updateAppointment } from "@/lib/nutrition-appointments-store";
import { getNutritionist } from "@/lib/nutritionists-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const appointments = await listAppointmentsForPatient(email);
  const names = new Map<string, string>();
  const out = [];
  for (const a of appointments) {
    let holder = names.get(a.nutritionistId);
    if (!holder) {
      const nut = await getNutritionist(a.nutritionistId);
      holder = nut?.pixProfile?.holderName || nut?.name || a.nutritionistName || "Nutricionista";
      names.set(a.nutritionistId, holder);
    }
    let pixQrDataUrl: string | null = null;
    if (a.status === "aguardando_pagamento" && a.pixCopiaCola) {
      pixQrDataUrl = await QRCode.toDataURL(a.pixCopiaCola, { width: 280, margin: 1, errorCorrectionLevel: "M" });
    }
    out.push({
      ...a,
      pixHolderName: holder,
      pixQrDataUrl,
    });
  }
  return NextResponse.json({ appointments: out });
}

// Paciente declara Pix pago ou envia comprovante → aguardando confirmação da nutricionista.
export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Consulta obrigatória." }, { status: 400 });
  const appt = await getAppointment(id);
  if (!appt || appt.patientKey !== email) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });

  if (b.pixDeclared) {
    const updated = await updateAppointment(id, { status: "aguardando_confirmacao" });
    return NextResponse.json({ ok: true, appointment: updated });
  }

  const proof = typeof b.proofUrl === "string" && b.proofUrl.startsWith("data:") && b.proofUrl.length < 1500000 ? b.proofUrl : "";
  if (!proof) return NextResponse.json({ error: "Envie o comprovante (imagem)." }, { status: 400 });
  const updated = await updateAppointment(id, { proofUrl: proof, status: "aguardando_confirmacao" });
  return NextResponse.json({ ok: true, appointment: updated });
}
