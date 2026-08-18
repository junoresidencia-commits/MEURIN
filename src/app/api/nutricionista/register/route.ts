import { NextResponse } from "next/server";
import { createNutritionist, findNutritionistByCpfOrEmail, normalizeCpf, type NutritionistDocument } from "@/lib/nutritionists-store";

// Auto-registro da nutricionista. Fica em análise (status 'pending') até o admin aprovar.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || "").trim();
    const cpf = b.cpf ? String(b.cpf) : null;
    const email = b.email ? String(b.email).trim() : null;
    const password = String(b.password || "");
    if (!name) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
    if (!cpf && !email) return NextResponse.json({ error: "Informe CPF e/ou e-mail." }, { status: 400 });
    if (cpf && normalizeCpf(cpf).length < 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Crie uma senha com pelo menos 6 caracteres." }, { status: 400 });

    const existing = await findNutritionistByCpfOrEmail(cpf, email);
    if (existing) return NextResponse.json({ error: "Já existe um cadastro com este CPF/e-mail." }, { status: 409 });

    // Foto e documentos chegam como dataURL (limite defensivo de tamanho).
    const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.startsWith("data:") && b.photoUrl.length < 900000 ? b.photoUrl : null;
    const documents: NutritionistDocument[] = Array.isArray(b.documents)
      ? (b.documents as unknown[])
          .map((d) => d as { name?: string; url?: string })
          .filter((d) => typeof d.url === "string" && d.url.startsWith("data:") && d.url.length < 1500000)
          .slice(0, 5)
          .map((d) => ({ name: String(d.name || "Documento"), url: String(d.url) }))
      : [];

    await createNutritionist({
      name, cpf, email, password,
      phone: b.phone ? String(b.phone) : null,
      crn: b.crn ? String(b.crn) : null,
      uf: b.uf ? String(b.uf) : null,
      specialty: b.specialty ? String(b.specialty) : "Nutrição",
      bio: b.bio ? String(b.bio) : null,
      photoUrl, documents,
      status: "pending",
    });
    return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
  } catch (err) {
    console.error("nutricionista/register", err);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora." }, { status: 500 });
  }
}
