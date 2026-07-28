import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { readDb, updateDb } from "@/lib/store";
import { defaultAvailability } from "@/lib/scheduling";
import type { PublicDoctor } from "@/lib/types";

function toPublic(d: {
  id: string;
  name: string;
  email: string;
  crm: string;
  specialty: string;
  bio: string;
  consultationPriceCents: number;
  stripeConnectReady: boolean;
  weeklyAvailability: PublicDoctor["weeklyAvailability"];
  blockedSlots: string[];
  createdAt: string;
}): PublicDoctor {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    crm: d.crm,
    specialty: d.specialty,
    bio: d.bio,
    consultationPriceCents: d.consultationPriceCents,
    stripeConnectReady: d.stripeConnectReady,
    weeklyAvailability: d.weeklyAvailability,
    blockedSlots: d.blockedSlots,
    createdAt: d.createdAt,
  };
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.doctors.map(toPublic));
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    name,
    email,
    password,
    crm,
    specialty,
    bio,
    consultationPriceCents,
    pixKey,
    bankAccountHint,
  } = body;

  if (!name || !email || !password || !crm) {
    return NextResponse.json(
      { error: "Nome, e-mail, senha e CRM são obrigatórios." },
      { status: 400 }
    );
  }

  const db = await readDb();
  if (db.doctors.some((d) => d.email.toLowerCase() === String(email).toLowerCase())) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const doctor = {
    id: uuid(),
    name: String(name),
    email: String(email).toLowerCase(),
    passwordHash,
    crm: String(crm),
    specialty: String(specialty || "Nefrologia"),
    bio: String(bio || ""),
    consultationPriceCents: Number(consultationPriceCents) || 30000,
    pixKey: pixKey ? String(pixKey) : undefined,
    bankAccountHint: bankAccountHint ? String(bankAccountHint) : undefined,
    stripeConnectReady: Boolean(pixKey || bankAccountHint),
    weeklyAvailability: defaultAvailability(),
    blockedSlots: [] as string[],
    createdAt: new Date().toISOString(),
  };

  await updateDb((current) => ({
    ...current,
    doctors: [...current.doctors, doctor],
  }));

  return NextResponse.json(toPublic(doctor), { status: 201 });
}
