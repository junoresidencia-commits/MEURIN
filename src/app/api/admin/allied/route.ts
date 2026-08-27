import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listAlliedProfessionals, setAlliedStatus, type AlliedStatus } from "@/lib/allied-store";

const VALID: AlliedStatus[] = ["pending", "active", "inactive", "rejected", "suspended"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const list = await listAlliedProfessionals();
  return NextResponse.json({
    professionals: list.map((p) => ({
      id: p.id, role: p.role, name: p.name, cpf: p.cpf, email: p.email, phone: p.phone,
      registry: p.registry, uf: p.uf, specialty: p.specialty, bio: p.bio, photoUrl: p.photoUrl,
      status: p.status, createdAt: p.createdAt, lastAccessAt: p.lastAccessAt,
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const status = String(b.status || "") as AlliedStatus;
  if (!id || !VALID.includes(status)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  await setAlliedStatus(id, status);
  return NextResponse.json({ ok: true });
}
