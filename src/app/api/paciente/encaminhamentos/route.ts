import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { findByEmailAny, findPatientByClinicalKey, clinicalKey } from "@/lib/patients-store";
import { listPendingConsentForPatient } from "@/lib/network-referrals-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const keys = new Set<string>([email.toLowerCase().trim()]);
  const byEmail = await findByEmailAny(email);
  if (byEmail) keys.add(clinicalKey(byEmail));
  const byKey = await findPatientByClinicalKey(email);
  if (byKey) keys.add(clinicalKey(byKey));

  const all = [];
  for (const key of keys) {
    all.push(...(await listPendingConsentForPatient(key)));
  }
  const seen = new Set<string>();
  const referrals = all.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return NextResponse.json({ referrals });
}
