import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { updateAlliedSettings } from "@/lib/allied-store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import type { PixKeyType, PixProfile } from "@/lib/types";

const KEY_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({
    consultationPriceCents: pro.consultationPriceCents ?? null,
    returnPriceCents: pro.returnPriceCents ?? null,
    pixProfile: pro.pixProfile ?? null,
  });
}

export async function PUT(req: Request) {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
  return NextResponse.json({ ok: true, brcode, pixProfile: updated?.pixProfile ?? pixProfile ?? null });
}
