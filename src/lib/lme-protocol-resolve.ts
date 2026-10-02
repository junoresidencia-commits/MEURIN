import "server-only";
import { findByEmailAny, getPatient } from "@/lib/patients-store";
import { resolvePatientAge } from "@/lib/patient-age";
import { inferProtocolId, type LmeLike } from "@/lib/complementary-docs";

export async function resolveLmePatientAge(lme: { patientEmail?: string | null }): Promise<number | null> {
  const key = String(lme.patientEmail || "").trim();
  if (!key) return null;
  try {
    const byEmail = key.includes("@") ? await findByEmailAny(key) : null;
    const byId = !byEmail && !key.includes("@") ? await getPatient(key) : null;
    const p = byEmail || byId;
    if (!p) return null;
    return resolvePatientAge({ birthdate: p.birthdate, ageYears: p.ageYears, ageReportedAt: p.ageReportedAt });
  } catch {
    return null;
  }
}

export async function inferLmeProtocolId(lme: LmeLike & { patientEmail?: string | null }) {
  const ageYears = await resolveLmePatientAge(lme);
  return inferProtocolId(lme, { ageYears });
}
