import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { inviteAttendant, inviteDoctor, listInvites } from "@/lib/clinic-ops-store";
import { listMemberships } from "@/lib/platform-store";
import { getDoctorById } from "@/lib/store";
import { getAttendant } from "@/lib/attendants-store";
import { listFeeRules } from "@/lib/clinic-finance-store";
import { siteUrl } from "@/lib/site";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const [invites, memberships, rules] = await Promise.all([listInvites(id), listMemberships(id), listFeeRules(id)]);
  const ruleByDoctor = new Map(rules.map((r) => [r.doctorId, r]));
  const members = await Promise.all(
    memberships.map(async (m) => {
      if (m.actorKind === "doctor") {
        const d = await getDoctorById(m.actorId);
        const rule = ruleByDoctor.get(m.actorId);
        return {
          ...m,
          name: d?.name || "Médico",
          email: d?.email || null,
          feeCents: rule?.feeCents ?? null,
          clinicSharePercent: rule?.clinicSharePercent ?? null,
        };
      }
      const a = await getAttendant(m.actorId);
      return { ...m, name: a?.name || "Atendente", email: a?.email || null, feeCents: null, clinicSharePercent: null };
    })
  );
  return NextResponse.json({
    invites: invites.map((i) => ({
      ...i,
      acceptUrl: i.status === "pending" ? siteUrl(`/convite/${i.token}`) : null,
    })),
    members,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "doctor");
  try {
    const result =
      kind === "attendant"
        ? await inviteAttendant({
            clinicId: id,
            name: String(body.name || ""),
            email: String(body.email || ""),
            invitedBy: staff.actorId,
          })
        : await inviteDoctor({
            clinicId: id,
            name: String(body.name || ""),
            email: String(body.email || ""),
            crm: body.crm ? String(body.crm) : undefined,
            specialty: body.specialty ? String(body.specialty) : undefined,
            invitedBy: staff.actorId,
            feeCents: body.feeCents != null ? Number(body.feeCents) : undefined,
            clinicSharePercent: body.clinicSharePercent != null ? Number(body.clinicSharePercent) : undefined,
          });
    return NextResponse.json({
      ...result,
      acceptUrl: result.linkedExisting ? null : siteUrl(`/convite/${result.invite.token}`),
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível convidar." }, { status: 400 });
  }
}
