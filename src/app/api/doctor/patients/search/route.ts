import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { listPatientsByDoctor } from "@/lib/patients-store";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const digits = (s: string) => s.replace(/\D/g, "");

// Busca global de pacientes por nome, CPF ou telefone. Sem query → pacientes recentes.
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  const qn = norm(q);
  const qd = digits(q);

  const db = await readDb();
  const created = await listPatientsByDoctor(doctorId);
  const createdEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));

  type Row = { key: string; name: string; city: string; phone: string; cpf: string | null; isCreated: boolean; lastSlot: string };
  const rows: Row[] = [];

  for (const p of created) {
    if (p.status === "archived") continue;
    const email = (p.email || "").toLowerCase();
    const bks = email ? db.bookings.filter((b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email) : [];
    rows.push({
      key: p.id,
      name: p.name,
      city: p.address || "",
      phone: p.phone || "",
      cpf: p.cpf || null,
      isCreated: true,
      lastSlot: bks.map((b) => b.slotStart).sort().slice(-1)[0] || p.createdAt,
    });
  }

  const byEmail = new Map<string, Row>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const email = b.patientEmail.toLowerCase();
    if (createdEmails.has(email)) continue;
    const entry = byEmail.get(email) || { key: email, name: b.patientName, city: b.patientCity, phone: b.patientPhone || "", cpf: null, isCreated: false, lastSlot: b.slotStart };
    if (b.slotStart > entry.lastSlot) { entry.lastSlot = b.slotStart; entry.name = b.patientName; entry.city = b.patientCity; entry.phone = b.patientPhone || entry.phone; }
    byEmail.set(email, entry);
  }
  rows.push(...byEmail.values());

  let result = rows;
  if (qn) {
    result = rows.filter((r) => {
      if (norm(r.name).includes(qn)) return true;
      if (qd.length >= 3 && r.cpf && digits(r.cpf).includes(qd)) return true;
      if (qd.length >= 3 && r.phone && digits(r.phone).includes(qd)) return true;
      return false;
    });
  }

  result = result.sort((a, b) => b.lastSlot.localeCompare(a.lastSlot)).slice(0, 20);
  return NextResponse.json({ patients: result });
}
