import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireNutritionist } from "@/lib/nutrition-context";
import { nutritionFeeRule } from "@/lib/nutritionists-store";
import { chargesTotals, listPlatformCharges, setPlatformChargeStatus } from "@/lib/platform-charges-store";
import { buildPlatformPix } from "@/lib/platform-pix";
import { feeSummary } from "@/lib/platform-fees";

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const charges = await listPlatformCharges({ professionalId: nut.id });
  const totals = chargesTotals(charges);
  const rule = nutritionFeeRule(nut);
  const pix = totals.dueCents > 0 ? await buildPlatformPix(totals.dueCents, `plt${nut.id}`) : null;
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
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const charges = await listPlatformCharges({ professionalId: nut.id });
  const due = charges.filter((c) => c.status === "due");
  for (const c of due) await setPlatformChargeStatus(c.id, "declared");
  return NextResponse.json({ ok: true });
}
