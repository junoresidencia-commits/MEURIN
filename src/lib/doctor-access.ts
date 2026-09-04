import "server-only";
import { getDoctorSessionId } from "./auth";
import { readDb } from "./store";
import { clinicalKey, getPatient, findByEmailAny, findPatientByClinicalKey, type Patient } from "./patients-store";
import { hasActiveShareAny } from "./patient-shares-store";

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

function emptyAccess(partial: Partial<PatientAccess> & Pick<PatientAccess, "key" | "email">): PatientAccess {
  return {
    allowed: false,
    name: "",
    city: "",
    phone: "",
    birthdate: null,
    sex: null,
    cpf: null,
    cns: null,
    motherName: null,
    isCreated: false,
    bookings: [],
    ...partial,
  };
}

function fromPatient(patient: Patient, bookings: PatientAccess["bookings"]): PatientAccess {
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
    bookings,
  };
}

async function allowedViaShare(doctorId: string, ...keys: string[]): Promise<boolean> {
  return hasActiveShareAny(doctorId, keys.filter(Boolean));
}

/**
 * Resolve o acesso do médico logado a um paciente identificado por `param`,
 * que pode ser um e-mail (paciente vindo de agendamento) ou o id de um paciente
 * criado pelo médico. Autoriza por vínculo de consulta, posse do cadastro
 * OU compartilhamento ativo (paciente ↔ profissional). Não cria outro cadastro.
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
      return fromPatient(owned, []);
    }
    if (owned && await allowedViaShare(doctorId, email, clinicalKey(owned), owned.id, `pid:${owned.id}`)) {
      return fromPatient(owned, bookingsForEmail(clinicalKey(owned)));
    }
    if (await allowedViaShare(doctorId, email)) {
      return {
        allowed: true,
        key: email,
        name: email,
        city: "",
        phone: "",
        email,
        birthdate: null,
        sex: null,
        cpf: null,
        cns: null,
        motherName: null,
        isCreated: false,
        bookings: [],
      };
    }
    return emptyAccess({ key: email, email });
  }

  // Paciente criado pelo médico (param = id ou chave clínica "pid:<id>")
  const patientId = decoded.startsWith("pid:") ? decoded.slice(4) : decoded;
  const patient = await getPatient(patientId);
  if (patient && patient.doctorId === doctorId) {
    const key = clinicalKey(patient);
    return fromPatient(patient, bookingsForEmail(key));
  }
  if (patient) {
    const key = clinicalKey(patient);
    if (await allowedViaShare(doctorId, decoded, key, patient.id, `pid:${patient.id}`, patient.email || "")) {
      return fromPatient(patient, bookingsForEmail(key));
    }
  }
  if (await allowedViaShare(doctorId, decoded, `pid:${patientId}`, patientId)) {
    const shared = await findPatientByClinicalKey(decoded) || await findPatientByClinicalKey(`pid:${patientId}`);
    if (shared) return fromPatient(shared, bookingsForEmail(clinicalKey(shared)));
    return {
      allowed: true,
      key: decoded.startsWith("pid:") ? decoded : `pid:${patientId}`,
      name: decoded,
      city: "",
      phone: "",
      email: "",
      birthdate: null,
      sex: null,
      cpf: null,
      cns: null,
      motherName: null,
      isCreated: true,
      bookings: [],
    };
  }
  return emptyAccess({ key: "", email: "", isCreated: true });
}
