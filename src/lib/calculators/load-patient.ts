import "server-only";
import { getProfile } from "../clinical-profile-store";
import { resolvePatientAccess } from "../doctor-access";
import { getLabResults, getPatientData, latestOfKind } from "../patient-store";
import { assessmentsToExtra, latestAssessmentsMap, listAssessments, ppsPrevious } from "../calculators-store";
import { buildCalcContext } from "./context";
import type { CalcContext } from "./types";

export async function loadPatientCalcContext(
  rawParam: string,
  doctorId: string
): Promise<{ access: NonNullable<Awaited<ReturnType<typeof resolvePatientAccess>>>; ctx: CalcContext } | null> {
  const access = await resolvePatientAccess(rawParam);
  if (!access) return null;
  const [labs, patientData, profile, assessMap, allAssess] = await Promise.all([
    getLabResults(access.key),
    getPatientData(access.key, 120),
    getProfile(access.key),
    latestAssessmentsMap(doctorId, access.key),
    listAssessments(doctorId, access.key),
  ]);
  const records = patientData.records || [];
  const bp = latestOfKind(records, "bp");
  const weight = latestOfKind(records, "weight");
  const data = { ...(profile?.data || {}) } as Record<string, unknown>;
  if ((data.peso_kg == null || data.peso_kg === "") && weight?.weightKg != null) {
    data.peso_kg = weight.weightKg;
  }
  const extra = assessmentsToExtra(assessMap);
  const prevPps = ppsPrevious(allAssess.filter((a) => a.toolId === "pps"));
  if (prevPps != null) extra.pps_anterior = prevPps;
  return {
    access,
    ctx: buildCalcContext({
      patientName: access.name,
      birthdate: access.birthdate,
      ageYears: access.ageYears,
      ageReportedAt: access.ageReportedAt,
      sex: access.sex,
      labs: labs.map((l) => ({ testKey: l.testKey, value: l.value, unit: l.unit, measuredAt: l.measuredAt })),
      profile: data,
      sbp: bp?.systolic ?? null,
      dbp: bp?.diastolic ?? null,
      bpAt: bp?.measuredAt || null,
      extra,
    }),
  };
}
