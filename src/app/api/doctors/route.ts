import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { readDb, updateDb } from "@/lib/store";
import { defaultAvailability } from "@/lib/scheduling";
import type { Doctor, PublicDoctor } from "@/lib/types";

function toPublic(d: Doctor): PublicDoctor {
  const locations = (d.locations || []).filter((l) => l.active !== false);
  const cities = Array.from(
    new Set(locations.map((l) => l.city).filter(Boolean))
  );
  const periods = d.availabilityPeriods || [];
  const onlineAvailable =
    periods.some((p) => p.modality === "teleconsulta") ||
    periods.length === 0; // agenda legado = online por padrão

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
    crmState: d.crmState,
    rqe: d.rqe,
    clinic: d.clinic,
    logoUrl: d.logoUrl,
    photoUrl: d.photoUrl,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      city: l.city,
      address: l.address,
      type: l.type,
      active: l.active,
    })),
    availabilityPeriods: periods.map((p) => ({
      id: p.id,
      dayOfWeek: p.dayOfWeek,
      start: p.start,
      end: p.end,
      modality: p.modality,
      locationId: p.locationId,
      durationMin: p.durationMin,
      intervalMin: p.intervalMin,
      priceCents: p.priceCents,
    })),
    cities,
    onlineAvailable,
  };
}

export async function GET() {
  const db = await readDb();
  const approved = db.doctors.filter((d) => (d.status ?? "approved") === "approved");
  return NextResponse.json(approved.map(toPublic));
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
    phone,
    crmState,
    rqe,
    clinic,
    cpf,
    cns,
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
  const doctor: Doctor = {
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
    blockedSlots: [],
    createdAt: new Date().toISOString(),
    status: "pending",
    phone: phone ? String(phone) : undefined,
    crmState: crmState ? String(crmState) : undefined,
    rqe: rqe ? String(rqe) : undefined,
    clinic: clinic ? String(clinic) : undefined,
    cpf: cpf ? String(cpf).replace(/\D/g, "") : undefined,
    cns: cns ? String(cns).replace(/\s+/g, "") : undefined,
  };

  await updateDb((current) => ({
    ...current,
    doctors: [...current.doctors, doctor],
  }));

  return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
}
