import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listAllNutritionists, updateNutritionistStatus, updateNutritionistFinance, type NutritionistStatus } from "@/lib/nutritionists-store";

const VALID: NutritionistStatus[] = ["pending", "active", "inactive", "rejected", "suspended"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const list = await listAllNutritionists();
  return NextResponse.json({
    nutritionists: list.map((n) => ({
      id: n.id, name: n.name, cpf: n.cpf, email: n.email, phone: n.phone,
      crn: n.crn, uf: n.uf, specialty: n.specialty, bio: n.bio, photoUrl: n.photoUrl,
      documents: n.documents || [], status: n.status,
      commissionPercent: n.commissionPercent ?? null, payoutStatus: n.payoutStatus ?? "active",
      consultationPriceCents: n.consultationPriceCents ?? null,
      createdAt: n.createdAt, lastAccessAt: n.lastAccessAt,
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  // Alteração de status (aprovar/recusar/suspender).
  if (b.status !== undefined) {
    const status = String(b.status) as NutritionistStatus;
    if (!VALID.includes(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    await updateNutritionistStatus(id, status);
  }
  // Financeiro: comissão da plataforma (%) e liberação de recebimento.
  if (b.commissionPercent !== undefined || b.payoutStatus !== undefined) {
    const commissionPercent = b.commissionPercent !== undefined && b.commissionPercent !== "" ? Math.min(100, Math.max(0, Math.round(Number(b.commissionPercent)))) : undefined;
    const payoutStatus = ["active", "pending", "blocked"].includes(String(b.payoutStatus)) ? (b.payoutStatus as "active" | "pending" | "blocked") : undefined;
    await updateNutritionistFinance(id, { commissionPercent, payoutStatus });
  }
  return NextResponse.json({ ok: true });
}
