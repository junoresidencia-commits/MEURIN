import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { requireSuperAdmin } from "@/lib/platform-access";
import { emailsMatch } from "@/lib/login-email";
import { defaultAvailability } from "@/lib/scheduling";
import { listDoctors, updateDb } from "@/lib/store";
import { listActiveRolesByActors } from "@/lib/platform-store";
import type { Doctor, DoctorStatus } from "@/lib/types";

const VALID: DoctorStatus[] = ["pending", "approved", "rejected", "suspended", "correction"];

function waiting(status: string) {
  return status === "pending" || status === "correction";
}

/** Lista médicos e cadastros aguardando aceite — no login SUPER_ADMIN. */
export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const doctors = await listDoctors();
  const rolesById = await listActiveRolesByActors(
    "doctor",
    doctors.map((d) => d.id)
  );
  const mapped = doctors
    .map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      crm: d.crm,
      specialty: d.specialty,
      clinic: d.clinic || null,
      phone: d.phone || null,
      status: d.status || "approved",
      createdAt: d.createdAt,
      roles: rolesById[d.id] || [],
      isSelf: d.id === actor.doctorId,
    }))
    .sort((a, b) => {
      const aw = waiting(a.status) ? 0 : 1;
      const bw = waiting(b.status) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  return NextResponse.json({
    doctors: mapped,
    pendingCount: mapped.filter((d) => waiting(d.status)).length,
  });
}

/** Adicionar médico já aceito — mesmo login da área médica. */
export async function POST(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");
  const crm = String(body.crm || "").trim();
  if (!name || !email || !password || !crm) {
    return NextResponse.json({ error: "Nome, e-mail, senha e CRM são obrigatórios." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }
  const doctors = await listDoctors();
  if (doctors.some((d) => emailsMatch(d.email, email))) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const doctor: Doctor = {
    id: uuid(),
    name,
    email,
    passwordHash,
    crm,
    specialty: String(body.specialty || "Nefrologia").trim() || "Nefrologia",
    bio: "",
    consultationPriceCents: Number(body.consultationPriceCents) || 30000,
    pixKey: body.pixKey ? String(body.pixKey) : undefined,
    stripeConnectReady: Boolean(body.pixKey),
    weeklyAvailability: defaultAvailability(),
    blockedSlots: [],
    createdAt: new Date().toISOString(),
    status: "approved",
    phone: body.phone ? String(body.phone) : undefined,
    crmState: body.crmState ? String(body.crmState) : undefined,
    clinic: body.clinic ? String(body.clinic) : undefined,
  };
  await updateDb((current) => ({ ...current, doctors: [...current.doctors, doctor] }));
  return NextResponse.json({ ok: true, id: doctor.id, status: doctor.status }, { status: 201 });
}

/** Aceitar ou recusar cadastro de médico — mesmo login da área médica. */
export async function PATCH(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "") as DoctorStatus;
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (id === actor.doctorId && (status === "rejected" || status === "suspended")) {
    return NextResponse.json({ error: "Você não pode recusar a própria conta." }, { status: 400 });
  }
  let found = false;
  await updateDb((current) => {
    found = current.doctors.some((d) => d.id === id);
    return {
      ...current,
      doctors: current.doctors.map((d) => (d.id === id ? { ...d, status } : d)),
    };
  });
  if (!found) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, id, status });
}
