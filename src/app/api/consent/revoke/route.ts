import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { clientIp, type ConsentType } from "@/lib/consent";
import { addAudit, revokeConsent } from "@/lib/consent-store";

const VALID: ConsentType[] = ["terms", "privacy", "telehealth"];

export async function POST(req: Request) {
  const sessionEmail = await getPatientEmail();
  const body = await req.json();
  const email = String(body.email || sessionEmail || "").toLowerCase().trim();
  const type = String(body.type) as ConsentType;
  if (!email || !VALID.includes(type)) {
    return NextResponse.json({ error: "E-mail e tipo válidos são obrigatórios." }, { status: 400 });
  }

  await revokeConsent(email, type);
  await addAudit({
    patientEmail: email,
    action: `consent_revoke:${type}`,
    tableName: "consent_acceptances",
    ipAddress: clientIp(req.headers) || null,
  });
  return NextResponse.json({ ok: true });
}
