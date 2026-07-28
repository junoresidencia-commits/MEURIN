import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type { Database, Doctor, WeeklySlot } from "./types";

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
  "id" | "passwordHash" | "blockedSlots" | "createdAt" | "stripeConnectReady"
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
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Database;
    // If an old tiny seed exists, expand once for demo richness
    if (db.doctors.length < 4) {
      const doctors = await seedDoctors();
      const next = { ...db, doctors };
      await writeDb(next);
      return next;
    }
    return db;
  } catch {
    const doctors = await seedDoctors();
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
