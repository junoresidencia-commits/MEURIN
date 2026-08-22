import "server-only";
import { getDoctorSessionId } from "./auth";
import { readDb } from "./store";
import { clinicalKey, getPatient, findByEmailAny } from "./patients-store";

export interface PatientAccess {
  allowed: boolean;
  /** Chave usada nas tabelas clínicas (email do paciente ou "pid:<id>"). */
  key: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  birthdate: string | null;
  sex: string | null;
  cpf: string | null;
  cns: string | null;
  motherName: string | null;
  isCreated: boolean;
  bookings: {
    id: string;
    status: string;
    slotStart: string;
    careReason: string;
    meetingRoomId: string;
  }[];
}

/**
 * Resolve o acesso do médico logado a um paciente identificado por `param`,
 * que pode ser um e-mail (paciente vindo de agendamento) ou o id de um paciente
 * criado pelo médico. Autoriza por vínculo de consulta OU por posse do cadastro.
 */
export async function resolvePatientAccess(param: string): Promise<PatientAccess | null> {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return null;

  const decoded = decodeURIComponent(param).trim();
  const db = await readDb();

  function bookingsForEmail(email: string) {
    return db.bookings
      .filter((b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email.toLowerCase())
      .sort((a, b) => b.slotStart.localeCompare(a.slotStart))
      .map((b) => ({
        id: b.id,
        status: b.status,
        slotStart: b.slotStart,
        careReason: b.careReason,
        meetingRoomId: b.meetingRoomId,
      }));
  }

  if (decoded.includes("@")) {
    const email = decoded.toLowerCase();
    const bks = bookingsForEmail(email);
    if (bks.length > 0) {
      const latest = db.bookings
        .filter((b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email)
        .sort((a, b) => b.slotStart.localeCompare(a.slotStart))[0];
      // Se o médico também tem o CADASTRO desse e-mail, enriquece com os dados do prontuário.
      const owned = await findByEmailAny(email);
      const mine = owned && owned.doctorId === doctorId ? owned : null;
      return {
        allowed: true,
        key: email,
        name: mine?.name || latest.patientName,
        city: mine?.address || latest.patientCity,
        phone: mine?.phone || latest.patientPhone,
        email,
        birthdate: mine?.birthdate || null,
        sex: mine?.sex || null,
        cpf: mine?.cpf || null,
        cns: mine?.cns || null,
        motherName: mine?.motherName || null,
        isCreated: Boolean(mine),
        bookings: bks,
      };
    }
    // Sem consultas: autoriza se o médico é DONO de um cadastro com esse e-mail
    // (paciente criado pelo médico que ainda não tem agendamento).
    const owned = await findByEmailAny(email);
    if (owned && owned.doctorId === doctorId) {
      return {
        allowed: true,
        key: clinicalKey(owned),
        name: owned.name,
        city: owned.address || "",
        phone: owned.phone || "",
        email,
        birthdate: owned.birthdate || null,
        sex: owned.sex || null,
        cpf: owned.cpf || null,
        cns: owned.cns || null,
        motherName: owned.motherName || null,
        isCreated: true,
        bookings: [],
      };
    }
    return { allowed: false, key: email, name: "", city: "", phone: "", email, birthdate: null, sex: null, cpf: null, cns: null, motherName: null, isCreated: false, bookings: [] };
  }

  // Paciente criado pelo médico (param = id ou chave clínica "pid:<id>")
  const patientId = decoded.startsWith("pid:") ? decoded.slice(4) : decoded;
  const patient = await getPatient(patientId);
  if (!patient || patient.doctorId !== doctorId) {
    return { allowed: false, key: "", name: "", city: "", phone: "", email: "", birthdate: null, sex: null, cpf: null, cns: null, motherName: null, isCreated: true, bookings: [] };
  }
  const key = clinicalKey(patient);
  return {
    allowed: true,
    key,
    name: patient.name,
    city: patient.address || "",
    phone: patient.phone || "",
    email: patient.email || "",
    birthdate: patient.birthdate || null,
    sex: patient.sex || null,
    cpf: patient.cpf || null,
    cns: patient.cns || null,
    motherName: patient.motherName || null,
    isCreated: true,
    // Consultas agendadas ficam sob a mesma chave clínica (email ou pid:<id>).
    bookings: bookingsForEmail(key),
  };
}
