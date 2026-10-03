import "server-only";
import { getCompanySettings } from "./settings-store";
import { buildPixBrCode } from "./pix-brcode";
import { FOUNDER_SUPER_ADMIN_EMAIL } from "./platform-types";
import { alliedFeeRule } from "./allied-store";
import { nutritionFeeRule } from "./nutritionists-store";
import { recordPlatformCharge } from "./platform-charges-store";
import type { AlliedProfessional } from "./allied-types";
import type { Nutritionist } from "./nutritionists-store";

export async function getPlatformPix() {
  const settings = await getCompanySettings();
  const key = String(settings.platformPixKey || FOUNDER_SUPER_ADMIN_EMAIL).trim();
  const holderName = String(settings.platformPixHolderName || "C.J. ATENDIMENTOS MEDICOS LTDA").trim();
  const city = String(settings.platformPixCity || settings.city || "BRASIL").trim();
  return {
    key,
    keyType: String(settings.platformPixKeyType || "email"),
    holderName,
    city,
    adminEmail: FOUNDER_SUPER_ADMIN_EMAIL,
    configured: Boolean(key),
  };
}

export async function buildPlatformPix(amountCents: number, txid: string) {
  const dest = await getPlatformPix();
  if (!dest.key || amountCents <= 0) return null;
  const brCode = buildPixBrCode({
    key: dest.key,
    holderName: dest.holderName,
    city: dest.city,
    amountCents,
    txid: txid.replace(/-/g, "").slice(0, 25),
  });
  if (!brCode) return null;
  return { brCode, amountCents, holderName: dest.holderName, adminEmail: dest.adminEmail };
}

export async function recordLoginFee(input: { kind: "psychology" | "nursing"; pro: AlliedProfessional } | { kind: "nutrition"; pro: Nutritionist }) {
  const day = new Date().toISOString().slice(0, 10);
  const sourceId = `entrada:${input.pro.id}:${day}`;
  const rule = input.kind === "nutrition" ? nutritionFeeRule(input.pro) : alliedFeeRule(input.pro);
  if (rule.appFeeMode !== "por_entrada") return null;
  return recordPlatformCharge({
    actorKind: input.kind,
    professionalId: input.pro.id,
    professionalName: input.pro.name,
    kind: "entrada",
    sourceId,
    rule,
    priceCents: 0,
    note: `entrada ${day}`,
  });
}
