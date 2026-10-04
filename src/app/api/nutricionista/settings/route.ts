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
    name: nut.name,
    phone: nut.phone ?? "",
    email: nut.email ?? "",
    crn: nut.crn ?? "",
    uf: nut.uf ?? "",
    city: nut.city ?? "",
    specialty: nut.specialty ?? "",
    bio: nut.bio ?? "",
    photoUrl: nut.photoUrl ?? null,
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
    const name = b.name !== undefined ? String(b.name || "").trim() : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
    }
    await updateNutritionistSettings(nut.id, {
      name,
      phone: b.phone !== undefined ? String(b.phone || "").trim() || null : undefined,
      email: b.email !== undefined ? String(b.email || "").trim() || null : undefined,
      crn: b.crn !== undefined ? String(b.crn || "").trim() || null : undefined,
      uf: b.uf !== undefined ? String(b.uf || "").trim().toUpperCase() || null : undefined,
      city: b.city !== undefined ? String(b.city || "").trim() || null : undefined,
      specialty: b.specialty !== undefined ? String(b.specialty || "").trim() || null : undefined,
      bio: b.bio !== undefined ? String(b.bio || "").trim() || null : undefined,
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
