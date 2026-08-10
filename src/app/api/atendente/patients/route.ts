import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { readDb } from "@/lib/store";
import { createPatient, findByCpf, listPatientsByDoctor, normalizeCpf } from "@/lib/patients-store";
import { logAttendantAudit } from "@/lib/attendants-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId") || "";
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });

  const db = await readDb();
  const created = await listPatientsByDoctor(doctorId);
  const createdRows = created.filter((p) => p.status !== "archived").map((p) => ({
    key: p.id, name: p.name, cpf: p.cpf || "", phone: p.phone || "", email: p.email || "", isCreated: true,
  }));
  const seenEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));
  const byEmail = new Map<string, { key: string; name: string; cpf: string; phone: string; email: string; isCreated: boolean }>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const email = b.patientEmail.toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    if (!byEmail.has(email)) byEmail.set(email, { key: email, name: b.patientName, cpf: "", phone: b.patientPhone, email, isCreated: false });
  }
  let patients = [...createdRows, ...byEmail.values()];
  if (q) patients = patients.filter((p) => p.name.toLowerCase().includes(q) || normalizeCpf(p.cpf).includes(normalizeCpf(q)) || p.phone.includes(q) || p.email.includes(q));
  return NextResponse.json({ patients: patients.slice(0, 30) });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "criarPaciente")) return NextResponse.json({ error: "Sem permissão para criar pacientes." }, { status: 403 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  if (b.cpf && normalizeCpf(b.cpf).length >= 11) {
    const dup = await findByCpf(doctorId, String(b.cpf));
    if (dup) return NextResponse.json({ error: "Já existe um paciente com este CPF.", existingId: dup.id }, { status: 409 });
  }
  const patient = await createPatient({
    doctorId, name,
    cpf: b.cpf ? String(b.cpf) : null,
    birthdate: b.birthdate ? String(b.birthdate) : null,
    sex: b.sex ? String(b.sex) : null,
    phone: b.phone ? String(b.phone) : null,
    email: b.email ? String(b.email) : null,
  });
  await logAttendantAudit({ attendantId: ctx.attendant.id, attendantName: ctx.attendant.name, doctorId, action: "criar_paciente", patientKey: patient.id, detail: `Criou paciente ${name}.` });
  return NextResponse.json({ ok: true, id: patient.id }, { status: 201 });
}
