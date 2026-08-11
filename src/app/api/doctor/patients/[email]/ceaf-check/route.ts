import { NextResponse } from "next/server";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getLabResults } from "@/lib/patient-store";
import { effectiveExams, getProtocol } from "@/lib/ceaf-catalog";

/** Confere os exames exigidos por um protocolo/medicamentos contra os exames reais do paciente. */
export async function POST(req: Request, ctx: { params: Promise<{ email: string }> }) {
  const { email } = await ctx.params;
  const access = await resolvePatientAccess(email);
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const protocolId = String(body.protocolId || "");
  const medIds = Array.isArray(body.medIds) ? body.medIds.map(String) : [];
  const protocol = getProtocol(protocolId);
  if (!protocol) return NextResponse.json({ error: "Protocolo não encontrado no catálogo oficial." }, { status: 400 });

  const labs = await getLabResults(access.key);
  const latestByKey = new Map<string, { value: number; unit?: string | null; measuredAt: string }>();
  for (const l of labs) {
    const cur = latestByKey.get(l.testKey);
    if (!cur || l.measuredAt > cur.measuredAt) latestByKey.set(l.testKey, { value: l.value, unit: l.unit, measuredAt: l.measuredAt });
  }

  const now = Date.now();
  const exams = effectiveExams(protocolId, medIds).map((e) => {
    if (!e.testKey) {
      return { label: e.label, required: e.required, validityDays: e.validityDays, autoCheck: false, status: "anexar", note: e.note };
    }
    const found = latestByKey.get(e.testKey);
    if (!found) return { label: e.label, testKey: e.testKey, required: e.required, validityDays: e.validityDays, autoCheck: true, status: "ausente", note: e.note };
    const ageDays = Math.floor((now - new Date(found.measuredAt).getTime()) / 86400000);
    const valid = ageDays <= e.validityDays;
    return {
      label: e.label, testKey: e.testKey, required: e.required, validityDays: e.validityDays, autoCheck: true,
      status: valid ? "valido" : "vencido",
      value: found.value, unit: found.unit ?? null, measuredAt: found.measuredAt, ageDays, note: e.note,
    };
  });

  const pendencias = exams.filter((e) => e.required && (e.status === "ausente" || e.status === "vencido")).length;
  return NextResponse.json({ protocol: { id: protocol.id, name: protocol.name, source: protocol.source, lastReview: protocol.lastReview }, exams, pendencias });
}
