import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { createPatient, deletePatient, findByCpf, findByCpfAny, listPatientsByDoctor, updatePatient } from "@/lib/patients-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const db = await readDb();
  const created = await listPatientsByDoctor(doctorId);
  const createdEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));

  // Pacientes criados pelo médico
  const createdRows = created
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const email = (p.email || "").toLowerCase();
      const bks = email
        ? db.bookings.filter((b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email)
        : [];
      return {
        key: p.id,
        name: p.name,
        city: p.address || "",
        total: bks.length,
        isCreated: true,
        lastSlot: bks.map((b) => b.slotStart).sort().slice(-1)[0] || p.createdAt,
      };
    });

  // Pacientes vindos de agendamento (que não têm cadastro próprio)
  const byEmail = new Map<string, { key: string; name: string; city: string; total: number; isCreated: boolean; lastSlot: string }>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const email = b.patientEmail.toLowerCase();
    if (createdEmails.has(email)) continue;
    const entry = byEmail.get(email) || {
      key: email,
      name: b.patientName,
      city: b.patientCity,
      total: 0,
      isCreated: false,
      lastSlot: b.slotStart,
    };
    entry.total += 1;
    if (b.slotStart > entry.lastSlot) {
      entry.lastSlot = b.slotStart;
      entry.name = b.patientName;
      entry.city = b.patientCity;
    }
    byEmail.set(email, entry);
  }

  const patients = [...createdRows, ...byEmail.values()].sort((a, b) =>
    b.lastSlot.localeCompare(a.lastSlot)
  );

  return NextResponse.json({ patients });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nome completo é obrigatório." }, { status: 400 });
  }

  // Evita duplicidade de CPF e permite vincular conta criada pelo próprio paciente.
  if (b.cpf && String(b.cpf).replace(/\D/g, "").length >= 11) {
    const existingMine = await findByCpf(doctorId, String(b.cpf));
    if (existingMine && existingMine.doctorId === doctorId) {
      return NextResponse.json(
        {
          error: "Já existe um paciente com este CPF.",
          existingId: existingMine.id,
          existingIsMine: true,
        },
        { status: 409 }
      );
    }
    const existingAny = await findByCpfAny(String(b.cpf));
    if (existingAny) {
      if (existingAny.doctorId === doctorId) {
        return NextResponse.json(
          {
            error: "Já existe um paciente com este CPF.",
            existingId: existingAny.id,
            existingIsMine: true,
          },
          { status: 409 }
        );
      }
      // Conta criada pelo paciente (sem médico) → vincula ao prontuário deste médico.
      if (!existingAny.doctorId) {
        const linked = await updatePatient(existingAny.id, {
          doctorId,
          name: name || existingAny.name,
          phone: b.phone ? String(b.phone) : existingAny.phone,
          email: b.email ? String(b.email) : existingAny.email,
          birthdate: b.birthdate ? String(b.birthdate) : existingAny.birthdate,
          sex: b.sex ? String(b.sex) : existingAny.sex,
          address: b.address ? String(b.address) : existingAny.address,
        });
        return NextResponse.json(
          { ok: true, id: linked?.id || existingAny.id, linkedExisting: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          error: "Já existe um paciente com este CPF.",
          existingId: existingAny.id,
          existingIsMine: false,
        },
        { status: 409 }
      );
    }
  }

  // Alerta de possível duplicado por nome parecido (quando não travou por CPF).
  // Não bloqueia: o médico pode confirmar que é a mesma pessoa (abrir) ou criar mesmo assim (force).
  if (b.force !== true) {
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const n = norm(name);
    const tokens = n.split(" ");
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const mine = await listPatientsByDoctor(doctorId);
    const dup = mine.find((p) => {
      const pn = norm(p.name);
      if (pn === n) return true;
      const pt = pn.split(" ");
      return tokens.length > 1 && pt.length > 1 && pt[0] === first && pt[pt.length - 1] === last;
    });
    if (dup) {
      return NextResponse.json(
        { possibleDuplicate: true, existing: { id: dup.id, name: dup.name, cpf: dup.cpf || null } },
        { status: 200 }
      );
    }
  }

  const patient = await createPatient({
    doctorId,
    name,
    cpf: b.cpf ? String(b.cpf) : null,
    cns: b.cns ? String(b.cns).replace(/\s+/g, "") : null,
    motherName: b.motherName ? String(b.motherName) : null,
    birthdate: b.birthdate ? String(b.birthdate) : null,
    sex: b.sex ? String(b.sex) : null,
    phone: b.phone ? String(b.phone) : null,
    email: b.email ? String(b.email) : null,
    address: b.address ? String(b.address) : null,
    emergencyContact: b.emergencyContact ? String(b.emergencyContact) : null,
    guardianName: b.guardianName ? String(b.guardianName) : null,
    guardianPhone: b.guardianPhone ? String(b.guardianPhone) : null,
    insurance: b.insurance ? String(b.insurance) : null,
    allergies: b.allergies ? String(b.allergies) : null,
    diseases: b.diseases ? String(b.diseases) : null,
    medications: b.medications ? String(b.medications) : null,
    notes: b.notes ? String(b.notes) : null,
  });

  return NextResponse.json({ ok: true, id: patient.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const id = String(body.id || "");
  const ok = await deletePatient(id, doctorId);
  if (!ok) {
    return NextResponse.json(
      { error: "Paciente não encontrado ou sem permissão para excluir." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
