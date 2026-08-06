import "server-only";
import { getDoctorSessionId } from "./auth";
import { readDb } from "./store";
import { clinicalKey, getPatient } from "./patients-store";

export interface PatientAccess {
  allowed: boolean;
  /** Chave usada nas tabelas clínicas (email do paciente ou "pid:<id>"). */
  key: string;
  name: string;
  city: string;
  phone: string;
  email: string;
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
    if (bks.length === 0) {
      return { allowed: false, key: email, name: "", city: "", phone: "", email, isCreated: false, bookings: [] };
    }
    const latest = db.bookings
      .filter((b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email)
      .sort((a, b) => b.slotStart.localeCompare(a.slotStart))[0];
    return {
      allowed: true,
      key: email,
      name: latest.patientName,
      city: latest.patientCity,
      phone: latest.patientPhone,
      email,
      isCreated: false,
      bookings: bks,
    };
  }

  // Paciente criado pelo médico (param = id)
  const patient = await getPatient(decoded);
  if (!patient || patient.doctorId !== doctorId) {
    return { allowed: false, key: "", name: "", city: "", phone: "", email: "", isCreated: true, bookings: [] };
  }
  const email = patient.email || "";
  return {
    allowed: true,
    key: clinicalKey(patient),
    name: patient.name,
    city: patient.address || "",
    phone: patient.phone || "",
    email,
    isCreated: true,
    bookings: email ? bookingsForEmail(email) : [],
  };
}
