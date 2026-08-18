import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listAllNutritionists, updateNutritionistStatus, type NutritionistStatus } from "@/lib/nutritionists-store";

const VALID: NutritionistStatus[] = ["pending", "active", "inactive", "rejected", "suspended"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const list = await listAllNutritionists();
  return NextResponse.json({
    nutritionists: list.map((n) => ({
      id: n.id, name: n.name, cpf: n.cpf, email: n.email, phone: n.phone,
      crn: n.crn, uf: n.uf, specialty: n.specialty, bio: n.bio, photoUrl: n.photoUrl,
      documents: n.documents || [], status: n.status, createdAt: n.createdAt, lastAccessAt: n.lastAccessAt,
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const status = String(b.status || "") as NutritionistStatus;
  if (!id || !VALID.includes(status)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  await updateNutritionistStatus(id, status);
  return NextResponse.json({ ok: true });
}
