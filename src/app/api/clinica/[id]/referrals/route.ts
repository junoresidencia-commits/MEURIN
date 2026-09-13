import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listMemberships } from "@/lib/platform-store";
import { listDoctorsByIds } from "@/lib/store";
import { countPatientLinks, listReferrals } from "@/lib/clinic-referral-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const [referrals, memberships, linkedPatients] = await Promise.all([
    listReferrals(id),
    listMemberships(id),
    countPatientLinks(id),
  ]);
  const doctorIds = memberships.filter((m) => m.actorKind === "doctor" && m.status === "active").map((m) => m.actorId);
  const docs = await listDoctorsByIds(doctorIds);
  const docById = new Map(docs.map((d) => [d.id, d]));

  const doctors = memberships
    .filter((m) => m.actorKind === "doctor" && m.status === "active")
    .map((m) => {
      const doc = docById.get(m.actorId);
      return {
        id: m.actorId,
        role: m.role,
        name: doc?.name || "Médico",
        specialty: doc?.specialty || "",
        email: doc?.email || null,
      };
    })
    .filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);

  return NextResponse.json({
    doctors,
    referrals,
    linkedPatients,
    note: "Encaminhamento intra-clínica não move o cadastro. Pacientes atuais continuam no médico original.",
  });
}
