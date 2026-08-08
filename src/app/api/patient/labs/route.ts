import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getLabResults } from "@/lib/patient-store";

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const labs = await getLabResults(subject);
  return NextResponse.json({
    labs: labs.map((l) => ({
      testKey: l.testKey,
      value: l.value,
      unit: l.unit ?? null,
      measuredAt: l.measuredAt,
    })),
  });
}
