import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { isAdmin } from "@/lib/admin-session";
import {
  deleteDoctor,
  getDoctorById,
  logFinancialEvent,
  readDb,
  setDoctorCommission,
  setDoctorFinance,
  setDoctorPayoutStatus,
  updateDb,
} from "@/lib/store";
import { defaultAvailability } from "@/lib/scheduling";
import { doctorFeeRule, resolveDoctorSharePercent } from "@/lib/types";
import { normalizeFeeMode } from "@/lib/platform-fees";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = await readDb();
  const doctors = db.doctors
    .map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      crm: d.crm,
      crmState: d.crmState ?? null,
      rqe: d.rqe ?? null,
      specialty: d.specialty,
      clinic: d.clinic ?? null,
      consultationPriceCents: d.consultationPriceCents,
      pixKey: d.pixKey ?? null,
      status: d.status ?? "approved",
      adminNote: d.adminNote ?? null,
      // Financeiro: percentual (repasse do médico), plataforma e liberação.
      commissionPercent: resolveDoctorSharePercent(d),
      platformPercent: 100 - resolveDoctorSharePercent(d),
      appFeeMode: doctorFeeRule(d).appFeeMode,
      entryFeeCents: d.entryFeeCents ?? 0,
      payoutStatus: d.payoutStatus ?? "active",
      mpConnected: Boolean(d.mpAccessToken?.trim()),
      createdAt: d.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ doctors });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, password, crm, specialty, bio, consultationPriceCents, pixKey } = body;
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
    email: String(email).toLowerCase().trim(),
    passwordHash,
    crm: String(crm),
    specialty: String(specialty || "Nefrologia"),
    bio: String(bio || ""),
    consultationPriceCents: Number(consultationPriceCents) || 30000,
    pixKey: pixKey ? String(pixKey) : undefined,
    bankAccountHint: undefined,
    stripeConnectReady: Boolean(pixKey),
    weeklyAvailability: defaultAvailability(),
    blockedSlots: [] as string[],
    createdAt: new Date().toISOString(),
    // Médico criado pelo próprio administrador já entra aprovado.
    status: "approved" as const,
    appFeeMode: "gratis" as const,
    entryFeeCents: 0,
    commissionPercent: 100,
    phone: body.phone ? String(body.phone) : undefined,
    crmState: body.crmState ? String(body.crmState) : undefined,
    rqe: body.rqe ? String(body.rqe) : undefined,
    clinic: body.clinic ? String(body.clinic) : undefined,
  };

  await updateDb((current) => ({ ...current, doctors: [...current.doctors, doctor] }));
  return NextResponse.json({ ok: true, id: doctor.id }, { status: 201 });
}

const VALID_STATUS = ["pending", "approved", "rejected", "suspended", "correction"];

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json();
  const { id, status, adminNote, newPassword, commissionPercent, payoutStatus, appFeeMode, entryFee, entryFeeCents, platformPercent } = body;
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  }

  if (appFeeMode !== undefined || entryFee !== undefined || entryFeeCents !== undefined || platformPercent !== undefined) {
    const doctor = await getDoctorById(String(id));
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
    const mode = appFeeMode !== undefined ? normalizeFeeMode(appFeeMode) : doctorFeeRule(doctor).appFeeMode;
    const platformPct = platformPercent !== undefined && platformPercent !== ""
      ? Math.min(100, Math.max(0, Math.round(Number(platformPercent))))
      : undefined;
    const doctorShare = platformPct !== undefined
      ? (mode === "por_atendimento" ? 100 - platformPct : 100)
      : undefined;
    const nextEntry = entryFeeCents !== undefined
      ? Math.max(0, Math.round(Number(entryFeeCents)))
      : entryFee !== undefined
        ? Math.max(0, Math.round(Number(String(entryFee).replace(",", ".")) * 100))
        : undefined;
    await setDoctorFinance(String(id), {
      appFeeMode: mode,
      entryFeeCents: nextEntry,
      commissionPercent: doctorShare,
    });
    return NextResponse.json({ ok: true, appFeeMode: mode, entryFeeCents: nextEntry ?? doctor.entryFeeCents ?? 0 });
  }

  // Percentual de repasse do médico — SOMENTE o administrador pode alterar.
  if (commissionPercent !== undefined) {
    const pct = Number(commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: "Percentual deve estar entre 0 e 100." }, { status: 400 });
    }
    const doctor = await getDoctorById(String(id));
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
    const prev = resolveDoctorSharePercent(doctor);
    const next = Math.round(pct);
    await setDoctorCommission(String(id), next);
    if (next !== prev) {
      await logFinancialEvent({
        doctorId: String(id),
        kind: "commission",
        oldValue: String(prev),
        newValue: String(next),
        changedBy: "admin",
      });
    }
    return NextResponse.json({ ok: true, commissionPercent: next, platformPercent: 100 - next });
  }

  // Liberação financeira do recebimento — SOMENTE o administrador.
  if (payoutStatus !== undefined) {
    const valid = ["active", "pending", "blocked"];
    if (!valid.includes(String(payoutStatus))) {
      return NextResponse.json({ error: "Status de recebimento inválido." }, { status: 400 });
    }
    const doctor = await getDoctorById(String(id));
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
    const prev = doctor.payoutStatus ?? "active";
    await setDoctorPayoutStatus(String(id), payoutStatus as "active" | "pending" | "blocked");
    if (prev !== payoutStatus) {
      await logFinancialEvent({
        doctorId: String(id),
        kind: "payout_status",
        oldValue: prev,
        newValue: String(payoutStatus),
        changedBy: "admin",
      });
    }
    return NextResponse.json({ ok: true, payoutStatus });
  }

  // Redefinição de senha do médico pelo administrador.
  if (newPassword) {
    const pass = String(newPassword);
    if (pass.length < 6) {
      return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(pass, 10);
    await updateDb((current) => ({
      ...current,
      doctors: current.doctors.map((d) => (d.id === id ? { ...d, passwordHash } : d)),
    }));
    return NextResponse.json({ ok: true, reset: true });
  }

  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: "status válido é obrigatório." }, { status: 400 });
  }
  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) =>
      d.id === id
        ? { ...d, status, adminNote: adminNote ? String(adminNote) : d.adminNote }
        : d
    ),
  }));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }
  await deleteDoctor(id);
  return NextResponse.json({ ok: true });
}
