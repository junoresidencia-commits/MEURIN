import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { updateAlliedSettings } from "@/lib/allied-store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import { PIX_ERRORS, parsePixProfileInput } from "@/lib/pix-key";
import { pixKeyAlreadyTaken } from "@/lib/pix-taken";

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const pix = pro.pixProfile ?? null;
  const brcode = pix?.key ? buildPixBrCode({ key: pix.key, holderName: pix.holderName || pro.name, city: pix.city }) : null;
  return NextResponse.json({
    consultationPriceCents: pro.consultationPriceCents ?? null,
    returnPriceCents: pro.returnPriceCents ?? null,
    pixProfile: pix,
    brcode,
  });
}

export async function PUT(req: Request) {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const priceReais = b.consultationPrice !== undefined ? Number(b.consultationPrice) : undefined;
  const returnReais = b.returnPrice !== undefined ? Number(b.returnPrice) : undefined;

  let pixProfile = undefined;
  if (b.pixProfile && typeof b.pixProfile === "object") {
    const raw = b.pixProfile as Record<string, unknown>;
    if (raw.key) {
      const parsed = parsePixProfileInput(raw);
      if (!parsed.ok) {
        console.error("[pix] validação assistencial", { id: pro.id, error: parsed.error });
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      if (await pixKeyAlreadyTaken(parsed.profile.key!, { kind: "allied", id: pro.id })) {
        return NextResponse.json({ error: PIX_ERRORS.duplicate }, { status: 409 });
      }
      pixProfile = parsed.profile;
    } else if (raw.key === "") {
      pixProfile = null;
    }
  }

  try {
    const updated = await updateAlliedSettings(pro.id, {
      consultationPriceCents:
        priceReais !== undefined && Number.isFinite(priceReais) ? Math.max(0, Math.round(priceReais * 100)) : undefined,
      returnPriceCents:
        returnReais !== undefined && Number.isFinite(returnReais) ? Math.max(0, Math.round(returnReais * 100)) : undefined,
      pixProfile,
    });
    const dest = updated?.pixProfile?.key || pixProfile?.key;
    const holder = updated?.pixProfile?.holderName || pixProfile?.holderName || pro.name;
    const city = updated?.pixProfile?.city || pixProfile?.city;
    const brcode = dest ? buildPixBrCode({ key: dest, holderName: holder, city }) : null;
    return NextResponse.json({
      ok: true,
      brcode,
      pixProfile: updated?.pixProfile ?? pixProfile ?? null,
      message: dest ? PIX_ERRORS.saved : undefined,
    });
  } catch (err) {
    console.error("[pix] falha ao salvar chave assistencial", err);
    return NextResponse.json({ error: PIX_ERRORS.saveFailed }, { status: 500 });
  }
}
