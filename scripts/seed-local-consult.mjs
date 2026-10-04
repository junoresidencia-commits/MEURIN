import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

const ROOM = "bb380928-a49d-4d4e-9b23-2f3105ad9935";
const DOCTOR_ID = "9592e5c6-73ee-4f0b-9a6f-b2ac93f4e43b";

async function main() {
  const passwordHash = await bcrypt.hash("medico123", 10);
  const now = new Date().toISOString();
  const db = {
    doctors: [
      {
        id: DOCTOR_ID,
        passwordHash,
        status: "approved",
        stripeConnectReady: true,
        blockedSlots: [],
        createdAt: now,
        weeklyAvailability: [{ dayOfWeek: 1, start: "08:00", end: "18:00" }],
        name: "Dr. Carlos Nephro",
        email: "carlos@meurim.com",
        crm: "CRM-SP 123456",
        specialty: "Nefrologia clínica",
        consultationPriceCents: 35000,
        pixKey: "carlos@meurim.com",
      },
    ],
    bookings: [
      {
        id: "fcbaa58c-6505-410f-8a58-8793c6819bd5",
        doctorId: DOCTOR_ID,
        patientName: "Maria da Prestação",
        patientEmail: "maria.prestacao@example.com",
        patientPhone: "71999990000",
        careReason: "acompanhamento",
        slotStart: now,
        slotEnd: now,
        priceCents: 0,
        paymentMethod: "pix",
        status: "confirmed",
        meetingRoomId: ROOM,
        confirmationEmailSent: false,
        createdAt: now,
      },
    ],
    payments: [],
    signaling: [],
  };
  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "db.json"), JSON.stringify(db, null, 2));
  console.log("seed-local-consult ok", ROOM);
}

main();
