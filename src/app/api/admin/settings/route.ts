import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { getCompanySettings, saveCompanySettings } from "@/lib/settings-store";
import { COMPANY, PLATFORM_PIX_DEFAULT, missingRequiredCompanyFields } from "@/lib/company";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const settings = await getCompanySettings();
  const withPix = {
    ...settings,
    platformPixKeyType: settings.platformPixKeyType || PLATFORM_PIX_DEFAULT.keyType,
    platformPixKey: settings.platformPixKey || PLATFORM_PIX_DEFAULT.key,
    platformPixHolderName: settings.platformPixHolderName || PLATFORM_PIX_DEFAULT.holderName,
  };
  return NextResponse.json({
    company: COMPANY,
    settings: withPix,
    missing: missingRequiredCompanyFields(withPix),
  });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json();
  const incoming = (body.settings || {}) as Record<string, unknown>;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    clean[k] = String(v ?? "").trim();
  }
  await saveCompanySettings(clean);
  return NextResponse.json({ ok: true, missing: missingRequiredCompanyFields(clean) });
}
