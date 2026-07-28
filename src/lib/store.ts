import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type { Database, Doctor } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const defaultWeekly = [
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

async function seedDoctors(): Promise<Doctor[]> {
  const passwordHash = await bcrypt.hash("medico123", 10);
  const now = new Date().toISOString();
  return [
    {
      id: uuid(),
      name: "Dr. Carlos Nephro",
      email: "carlos@meurim.com",
      passwordHash,
      crm: "CRM-SP 123456",
      specialty: "Nefrologia clínica",
      bio: "Atende online pacientes de qualquer cidade — DRC, diálise e acompanhamento sem deslocamento.",
      consultationPriceCents: 35000,
      pixKey: "carlos@meurim.com",
      bankAccountHint: "Conta PJ · Itaú",
      stripeConnectReady: true,
      weeklyAvailability: defaultWeekly,
      blockedSlots: [],
      createdAt: now,
    },
    {
      id: uuid(),
      name: "Dra. Ana Renal",
      email: "ana@meurim.com",
      passwordHash,
      crm: "CRM-RJ 654321",
      specialty: "Nefrologia e hipertensão",
      bio: "Teleconsulta de nefrologia e hipertensão para quem está no interior ou com agenda apertada.",
      consultationPriceCents: 32000,
      pixKey: "ana@meurim.com",
      bankAccountHint: "Conta PJ · Nubank",
      stripeConnectReady: true,
      weeklyAvailability: defaultWeekly,
      blockedSlots: [],
      createdAt: now,
    },
  ];
}

export async function readDb(): Promise<Database> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as Database;
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
