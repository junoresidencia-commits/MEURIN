import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getDoctorById } from "@/lib/store";
import { listMedications, addMedication, updateMedication, getMedication, listAdherence } from "@/lib/medications-store";
import { buildDays, summarize, todayStr } from "@/lib/medications-adherence";

function sanitizeTimes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    out.push(`${String(Math.min(23, Number(m[1]))).padStart(2, "0")}:${m[2]}`);
  }
  return Array.from(new Set(out)).sort();
}
function addDaysStr(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

export async function GET(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(decodeURIComponent(rawParam));
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const medicationId = url.searchParams.get("medicationId") || undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "") ? url.searchParams.get("to")! : todayStr();
  let from = url.searchParams.get("from") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const n = daysParam === "7" ? 7 : daysParam === "90" ? 90 : 30;
    from = addDaysStr(to, -(n - 1));
  }

  const [medications, logs] = await Promise.all([
    listMedications(access.key, { includeSuspended: true }),
    listAdherence(access.key, { from, to, medicationId }),
  ]);
  const history = buildDays(medications, logs, from, to, medicationId);
  const summary = summarize(history);
  const calendar = history.map((d) => ({ date: d.date, status: d.status }));

  return NextResponse.json({ medications, summary, history, calendar, range: { from, to } });
}

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const doctorId = await getDoctorSessionId();
  const access = await resolvePatientAccess(decodeURIComponent(rawParam));
  if (!doctorId || !access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Informe o nome do medicamento." }, { status: 400 });

  const med = await addMedication({
    patientKey: access.key,
    doctorId,
    name,
    dose: b.dose ? String(b.dose).trim() : null,
    quantity: b.quantity ? String(b.quantity).trim() : null,
    frequency: b.frequency ? String(b.frequency).trim() : null,
    times: sanitizeTimes(b.times),
    guidance: b.guidance ? String(b.guidance).trim() : null,
    notes: b.notes ? String(b.notes).trim() : null,
    source: "doctor",
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

export async function PATCH(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const doctorId = await getDoctorSessionId();
  const access = await resolvePatientAccess(decodeURIComponent(rawParam));
  if (!doctorId || !access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const action = String(b.action || "");
  const med = await getMedication(id);
  if (!med || med.patientKey !== access.key) return NextResponse.json({ error: "Medicamento não encontrado." }, { status: 404 });

  const doctor = await getDoctorById(doctorId);
  const doctorName = doctor?.name || "Médico";
  const now = new Date().toISOString();

  if (action === "confirm") {
    const updated = await updateMedication(id, { confirmedByDoctor: true, confirmedAt: now, confirmedBy: doctorName, doctorId: med.doctorId || doctorId });
    return NextResponse.json({ ok: true, medication: updated });
  }
  if (action === "suspend") {
    const updated = await updateMedication(id, { status: "suspended", suspendedAt: now, suspendedBy: doctorName, suspendReason: b.reason ? String(b.reason).slice(0, 300) : null });
    return NextResponse.json({ ok: true, medication: updated });
  }
  if (action === "reactivate") {
    const updated = await updateMedication(id, { status: "active", suspendedAt: null, suspendedBy: null, suspendReason: null });
    return NextResponse.json({ ok: true, medication: updated });
  }
  if (action === "edit") {
    const updated = await updateMedication(id, {
      name: b.name != null ? String(b.name).trim() : undefined,
      dose: b.dose != null ? (String(b.dose).trim() || null) : undefined,
      quantity: b.quantity != null ? (String(b.quantity).trim() || null) : undefined,
      frequency: b.frequency != null ? (String(b.frequency).trim() || null) : undefined,
      times: b.times != null ? sanitizeTimes(b.times) : undefined,
      guidance: b.guidance != null ? (String(b.guidance).trim() || null) : undefined,
      notes: b.notes != null ? (String(b.notes).trim() || null) : undefined,
    });
    return NextResponse.json({ ok: true, medication: updated });
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
