import { NextResponse } from "next/server";
import { ALLIED_ROLES, createAlliedProfessional, findAlliedByCpfOrEmail, normalizeCpf, type AlliedRole } from "@/lib/allied-store";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const role = b.role as AlliedRole;
    if (!ALLIED_ROLES.includes(role)) return NextResponse.json({ error: "Informe a especialidade." }, { status: 400 });
    const name = String(b.name || "").trim();
    const cpf = b.cpf ? String(b.cpf) : null;
    const email = b.email ? String(b.email).trim() : null;
    const password = String(b.password || "");
    if (!name) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
    if (!cpf && !email) return NextResponse.json({ error: "Informe CPF e/ou e-mail." }, { status: 400 });
    if (cpf && normalizeCpf(cpf).length < 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Crie uma senha com pelo menos 6 caracteres." }, { status: 400 });
    const existing = await findAlliedByCpfOrEmail(role, cpf, email);
    if (existing) return NextResponse.json({ error: "Já existe um cadastro com este CPF/e-mail nesta especialidade." }, { status: 409 });
    const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.startsWith("data:") && b.photoUrl.length < 900000 ? b.photoUrl : null;
    await createAlliedProfessional({
      role, name, cpf, email, password, photoUrl,
      phone: b.phone ? String(b.phone) : null,
      registry: b.registry ? String(b.registry) : null,
      uf: b.uf ? String(b.uf) : null,
      specialty: b.specialty ? String(b.specialty) : null,
      bio: b.bio ? String(b.bio) : null,
      status: "pending",
    });
    return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
  } catch (err) {
    console.error("allied/register", err);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora." }, { status: 500 });
  }
}
