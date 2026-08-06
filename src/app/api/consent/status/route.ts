import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { pendingConsents } from "@/lib/consent-store";

export async function GET(req: Request) {
  const queryEmail = new URL(req.url).searchParams.get("email");
  const sessionEmail = await getPatientEmail();
  const email = (queryEmail || sessionEmail || "").toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "E-mail não informado." }, { status: 400 });
  }
  const pending = await pendingConsents(email);
  return NextResponse.json({ email, pending, needsConsent: pending.length > 0 });
}
