import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { getCompanySettings, saveCompanySettings } from "@/lib/settings-store";
import { COMPANY, missingRequiredCompanyFields } from "@/lib/company";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const settings = await getCompanySettings();
  return NextResponse.json({
    company: COMPANY,
    settings,
    missing: missingRequiredCompanyFields(settings),
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
