import "server-only";
import {
  getNutritionist,
  listConsultationsForPatient,
  listNutritionLinksForDoctor,
  listReferralsForPatient,
  type Nutritionist,
} from "./nutritionists-store";
import {
  createAppointment,
  listAppointmentsForPatient,
  type NutritionAppointment,
} from "./nutrition-appointments-store";
import { findByEmailAny, getPatient, type Patient } from "./patients-store";
import { buildPixBrCode } from "./pix-brcode";

export const PAID_NUTRITION_STATUSES = new Set(["confirmada", "realizada"]);

export type PublicNutritionistContact = {
  id: string;
  name: string;
  specialty: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  consultationPriceCents: number | null;
  returnPriceCents: number | null;
  hasPix: boolean;
};

export function toPublicNutritionistContact(n: Nutritionist): PublicNutritionistContact {
  return {
    id: n.id,
    name: n.name,
    specialty: n.specialty ?? null,
    photoUrl: n.photoUrl ?? null,
    phone: n.phone ?? null,
    email: n.email ?? null,
    consultationPriceCents: n.consultationPriceCents ?? null,
    returnPriceCents: n.returnPriceCents ?? null,
    hasPix: Boolean(n.pixProfile?.key),
  };
}

async function patientForKey(patientKey: string): Promise<Patient | null> {
  if (patientKey.startsWith("pid:")) return getPatient(patientKey.slice(4));
  return findByEmailAny(patientKey);
}

function fallbackContactFromName(id: string | null | undefined, name: string | null | undefined): PublicNutritionistContact | null {
  if (!id && !name) return null;
  return {
    id: id || "nutritionist",
    name: name || "Nutricionista",
    specialty: "Nutrição",
    photoUrl: null,
    phone: null,
    email: null,
    consultationPriceCents: null,
    returnPriceCents: null,
    hasPix: false,
  };
}

/** Nutricionista do paciente: consulta, encaminhamento, agendamento ou equipe do médico. */
export async function resolvePatientNutritionist(patientKey: string): Promise<Nutritionist | null> {
  const consults = await listConsultationsForPatient(patientKey);
  for (const c of consults) {
    if (!c.nutritionistId) continue;
    const n = await getNutritionist(c.nutritionistId);
    if (n && n.status === "active") return n;
  }

  const refs = await listReferralsForPatient(patientKey);
  for (const r of refs) {
    if (!r.nutritionistId) continue;
    const n = await getNutritionist(r.nutritionistId);
    if (n && n.status === "active") return n;
  }

  const appts = await listAppointmentsForPatient(patientKey);
  for (const a of appts) {
    const n = await getNutritionist(a.nutritionistId);
    if (n && n.status === "active") return n;
  }

  const patient = await patientForKey(patientKey);
  const doctorId = patient?.doctorId || refs[0]?.doctorId || consults[0]?.doctorId || null;
  if (!doctorId) return null;
  const links = await listNutritionLinksForDoctor(doctorId);
  const active = links.find((l) => l.active && l.nutritionist.status === "active");
  return active?.nutritionist ?? null;
}

/** Contato público (sem chave Pix crua) + registro completo quando existir. */
export async function resolvePatientNutritionContext(patientKey: string): Promise<{
  nutritionist: Nutritionist | null;
  contact: PublicNutritionistContact | null;
}> {
  const nutritionist = await resolvePatientNutritionist(patientKey);
  if (nutritionist) return { nutritionist, contact: toPublicNutritionistContact(nutritionist) };

  const consults = await listConsultationsForPatient(patientKey);
  const refs = await listReferralsForPatient(patientKey);
  const appts = await listAppointmentsForPatient(patientKey);
  const contact =
    fallbackContactFromName(consults[0]?.nutritionistId, consults[0]?.nutritionistName) ||
    fallbackContactFromName(refs[0]?.nutritionistId, null) ||
    fallbackContactFromName(appts[0]?.nutritionistId, appts[0]?.nutritionistName);
  return { nutritionist: null, contact };
}

export function isPaidNutritionStatus(status: string): boolean {
  return PAID_NUTRITION_STATUSES.has(status);
}

