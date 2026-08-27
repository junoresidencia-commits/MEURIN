import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  ALLIED_ROLES, DEFAULT_ALLIED_PASSWORD, createAlliedProfessional, deleteAlliedLink,
  findAlliedByCpfOrEmail, listAlliedLinksForDoctor, listAlliedProfessionals, normalizeCpf,
  setAlliedLinkActive, setAlliedStatus, upsertAlliedLink, type AlliedRole,
} from "@/lib/allied-store";
import {
  DEFAULT_NUTRITIONIST_PASSWORD, createNutritionist, deleteNutritionLink, findNutritionistByCpfOrEmail,
  listAllNutritionists, listNutritionLinksForDoctor, setNutritionLink, upsertNutritionLink,
} from "@/lib/nutritionists-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [nutLinks, alliedLinks, allNut, allAllied] = await Promise.all([
    listNutritionLinksForDoctor(doctorId),
    listAlliedLinksForDoctor(doctorId),
    listAllNutritionists(),
    listAlliedProfessionals(),
  ]);

  const myNutIds = new Set(nutLinks.map((l) => l.nutritionistId));
  const myAlliedIds = new Set(alliedLinks.map((l) => l.professionalId));

  return NextResponse.json({
    mine: {
      nutrition: nutLinks.map((l) => ({
        id: l.nutritionistId, role: "nutrition", name: l.nutritionist.name, registry: l.nutritionist.crn,
        uf: l.nutritionist.uf, email: l.nutritionist.email, phone: l.nutritionist.phone, status: l.nutritionist.status,
        active: l.active, lastAccessAt: l.nutritionist.lastAccessAt,
      })),
      psychology: alliedLinks.filter((l) => l.professional.role === "psychology").map((l) => ({
        id: l.professionalId, role: "psychology", name: l.professional.name, registry: l.professional.registry,
        uf: l.professional.uf, email: l.professional.email, phone: l.professional.phone, status: l.professional.status,
        active: l.active, lastAccessAt: l.professional.lastAccessAt,
      })),
      nursing: alliedLinks.filter((l) => l.professional.role === "nursing").map((l) => ({
        id: l.professionalId, role: "nursing", name: l.professional.name, registry: l.professional.registry,
        uf: l.professional.uf, email: l.professional.email, phone: l.professional.phone, status: l.professional.status,
        active: l.active, lastAccessAt: l.professional.lastAccessAt,
      })),
    },
    available: {
      nutrition: allNut.filter((n) => !myNutIds.has(n.id) && (n.status === "active" || n.status === "pending")).map((n) => ({
        id: n.id, role: "nutrition", name: n.name, registry: n.crn, uf: n.uf, email: n.email, status: n.status, specialty: n.specialty,
      })),
      psychology: allAllied.filter((p) => p.role === "psychology" && !myAlliedIds.has(p.id) && (p.status === "active" || p.status === "pending")).map((p) => ({
        id: p.id, role: "psychology", name: p.name, registry: p.registry, uf: p.uf, email: p.email, status: p.status, specialty: p.specialty,
      })),
      nursing: allAllied.filter((p) => p.role === "nursing" && !myAlliedIds.has(p.id) && (p.status === "active" || p.status === "pending")).map((p) => ({
        id: p.id, role: "nursing", name: p.name, registry: p.registry, uf: p.uf, email: p.email, status: p.status, specialty: p.specialty,
      })),
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
