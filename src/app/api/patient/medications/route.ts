import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { listMedications, addMedication, listAdherence } from "@/lib/medications-store";
import { REASON_OPTIONS, buildDays, todayStr } from "@/lib/medications-adherence";

function sanitizeTimes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const s = String(t).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const hh = String(Math.min(23, Number(m[1]))).padStart(2, "0");
    out.push(`${hh}:${m[2]}`);
  }
  return Array.from(new Set(out)).sort();
}
function validDate(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayStr();
}

export async function GET(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const date = validDate(new URL(req.url).searchParams.get("date"));
  const [medications, logs] = await Promise.all([
    listMedications(email, { includeSuspended: true }),
    listAdherence(email, { from: date, to: date }),
  ]);
  const days = buildDays(medications, logs, date, date);
  const doses = days[0]?.doses ?? [];
  return NextResponse.json({ date, medications, doses, reasons: REASON_OPTIONS });
}

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Informe o nome do medicamento." }, { status: 400 });
  const med = await addMedication({
    patientKey: email,
    doctorId: null,
    name,
    dose: b.dose ? String(b.dose).trim() : null,
    quantity: b.quantity ? String(b.quantity).trim() : null,
    frequency: b.frequency ? String(b.frequency).trim() : null,
    times: sanitizeTimes(b.times),
    guidance: b.guidance ? String(b.guidance).trim() : null,
    notes: b.notes ? String(b.notes).trim() : null,
    source: "patient",
    confirmedByDoctor: false,
    confirmedAt: null,
    confirmedBy: null,
    status: "active",
    suspendedAt: null,
    suspendedBy: null,
    suspendReason: null,
  });
  return NextResponse.json({ ok: true, medication: med }, { status: 201 });
}