/** Pagamento confirmado pela nutricionista (comprovante enviado ainda não libera). */
export async function hasPaidNutritionConsult(patientKey: string, nutritionistId?: string | null): Promise<boolean> {
  const appts = await listAppointmentsForPatient(patientKey);
  return appts.some(
    (a) => isPaidNutritionStatus(a.status) && (!nutritionistId || a.nutritionistId === nutritionistId)
  );
}

export async function canPatientAccessNutritionPlan(patientKey: string, nutritionistId?: string | null): Promise<boolean> {
  return hasPaidNutritionConsult(patientKey, nutritionistId);
}

export async function patientCanViewSharedDocument(
  doc: { type: string; doctorId: string; patientEmail: string; sharedWithPatient: boolean },
  patientKey: string
): Promise<boolean> {
  if (!doc.sharedWithPatient) return false;
  if (doc.patientEmail.toLowerCase() !== patientKey.toLowerCase()) return false;
  if (doc.type === "plano_alimentar") {
    return hasPaidNutritionConsult(patientKey, doc.doctorId);
  }
  return true;
}

function pickDefaultSlot(existing: NutritionAppointment[]): string {
  const occupied = new Set(
    existing.filter((a) => a.status !== "cancelada" && a.slotStart).map((a) => a.slotStart as string)
  );
  const now = Date.now();
  for (let day = 0; day < 21; day++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const slot = new Date(d);
      slot.setHours(hour, 0, 0, 0);
      if (slot.getTime() < now + 60 * 60 * 1000) continue;
      const iso = slot.toISOString();
      if (!occupied.has(iso)) return iso;
    }
  }
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
}

export type RequestNutritionAppointmentResult =
  | { ok: true; appointment: NutritionAppointment; created: boolean; nutritionist: PublicNutritionistContact }
  | { ok: false; error: string; status: number };

/** Paciente pede teleconsulta ou presencial; reusa consulta pendente se já existir. */
export async function requestNutritionAppointment(opts: {
  patientKey: string;
  patientName?: string | null;
  doctorId?: string | null;
  modality: "teleconsulta" | "presencial";
  slotStart?: string | null;
  isReturn?: boolean;
}): Promise<RequestNutritionAppointmentResult> {
  const nut = await resolvePatientNutritionist(opts.patientKey);
  if (!nut) {
    return { ok: false, status: 400, error: "Nenhuma nutricionista vinculada a você ainda. Peça ao seu médico um encaminhamento." };
  }
  if (nut.payoutStatus === "blocked") {
    return { ok: false, status: 403, error: "O recebimento desta nutricionista está temporariamente bloqueado." };
  }

  const existing = await listAppointmentsForPatient(opts.patientKey);
  const pending = existing.find(
    (a) => a.nutritionistId === nut.id && (a.status === "aguardando_pagamento" || a.status === "aguardando_confirmacao")
  );
  if (pending) {
    return { ok: true, appointment: pending, created: false, nutritionist: toPublicNutritionistContact(nut) };
  }

  const patient = await patientForKey(opts.patientKey);
  const isReturn = opts.isReturn === true;
  const priceCents = isReturn ? (nut.returnPriceCents ?? 0) : (nut.consultationPriceCents ?? 0);
  const commission = Math.min(100, Math.max(0, Number(nut.commissionPercent ?? 0)));
  const platformFeeCents = Math.round((priceCents * commission) / 100);
  const pix = nut.pixProfile?.key
    ? buildPixBrCode({ key: nut.pixProfile.key, holderName: nut.pixProfile.holderName, city: nut.pixProfile.city })
    : null;

  const appointment = await createAppointment({
    nutritionistId: nut.id,
    nutritionistName: nut.name,
    doctorId: opts.doctorId || patient?.doctorId || null,
    patientKey: opts.patientKey,
    patientName: opts.patientName || patient?.name || null,
    slotStart: opts.slotStart || pickDefaultSlot(existing),
    modality: opts.modality,
    priceCents,
    status: priceCents > 0 ? "aguardando_pagamento" : "confirmada",
    paymentMethod: "pix_direto",
    pixCopiaCola: pix,
    proofUrl: null,
    commissionPercent: commission,
    platformFeeCents,
    nutritionistPayoutCents: priceCents - platformFeeCents,
    note: null,
  });
  return { ok: true, appointment, created: true, nutritionist: toPublicNutritionistContact(nut) };
}
