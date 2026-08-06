import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type { Database, Doctor, PaymentRecord, SignalingMessage, WeeklySlot } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const defaultWeekly: WeeklySlot[] = [
  { dayOfWeek: 1, start: "08:00", end: "12:00" },
  { dayOfWeek: 1, start: "14:00", end: "18:00" },
  { dayOfWeek: 2, start: "08:00", end: "12:00" },
  { dayOfWeek: 2, start: "14:00", end: "18:00" },
  { dayOfWeek: 3, start: "08:00", end: "12:00" },
  { dayOfWeek: 3, start: "14:00", end: "18:00" },
  { dayOfWeek: 4, start: "08:00", end: "12:00" },
  { dayOfWeek: 4, start: "14:00", end: "18:00" },
  { dayOfWeek: 5, start: "08:00", end: "12:00" },
];

const morningOnly: WeeklySlot[] = [
  { dayOfWeek: 1, start: "08:00", end: "12:00" },
  { dayOfWeek: 3, start: "08:00", end: "12:00" },
  { dayOfWeek: 5, start: "08:00", end: "12:00" },
];

const eveningHeavy: WeeklySlot[] = [
  { dayOfWeek: 2, start: "14:00", end: "20:00" },
  { dayOfWeek: 4, start: "14:00", end: "20:00" },
  { dayOfWeek: 6, start: "09:00", end: "13:00" },
];

type SeedInput = Omit<
  Doctor,
  | "id"
  | "passwordHash"
  | "blockedSlots"
  | "createdAt"
  | "stripeConnectReady"
  | "status"
  | "phone"
  | "crmState"
  | "rqe"
  | "clinic"
  | "adminNote"
> & { weeklyAvailability?: WeeklySlot[] };

async function seedDoctors(): Promise<Doctor[]> {
  const passwordHash = await bcrypt.hash("medico123", 10);
  const now = new Date().toISOString();

  const roster: SeedInput[] = [
    {
      name: "Dr. Carlos Nephro",
      email: "carlos@meurim.com",
      crm: "CRM-SP 123456",
      specialty: "Nefrologia clínica",
      bio: "Atende online pacientes de qualquer cidade — DRC, diálise e acompanhamento sem deslocamento.",
      consultationPriceCents: 35000,
      pixKey: "carlos@meurim.com",
      bankAccountHint: "Conta PJ · Itaú",
      weeklyAvailability: defaultWeekly,
    },
    {
      name: "Dra. Ana Renal",
      email: "ana@meurim.com",
      crm: "CRM-RJ 654321",
      specialty: "Nefrologia e hipertensão",
      bio: "Teleconsulta de nefrologia e hipertensão para quem está no interior ou com agenda apertada.",
      consultationPriceCents: 32000,
      pixKey: "ana@meurim.com",
      bankAccountHint: "Conta PJ · Nubank",
      weeklyAvailability: defaultWeekly,
    },
    {
      name: "Dr. Pedro Filtração",
      email: "pedro@meurim.com",
      crm: "CRM-MG 112233",
      specialty: "DRC e glomerulopatias",
      bio: "Foco em preservação da TFG e segunda opinião de exames.",
      consultationPriceCents: 30000,
      pixKey: "pedro@meurim.com",
      bankAccountHint: "Conta PJ · Bradesco",
      weeklyAvailability: morningOnly,
    },
    {
      name: "Dra. Beatriz Dialise",
      email: "beatriz@meurim.com",
      crm: "CRM-BA 445566",
      specialty: "Diálise e pré-diálise",
      bio: "Acompanhamento de pacientes em diálise e preparação para TRS, 100% online.",
      consultationPriceCents: 34000,
      pixKey: "beatriz@meurim.com",
      weeklyAvailability: eveningHeavy,
    },
    {
      name: "Dr. Lucas Hipertensão",
      email: "lucas@meurim.com",
      crm: "CRM-PR 778899",
      specialty: "Hipertensão secundária",
      bio: "Pressão de difícil controle e proteção renal — horários noturnos.",
      consultationPriceCents: 28000,
      pixKey: "lucas@meurim.com",
      weeklyAvailability: eveningHeavy,
    },
    {
      name: "Dra. Marina Lítio-Rim",
      email: "marina@meurim.com",
      crm: "CRM-RS 998877",
      specialty: "Nefrologia clínica",
      bio: "Atende interior e capital com linguagem clara e plano de exames.",
      consultationPriceCents: 31000,
      pixKey: "marina@meurim.com",
      weeklyAvailability: defaultWeekly,
    },
    {
      name: "Dr. Rafael Transplante",
      email: "rafael@meurim.com",
      crm: "CRM-DF 334455",
      specialty: "Transplante renal",
      bio: "Acompanhamento pós-transplante e dúvidas de imunossupressão em teleconsulta.",
      consultationPriceCents: 40000,
      pixKey: "rafael@meurim.com",
      weeklyAvailability: morningOnly,
    },
    {
      name: "Dra. Camila Pediátrica",
      email: "camila@meurim.com",
      crm: "CRM-CE 556677",
      specialty: "Nefrologia pediátrica",
      bio: "Orientação a famílias — creatinina, ITU de repetição e acompanhamento.",
      consultationPriceCents: 33000,
      pixKey: "camila@meurim.com",
      weeklyAvailability: defaultWeekly,
    },
  ];

  return roster.map((d) => ({
    id: uuid(),
    passwordHash,
    status: "approved" as const,
    stripeConnectReady: Boolean(d.pixKey || d.bankAccountHint),
    blockedSlots: [],
    createdAt: now,
    weeklyAvailability: d.weeklyAvailability || defaultWeekly,
    name: d.name,
    email: d.email,
    crm: d.crm,
    specialty: d.specialty,
    bio: d.bio,
    consultationPriceCents: d.consultationPriceCents,
    pixKey: d.pixKey,
    bankAccountHint: d.bankAccountHint,
  }));
}

