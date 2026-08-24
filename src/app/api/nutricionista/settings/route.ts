import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { updateNutritionistSettings } from "@/lib/nutritionists-store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import type { PixKeyType, PixProfile } from "@/lib/types";

const KEY_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({
    name: nut.name,
    phone: nut.phone ?? null,
    email: nut.email ?? null,
    consultationPriceCents: nut.consultationPriceCents ?? null,
    returnPriceCents: nut.returnPriceCents ?? null,
    pixProfile: nut.pixProfile ?? null,
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
  let pixProfile: PixProfile | undefined;
  if (b.pixProfile && typeof b.pixProfile === "object") {
    const p = b.pixProfile as Record<string, unknown>;
    pixProfile = {
      keyType: KEY_TYPES.includes(p.keyType as PixKeyType) ? (p.keyType as PixKeyType) : undefined,
      key: p.key ? String(p.key).trim() : undefined,
      holderName: p.holderName ? String(p.holderName).trim() : undefined,
      holderDoc: p.holderDoc ? String(p.holderDoc).trim() : undefined,
      bank: p.bank ? String(p.bank).trim() : undefined,
      city: p.city ? String(p.city).trim() : undefined,
    };
  }
  const phone = b.phone !== undefined ? (String(b.phone).trim() || null) : undefined;
  await updateNutritionistSettings(nut.id, {
    consultationPriceCents: priceReais !== undefined && Number.isFinite(priceReais) ? Math.max(0, Math.round(priceReais * 100)) : undefined,
    returnPriceCents: returnReais !== undefined && Number.isFinite(returnReais) ? Math.max(0, Math.round(returnReais * 100)) : undefined,
    pixProfile,
    phone,
  });
  const brcode = pixProfile?.key ? buildPixBrCode({ key: pixProfile.key, holderName: pixProfile.holderName, city: pixProfile.city }) : null;
  return NextResponse.json({ ok: true, brcode });
}
