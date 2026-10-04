import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listAlliedProfessionals, setAlliedStatus, updateAlliedFinance, type AlliedStatus } from "@/lib/allied-store";
import { normalizeFeeMode } from "@/lib/platform-fees";

const VALID: AlliedStatus[] = ["pending", "active", "inactive", "rejected", "suspended"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const list = await listAlliedProfessionals();
  return NextResponse.json({
    professionals: list.map((p) => ({
      id: p.id, role: p.role, name: p.name, cpf: p.cpf, email: p.email, phone: p.phone,
      registry: p.registry, uf: p.uf, city: p.city, specialty: p.specialty, bio: p.bio, photoUrl: p.photoUrl,
      status: p.status, createdAt: p.createdAt, lastAccessAt: p.lastAccessAt,
      consultationPriceCents: p.consultationPriceCents ?? null,
      returnPriceCents: p.returnPriceCents ?? null,
      commissionPercent: p.commissionPercent ?? 0,
      entryFeeCents: p.entryFeeCents ?? 0,
      appFeeMode: p.appFeeMode || "gratis",
      payoutStatus: p.payoutStatus || "active",
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  if (b.status !== undefined) {
    const status = String(b.status) as AlliedStatus;
    if (!VALID.includes(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    await setAlliedStatus(id, status);
  }
  if (
    b.commissionPercent !== undefined ||
    b.payoutStatus !== undefined ||
    b.entryFeeCents !== undefined ||
    b.appFeeMode !== undefined ||
    b.entryFee !== undefined
  ) {
    const commissionPercent = b.commissionPercent !== undefined && b.commissionPercent !== ""
      ? Math.min(100, Math.max(0, Math.round(Number(b.commissionPercent))))
      : undefined;
    const entryFeeCents = b.entryFeeCents !== undefined
      ? Math.max(0, Math.round(Number(b.entryFeeCents)))
      : b.entryFee !== undefined
        ? Math.max(0, Math.round(Number(b.entryFee) * 100))
        : undefined;
    const payoutStatus = ["active", "pending", "blocked"].includes(String(b.payoutStatus))
      ? (b.payoutStatus as "active" | "pending" | "blocked")
      : undefined;
    const appFeeMode = b.appFeeMode !== undefined ? normalizeFeeMode(b.appFeeMode) : undefined;
    await updateAlliedFinance(id, { commissionPercent, entryFeeCents, appFeeMode, payoutStatus });
  }
  return NextResponse.json({ ok: true });
}
