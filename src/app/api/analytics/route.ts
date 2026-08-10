import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import {
  listFunnelEvents,
  summarizeFunnel,
  trackFunnelEvent,
  type FunnelEventType,
} from "@/lib/analytics-store";

const ALLOWED: FunnelEventType[] = [
  "home_view",
  "doctors_list_view",
  "doctor_profile_open",
  "schedule_click",
  "slot_selected",
  "payment_started",
  "payment_completed",
  "consultation_done",
  "return_done",
  "plan_hired",
  "help_option_click",
  "cta_patient_login",
  "cta_doctor",
];

const ALIASES: Record<string, FunnelEventType> = {
  cta_agendar_home: "schedule_click",
  cta_agendar_destaque: "schedule_click",
  cta_comecar_agendamento: "schedule_click",
  portal_paciente: "cta_patient_login",
  portal_medico: "cta_doctor",
  help_option: "help_option_click",
  help_find_doctor: "schedule_click",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type?: string;
      name?: string;
      path?: string;
      doctorId?: string;
      bookingId?: string;
      meta?: Record<string, string | number | boolean | null>;
    };

    const raw = body.type || body.name || "";
    const type = (ALIASES[raw] || raw) as FunnelEventType;
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ error: "Tipo de evento inválido." }, { status: 400 });
    }

    await trackFunnelEvent({
      type,
      path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined,
      doctorId: typeof body.doctorId === "string" ? body.doctorId.slice(0, 80) : undefined,
      bookingId: typeof body.bookingId === "string" ? body.bookingId.slice(0, 80) : undefined,
      meta: body.meta,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Falha ao registrar evento." }, { status: 500 });
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [summary, events] = await Promise.all([summarizeFunnel(), listFunnelEvents(500)]);
  return NextResponse.json({ summary, events });
}
