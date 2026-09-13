import { NextResponse } from "next/server";
import { getClinicStaff } from "@/lib/platform-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getClinicStaff(id);
  if (!staff) return NextResponse.json({ error: "Sem acesso a esta clínica." }, { status: 403 });
  return NextResponse.json({
    clinic: staff.clinic,
    staff: {
      kind: staff.kind,
      actorId: staff.actorId,
      name: staff.name,
      email: staff.email,
      canAdmin: staff.canAdmin,
      canCheckout: staff.canCheckout,
      isSuperAdmin: staff.isSuperAdmin,
    },
  });
}