export async function readDb(): Promise<Database> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    return readSupabaseDb();
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Database;
    // Médicos de demonstração só quando SEED_DEMO=1 (produção começa vazia).
    if (process.env.SEED_DEMO === "1" && db.doctors.length < 4) {
      const doctors = await seedDoctors();
      const next = { ...db, doctors };
      await writeDb(next);
      return next;
    }
    return db;
  } catch {
    const doctors = process.env.SEED_DEMO === "1" ? await seedDoctors() : [];
    const db: Database = {
      doctors,
      bookings: [],
      payments: [],
      signaling: [],
    };
    await writeDb(db);
    return db;
  }
}

export async function writeDb(db: Database): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await writeSupabaseDb(db);
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function updateDb(
  updater: (db: Database) => Database | Promise<Database>
): Promise<Database> {
  const db = await readDb();
  const next = await updater(db);
  await writeDb(next);
  return next;
}

/** Remove um médico de verdade (writeDb usa upsert, então a exclusão precisa ser explícita). */
export async function deleteDoctor(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Database;
    db.doctors = db.doctors.filter((d) => d.id !== id);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch {
    /* nada a remover */
  }
}

function fromJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapDoctorRow(row: Record<string, unknown>): Doctor {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    crm: String(row.crm),
    specialty: String(row.specialty),
    bio: String(row.bio ?? ""),
    consultationPriceCents: Number(row.consultation_price_cents),
    pixKey: row.pix_key ? String(row.pix_key) : undefined,
    bankAccountHint: row.bank_account_hint ? String(row.bank_account_hint) : undefined,
    stripeConnectReady: Boolean(row.stripe_connect_ready),
    weeklyAvailability: fromJsonArray<WeeklySlot>(row.weekly_availability),
    blockedSlots: fromJsonArray<string>(row.blocked_slots),
    createdAt: new Date(String(row.created_at)).toISOString(),
    status: (row.status ? String(row.status) : "approved") as Doctor["status"],
    phone: row.phone ? String(row.phone) : undefined,
    crmState: row.crm_state ? String(row.crm_state) : undefined,
    rqe: row.rqe ? String(row.rqe) : undefined,
    clinic: row.clinic ? String(row.clinic) : undefined,
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
  };
}

function mapBookingRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    doctorId: String(row.doctor_id),
    patientName: String(row.patient_name),
    patientEmail: String(row.patient_email),
    patientPhone: String(row.patient_phone ?? ""),
    patientCity: String(row.patient_city ?? ""),
    careReason: String(row.care_reason) as
      | "pressa"
      | "acompanhamento"
      | "segunda_opiniao"
      | "outro",
    slotStart: new Date(String(row.slot_start)).toISOString(),
    slotEnd: new Date(String(row.slot_end)).toISOString(),
    priceCents: Number(row.price_cents),
    paymentMethod: String(row.payment_method) as "card" | "pix" | "boleto",
    status: String(row.status) as
      | "pending_payment"
      | "paid"
      | "confirmed"
      | "completed"
      | "cancelled",
    meetingRoomId: String(row.meeting_room_id),
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : undefined,
    confirmationEmailSent: Boolean(row.confirmation_email_sent),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapPaymentRow(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id),
    bookingId: String(row.booking_id),
    doctorId: String(row.doctor_id),
    amountCents: Number(row.amount_cents),
    method: String(row.method) as "card" | "pix" | "boleto",
    status: String(row.status) as "succeeded" | "failed" | "pending",
    doctorPayoutCents: Number(row.doctor_payout_cents),
    platformFeeCents: Number(row.platform_fee_cents),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapSignalRow(row: Record<string, unknown>): SignalingMessage {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    from: String(row.from_role) as "doctor" | "patient",
    type: String(row.type) as "offer" | "answer" | "ice",
    payload: String(row.payload),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

async function readSupabaseDb(): Promise<Database> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const [doctorsRes, bookingsRes, paymentsRes, signalingRes] = await Promise.all([
    supabase.from("doctors").select("*").order("created_at", { ascending: true }),
    supabase.from("bookings").select("*").order("created_at", { ascending: true }),
    supabase.from("payments").select("*").order("created_at", { ascending: true }),
    supabase.from("signaling_messages").select("*").order("created_at", { ascending: true }),
  ]);

  if (doctorsRes.error) throw doctorsRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (signalingRes.error) throw signalingRes.error;

  const doctors = (doctorsRes.data ?? []).map((row) =>
    mapDoctorRow(row as unknown as Record<string, unknown>)
  );

  if (doctors.length === 0 && process.env.SEED_DEMO === "1") {
    const seeded: Database = {
      doctors: await seedDoctors(),
      bookings: [],
      payments: [],
      signaling: [],
    };
    await writeSupabaseDb(seeded);
    return seeded;
  }

  return {
    doctors,
    bookings: (bookingsRes.data ?? []).map((row) =>
      mapBookingRow(row as unknown as Record<string, unknown>)
    ),
    payments: (paymentsRes.data ?? []).map((row) =>
      mapPaymentRow(row as unknown as Record<string, unknown>)
    ),
    signaling: (signalingRes.data ?? []).map((row) =>
      mapSignalRow(row as unknown as Record<string, unknown>)
    ),
  };
}

async function writeSupabaseDb(db: Database): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const doctors = db.doctors.map((doctor) => ({
    id: doctor.id,
    name: doctor.name,
    email: doctor.email,
    password_hash: doctor.passwordHash,
    crm: doctor.crm,
    specialty: doctor.specialty,
    bio: doctor.bio,
    consultation_price_cents: doctor.consultationPriceCents,
    pix_key: doctor.pixKey ?? null,
    bank_account_hint: doctor.bankAccountHint ?? null,
    stripe_connect_ready: doctor.stripeConnectReady,
    weekly_availability: doctor.weeklyAvailability,
    blocked_slots: doctor.blockedSlots,
    created_at: doctor.createdAt,
    status: doctor.status ?? "approved",
    phone: doctor.phone ?? null,
    crm_state: doctor.crmState ?? null,
    rqe: doctor.rqe ?? null,
    clinic: doctor.clinic ?? null,
    admin_note: doctor.adminNote ?? null,
  }));

  const bookings = db.bookings.map((booking) => ({
    id: booking.id,
    doctor_id: booking.doctorId,
    patient_name: booking.patientName,
    patient_email: booking.patientEmail,
    patient_phone: booking.patientPhone,
    patient_city: booking.patientCity,
    care_reason: booking.careReason,
    slot_start: booking.slotStart,
    slot_end: booking.slotEnd,
    price_cents: booking.priceCents,
    payment_method: booking.paymentMethod,
    status: booking.status,
    meeting_room_id: booking.meetingRoomId,
    payment_id: booking.paymentId ?? null,
    paid_at: booking.paidAt ?? null,
    confirmation_email_sent: booking.confirmationEmailSent,
    created_at: booking.createdAt,
  }));

  const payments = db.payments.map((payment) => ({
    id: payment.id,
    booking_id: payment.bookingId,
    doctor_id: payment.doctorId,
    amount_cents: payment.amountCents,
    method: payment.method,
    status: payment.status,
    doctor_payout_cents: payment.doctorPayoutCents,
    platform_fee_cents: payment.platformFeeCents,
    created_at: payment.createdAt,
  }));

  const signaling = db.signaling.map((message) => ({
    id: message.id,
    room_id: message.roomId,
    from_role: message.from,
    type: message.type,
    payload: message.payload,
    created_at: message.createdAt,
  }));

  const tables: Array<{
    name: "doctors" | "bookings" | "payments" | "signaling_messages";
    rows: Record<string, unknown>[];
  }> = [
    { name: "doctors", rows: doctors },
    { name: "bookings", rows: bookings },
    { name: "payments", rows: payments },
    { name: "signaling_messages", rows: signaling },
  ];

  // Upsert por id em vez de apagar tudo e reinserir: preserva linhas criadas
  // concorrentemente (ex.: dois agendamentos ao mesmo tempo) em vez de sobrescrever
  // a tabela inteira com a visão de uma única requisição.
  for (const table of tables) {
    if (table.rows.length > 0) {
      const { error } = await supabase.from(table.name).upsert(table.rows, {
        onConflict: "id",
      });
      if (error) throw error;
    }
  }
}
