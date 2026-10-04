import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

const passwordHash = await bcrypt.hash("medico123", 10);
const now = new Date().toISOString();

const doctors = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    passwordHash,
    status: "approved",
    stripeConnectReady: false,
    blockedSlots: [],
    createdAt: now,
    weeklyAvailability: [{ dayOfWeek: 1, start: "08:00", end: "18:00" }],
    name: "Carlos Nephro",
    professionalName: "Dr. Carlos Nephro",
    profession: "Médico(a)",
    email: "carlos@meurim.com",
    crm: "123456",
    crmState: "BA",
    specialty: "Nefrologia",
    city: "Irecê",
    state: "BA",
    clinic: "Clínica Renal Irecê",
    consultationPriceCents: 35000,
    bio: "Nefrologista em Irecê.",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    passwordHash,
    status: "approved",
    stripeConnectReady: false,
    blockedSlots: [],
    createdAt: now,
    weeklyAvailability: [{ dayOfWeek: 2, start: "08:00", end: "12:00" }],
    name: "Marina Cardio",
    professionalName: "Dra. Marina Cardio",
    profession: "Médico(a)",
    email: "marina@meurim.com",
    crm: "654321",
    crmState: "BA",
    specialty: "Cardiologia",
    city: "Irecê",
    state: "BA",
    clinic: "Cardio Centro",
    consultationPriceCents: 40000,
    bio: "Cardiologista.",
  },
];

await mkdir(path.join(process.cwd(), "data"), { recursive: true });
await writeFile(
  path.join(process.cwd(), "data", "db.json"),
  JSON.stringify({ doctors, bookings: [], payments: [], signaling: [] }, null, 2)
);
console.log("seeded", doctors.length, "doctors");
