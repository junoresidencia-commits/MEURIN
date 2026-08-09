import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
import type { DoctorLocation } from "@/lib/types";

const TYPES = ["clinica", "consultorio", "hospital", "outro"];

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  return NextResponse.json({ locations: doctor?.locations || [] });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const city = String(b.city || "").trim();
  if (!name || !city) return NextResponse.json({ error: "Informe nome e cidade do local." }, { status: 400 });
  const loc: DoctorLocation = {
    id: uuid(),
    name,
    city,
    address: b.address ? String(b.address).trim() : undefined,
    phone: b.phone ? String(b.phone).trim() : undefined,
    type: TYPES.includes(b.type) ? b.type : "clinica",
    active: b.active === undefined ? true : Boolean(b.active),
  };
  await updateDb((db) => ({
    ...db,
    doctors: db.doctors.map((d) => (d.id === doctorId ? { ...d, locations: [...(d.locations || []), loc] } : d)),
  }));
  return NextResponse.json({ ok: true, location: loc }, { status: 201 });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  await updateDb((db) => ({
    ...db,
    doctors: db.doctors.map((d) =>
      d.id === doctorId
        ? {
            ...d,
            locations: (d.locations || []).map((l) =>
              l.id === id
                ? {
                    ...l,
                    name: b.name !== undefined ? String(b.name).trim() : l.name,
                    city: b.city !== undefined ? String(b.city).trim() : l.city,
                    address: b.address !== undefined ? String(b.address).trim() || undefined : l.address,
                    phone: b.phone !== undefined ? String(b.phone).trim() || undefined : l.phone,
                    type: b.type !== undefined && TYPES.includes(b.type) ? b.type : l.type,
                    active: b.active !== undefined ? Boolean(b.active) : l.active,
                  }
                : l
            ),
          }
        : d
    ),
  }));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  await updateDb((db) => ({
    ...db,
    doctors: db.doctors.map((d) =>
      d.id === doctorId ? { ...d, locations: (d.locations || []).filter((l) => l.id !== id) } : d
    ),
  }));
  return NextResponse.json({ ok: true });
}
