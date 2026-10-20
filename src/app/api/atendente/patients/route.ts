import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { getAttendantId } from "@/lib/attendant-session";
import { listBookingsForDoctor } from "@/lib/store";
import { listPatientsByDoctor, normalizeCpf } from "@/lib/patients-store";
import { listLinksForAttendant } from "@/lib/attendants-store";
import { syncAttendantClinicDoctors } from "@/lib/clinic-ops-store";
import { resolveOrCreatePatientForDoctor } from "@/lib/attendant-create-patient";
import { parseAgeYears } from "@/lib/patient-age";

async function resolveDoctorId(raw: string): Promise<string> {
  const asked = String(raw || "").trim();
  if (asked) return asked;
  const attendantId = await getAttendantId();
  if (!attendantId) return "";
  const links = await listLinksForAttendant(attendantId);
  return links[0]?.doctorId || "";
}

async function ctxForDoctor(doctorId: string) {
  const ctx = await requireAttendantForDoctor(doctorId);
  if (ctx) return ctx;
  const attendantId = await getAttendantId();
  if (!attendantId) return null;
  try {
    await syncAttendantClinicDoctors(attendantId);
  } catch {
    /* vínculo extra é melhor-esforço */
  }
  return requireAttendantForDoctor(doctorId);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = await resolveDoctorId(searchParams.get("doctorId") || "");
  if (!doctorId) return NextResponse.json({ error: "Sem médico vinculado. Peça ao médico para te incluir em Minha equipe." }, { status: 400 });
  const ctx = await ctxForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });

  const [mine, created] = await Promise.all([listBookingsForDoctor(doctorId), listPatientsByDoctor(doctorId)]);
  const createdRows = created.filter((p) => p.status !== "archived").map((p) => ({
    key: p.id, name: p.name, cpf: p.cpf || "", phone: p.phone || "", email: p.email || "", isCreated: true,
  }));
  const seenEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));
  const byEmail = new Map<string, { key: string; name: string; cpf: string; phone: string; email: string; isCreated: boolean }>();
  for (const b of mine) {
    const email = b.patientEmail.toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    if (!byEmail.has(email)) byEmail.set(email, { key: email, name: b.patientName, cpf: "", phone: b.patientPhone, email, isCreated: false });
  }
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  let patients = [...createdRows, ...byEmail.values()];
  if (q) patients = patients.filter((p) => p.name.toLowerCase().includes(q) || normalizeCpf(p.cpf).includes(normalizeCpf(q)) || p.phone.includes(q) || p.email.includes(q));
  return NextResponse.json({ patients: patients.slice(0, 30), canCreate: hasPerm(ctx.link, "criarPaciente") });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = await resolveDoctorId(String(b.doctorId || ""));
  if (!doctorId) return NextResponse.json({ error: "Sem médico vinculado. Peça ao médico para te incluir em Minha equipe." }, { status: 400 });
  const ctx = await ctxForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "criarPaciente")) return NextResponse.json({ error: "Sem permissão para criar pacientes. Peça ao médico para ligar “Criar paciente” na equipe." }, { status: 403 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const birthdate = b.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(String(b.birthdate)) ? String(b.birthdate) : null;
  const ageYears = !birthdate ? parseAgeYears(b.ageYears != null ? b.ageYears : b.age) : null;
  const ageReportedAt = !birthdate && ageYears != null
    ? new Date().toISOString().slice(0, 10)
    : null;

  try {
    const result = await resolveOrCreatePatientForDoctor({
      doctorId,
      attendantId: ctx.attendant.id,
      attendantName: ctx.attendant.name,
      draft: {
        name,
        cpf: b.cpf ? String(b.cpf) : null,
        cns: b.cns ? String(b.cns).replace(/\s+/g, "") : null,
        motherName: b.motherName ? String(b.motherName) : null,
        birthdate,
        ageYears,
        ageReportedAt,
        sex: b.sex ? String(b.sex) : null,
        phone: b.phone ? String(b.phone) : null,
        email: b.email ? String(b.email) : null,
        address: b.address ? String(b.address) : null,
      },
    });
    const { patient } = result;
    return NextResponse.json(
      {
        ok: true,
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        linkedExisting: result.linkedExisting,
        alreadyOnDoctor: result.alreadyOnDoctor,
        matchedBy: result.matchedBy,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (err) {
    console.error("[atendente] criar paciente", err);
    const raw = err instanceof Error ? err.message : "";
    const technical = /erofs|eacces|pgrst|postgres|uuid|null value|schema cache|could not find the table/i.test(raw);
    return NextResponse.json(
      { error: !raw || technical ? "Não foi possível cadastrar o paciente. Tente de novo em instantes." : raw },
      { status: 500 }
    );
  }
}
