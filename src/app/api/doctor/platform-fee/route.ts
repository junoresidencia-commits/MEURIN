import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { doctorFeeRule } from "@/lib/types";
import { chargesTotals, listPlatformCharges, setPlatformChargeStatus } from "@/lib/platform-charges-store";
import { buildPlatformPix } from "@/lib/platform-pix";
import { feeSummary } from "@/lib/platform-fees";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  const charges = await listPlatformCharges({ professionalId: doctor.id });
  const totals = chargesTotals(charges);
  const rule = doctorFeeRule(doctor);
  const pix = totals.dueCents > 0 ? await buildPlatformPix(totals.dueCents, `plt${doctor.id}`) : null;
  const qrDataUrl = pix?.brCode ? await QRCode.toDataURL(pix.brCode, { width: 280, margin: 1, errorCorrectionLevel: "M" }) : null;
  return NextResponse.json({
    rule,
    summary: feeSummary(rule),
    charges,
    totals,
    pix: pix ? { ...pix, qrDataUrl } : null,
  });
}

export async function POST() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const charges = await listPlatformCharges({ professionalId: doctorId });
  const due = charges.filter((c) => c.status === "due");
  for (const c of due) await setPlatformChargeStatus(c.id, "declared");
  return NextResponse.json({ ok: true });
}
