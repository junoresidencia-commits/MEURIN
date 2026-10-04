import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { updateNutritionistSettings } from "@/lib/nutritionists-store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import { PIX_ERRORS, parsePixProfileInput } from "@/lib/pix-key";
import { pixKeyAlreadyTaken } from "@/lib/pix-taken";

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const pix = nut.pixProfile ?? null;
  const brcode = pix?.key ? buildPixBrCode({ key: pix.key, holderName: pix.holderName || nut.name, city: pix.city }) : null;
  return NextResponse.json({
    consultationPriceCents: nut.consultationPriceCents ?? null,
    returnPriceCents: nut.returnPriceCents ?? null,
    pixProfile: pix,
    brcode,
    commissionPercent: nut.commissionPercent ?? null,
    payoutStatus: nut.payoutStatus ?? "active",
  });
}

export async function PUT(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const priceReais = b.consultationPrice !== undefined ? Number(b.consultationPrice) : undefined;
  const returnReais = b.returnPrice !== undefined ? Number(b.returnPrice) : undefined;

  let pixProfile = undefined;
  if (b.pixProfile && typeof b.pixProfile === "object") {
    const raw = b.pixProfile as Record<string, unknown>;
    if (raw.key) {
      const parsed = parsePixProfileInput(raw);
      if (!parsed.ok) {
        console.error("[pix] validação nutricionista", { id: nut.id, error: parsed.error });
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      if (await pixKeyAlreadyTaken(parsed.profile.key!, { kind: "nutrition", id: nut.id })) {
        return NextResponse.json({ error: PIX_ERRORS.duplicate }, { status: 409 });
      }
      pixProfile = parsed.profile;
    } else if (raw.key === "") {
      pixProfile = null;
    }
  }

  try {
    await updateNutritionistSettings(nut.id, {
      consultationPriceCents: priceReais !== undefined && Number.isFinite(priceReais) ? Math.max(0, Math.round(priceReais * 100)) : undefined,
      returnPriceCents: returnReais !== undefined && Number.isFinite(returnReais) ? Math.max(0, Math.round(returnReais * 100)) : undefined,
      pixProfile,
    });
    const brcode = pixProfile?.key
      ? buildPixBrCode({ key: pixProfile.key, holderName: pixProfile.holderName || nut.name, city: pixProfile.city })
      : null;
    return NextResponse.json({ ok: true, brcode, pixProfile, message: pixProfile ? PIX_ERRORS.saved : undefined });
  } catch (err) {
    console.error("[pix] falha ao salvar chave do nutricionista", err);
    return NextResponse.json({ error: PIX_ERRORS.saveFailed }, { status: 500 });
  }
}
