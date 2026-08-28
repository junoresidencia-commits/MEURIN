import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  ALLIED_ROLES, DEFAULT_ALLIED_PASSWORD, createAlliedProfessional, deleteAlliedLink,
  findAlliedByCpfOrEmail, listAlliedLinksForDoctor, listAlliedProfessionals, normalizeCpf,
  setAlliedLinkActive, setAlliedStatus, upsertAlliedLink, type AlliedProfessional, type AlliedRole,
} from "@/lib/allied-store";
import {
  DEFAULT_NUTRITIONIST_PASSWORD, createNutritionist, deleteNutritionLink, findNutritionistByCpfOrEmail,
  getNutritionist, listAllNutritionists, listNutritionLinksForDoctor, setNutritionLink,
  updateNutritionistStatus, upsertNutritionLink, type Nutritionist,
} from "@/lib/nutritionists-store";

function catalogVisible(status?: string | null) {
  return status !== "rejected" && status !== "suspended";
}

async function safeList<T>(label: string, fn: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try { return await fn(); }
  catch (err) {
    console.warn(`[care-team] ${label}`, err);
    return fallback;
  }
}

async function activateNutritionistForTeam(id: string) {
  const nut = await getNutritionist(id);
  if (nut && nut.status !== "active" && nut.status !== "rejected" && nut.status !== "suspended") {
    await updateNutritionistStatus(id, "active");
  }
}

function mapNutrition(n: Nutritionist, extra?: { active?: boolean }) {
  return {
    id: n.id, role: "nutrition" as const, name: n.name, registry: n.crn,
    uf: n.uf, email: n.email, phone: n.phone, status: n.status,
    active: extra?.active ?? true, lastAccessAt: n.lastAccessAt, specialty: n.specialty,
  };
}

function mapAllied(p: AlliedProfessional, extra?: { active?: boolean }) {
  return {
    id: p.id, role: p.role, name: p.name, registry: p.registry,
    uf: p.uf, email: p.email, phone: p.phone, status: p.status,
    active: extra?.active ?? true, lastAccessAt: p.lastAccessAt, specialty: p.specialty,
  };
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [nutLinks, alliedLinks, allNut, allAllied] = await Promise.all([
    safeList("nutrition-links", () => listNutritionLinksForDoctor(doctorId)),
    safeList("allied-links", () => listAlliedLinksForDoctor(doctorId)),
    safeList("nutritionists", () => listAllNutritionists()),
    safeList("allied-professionals", () => listAlliedProfessionals()),
  ]);

  const myNutIds = new Set(nutLinks.map((l) => l.nutritionistId));
  const myAlliedIds = new Set(alliedLinks.map((l) => l.professionalId));

  const alliedMine = alliedLinks
    .filter((l) => l.professional)
    .map((l) => mapAllied(l.professional, { active: l.active }));

  const alliedMineByRole = Object.fromEntries(ALLIED_ROLES.map((role) => [role, alliedMine.filter((p) => p.role === role)]));
  const alliedAvailByRole = Object.fromEntries(ALLIED_ROLES.map((role) => [
    role,
    allAllied.filter((p) => p.role === role && !myAlliedIds.has(p.id) && catalogVisible(p.status)).map((p) => mapAllied(p)),
  ]));

  return NextResponse.json({
    mine: {
      nutrition: nutLinks.filter((l) => l.nutritionist).map((l) => mapNutrition(l.nutritionist, { active: l.active })),
      ...alliedMineByRole,
    },
    available: {
      nutrition: allNut.filter((n) => !myNutIds.has(n.id) && catalogVisible(n.status)).map((n) => mapNutrition(n)),
      ...alliedAvailByRole,
    },
  });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const role = String(b.role || "nutrition");

  if (b.professionalId && role === "nutrition") {
    await upsertNutritionLink(String(b.professionalId), doctorId);
    await activateNutritionistForTeam(String(b.professionalId));
    return NextResponse.json({ ok: true, linked: true });
  }
  if (b.professionalId && ALLIED_ROLES.includes(role as AlliedRole)) {
    const id = String(b.professionalId);
    await upsertAlliedLink(id, doctorId);
    await setAlliedStatus(id, "active");
    return NextResponse.json({ ok: true, linked: true });
  }

  const name = String(b.name || "").trim();
  const cpf = b.cpf ? String(b.cpf) : null;
  const email = b.email ? String(b.email).trim() : null;
  if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (!cpf && !email) return NextResponse.json({ error: "Informe CPF e/ou e-mail." }, { status: 400 });
  if (cpf && normalizeCpf(cpf).length < 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });

  if (role === "nutrition") {
    const existing = await findNutritionistByCpfOrEmail(cpf, email);
    if (existing) {
      await upsertNutritionLink(existing.id, doctorId);
      await activateNutritionistForTeam(existing.id);
      return NextResponse.json({ ok: true, linked: true, message: "Nutricionista já cadastrada — vinculada à sua equipe." });
    }
    const created = await createNutritionist({
      name, cpf, email, phone: b.phone ? String(b.phone) : null, crn: b.registry ? String(b.registry) : null, uf: b.uf ? String(b.uf) : null,
    });
    await upsertNutritionLink(created.id, doctorId);
    return NextResponse.json({ ok: true, created: true, id: created.id, defaultPassword: DEFAULT_NUTRITIONIST_PASSWORD }, { status: 201 });
  }

  if (!ALLIED_ROLES.includes(role as AlliedRole)) return NextResponse.json({ error: "Especialidade inválida." }, { status: 400 });
  const existing = await findAlliedByCpfOrEmail(role as AlliedRole, cpf, email);
  if (existing) {
    await upsertAlliedLink(existing.id, doctorId);
    await setAlliedStatus(existing.id, "active");
    return NextResponse.json({ ok: true, linked: true, message: "Profissional já cadastrado — vinculado à sua equipe." });
  }
  const created = await createAlliedProfessional({
    role: role as AlliedRole, name, cpf, email, phone: b.phone ? String(b.phone) : null,
    registry: b.registry ? String(b.registry) : null, uf: b.uf ? String(b.uf) : null, status: "active",
  });
  await upsertAlliedLink(created.id, doctorId);
  return NextResponse.json({ ok: true, created: true, id: created.id, defaultPassword: DEFAULT_ALLIED_PASSWORD }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.professionalId || "");
  const role = String(b.role || "");
  if (!id) return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  if (role === "nutrition") {
    const updated = await setNutritionLink(id, doctorId, { active: typeof b.active === "boolean" ? b.active : undefined });
    if (!updated) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const updated = await setAlliedLinkActive(id, doctorId, b.active !== false);
  if (!updated) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.professionalId || "");
  const role = String(b.role || "");
  if (!id) return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  if (role === "nutrition") await deleteNutritionLink(id, doctorId);
  else await deleteAlliedLink(id, doctorId);
  return NextResponse.json({ ok: true });
}
