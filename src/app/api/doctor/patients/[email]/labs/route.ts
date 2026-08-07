import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { addLabResult } from "@/lib/patient-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";

const VALID = new Set(NEPHRO_LABS.map((l) => l.key));

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const body = await req.json();

  // Lote: { results: [{ testKey, value, unit?, measuredAt?, referenceRange? }], origin? }
  if (Array.isArray(body.results)) {
    const defaultAt = body.measuredAt
      ? new Date(String(body.measuredAt)).toISOString()
      : new Date().toISOString();
    const saved = [];
    const rejected: { testKey: string; reason: string }[] = [];
    for (const item of body.results) {
      const key = String(item?.testKey || "");
      const val = Number(String(item?.value).replace(",", "."));
      if (!VALID.has(key)) {
        rejected.push({ testKey: key, reason: "exame inválido" });
        continue;
      }
      if (!Number.isFinite(val)) {
        rejected.push({ testKey: key, reason: "valor inválido" });
        continue;
      }
      const at = item?.measuredAt ? new Date(String(item.measuredAt)).toISOString() : defaultAt;
      const lab = await addLabResult({
        patientEmail: access.key,
        doctorId: doctorId || null,
        testKey: key,
        value: val,
        unit: item?.unit ? String(item.unit) : labUnit(key),
        referenceRange: item?.referenceRange ? String(item.referenceRange) : null,
        origin: item?.origin ? String(item.origin) : body.origin ? String(body.origin) : "importado",
        measuredAt: at,
      });
      saved.push(lab);
    }
    return NextResponse.json({ saved, rejected, count: saved.length }, { status: 201 });
  }

  const testKey = String(body.testKey || "");
  if (!VALID.has(testKey)) {
    return NextResponse.json({ error: "Exame inválido." }, { status: 400 });
  }
  const value = Number(String(body.value).replace(",", "."));
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }

  const measuredAt = body.measuredAt ? new Date(String(body.measuredAt)).toISOString() : new Date().toISOString();

  const lab = await addLabResult({
    patientEmail: access.key,
    doctorId: doctorId || null,
    testKey,
    value,
    unit: body.unit ? String(body.unit) : labUnit(testKey),
    referenceRange: body.referenceRange ? String(body.referenceRange) : null,
    origin: body.origin ? String(body.origin) : "médico",
    measuredAt,
  });

  return NextResponse.json({ lab }, { status: 201 });
}
