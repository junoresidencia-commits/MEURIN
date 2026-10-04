import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, patchDoctorProfile } from "@/lib/store";
import { doctorPublicCard } from "@/lib/network-actor";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  return NextResponse.json({
    profile: {
      name: doctor.name,
      professionalName: doctor.professionalName || doctor.name,
      profession: doctor.profession || "Médico(a)",
      specialty: doctor.specialty,
      crm: doctor.crm,
      crmState: doctor.crmState || "",
      rqe: doctor.rqe || "",
      phone: doctor.phone || "",
      whatsapp: doctor.patientContactWhatsapp || "",
      email: doctor.email,
      city: doctor.city || "",
      state: doctor.state || doctor.crmState || "",
      clinic: doctor.clinic || "",
      bio: doctor.bio || "",
      photoUrl: doctor.photoUrl || null,
    },
    publicCard: doctorPublicCard(doctor),
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    await patchDoctorProfile(doctorId, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      professionalName: body.professionalName !== undefined ? String(body.professionalName).trim() : undefined,
      profession: body.profession !== undefined ? String(body.profession).trim() : undefined,
      specialty: body.specialty !== undefined ? String(body.specialty).trim() : undefined,
      rqe: body.rqe !== undefined ? String(body.rqe).trim() : undefined,
      phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
      patientContactWhatsapp: body.whatsapp !== undefined ? String(body.whatsapp).trim() : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      state: body.state !== undefined ? String(body.state).trim() : undefined,
      clinic: body.clinic !== undefined ? String(body.clinic).trim() : undefined,
      bio: body.bio !== undefined ? String(body.bio) : undefined,
      crm: body.crm !== undefined ? String(body.crm).trim() : undefined,
      crmState: body.crmState !== undefined ? String(body.crmState).trim() : undefined,
    });
    const doctor = await getDoctorById(doctorId);
    return NextResponse.json({ ok: true, publicCard: doctor ? doctorPublicCard(doctor) : null });
  } catch (err) {
    console.error("[profile] salvar perfil profissional", err);
    return NextResponse.json({ error: "Não foi possível salvar o perfil." }, { status: 500 });
  }
}
