import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { findPatientByClinicalKey, searchPatientsForDoctor } from "@/lib/patients-store";
import { listSharesForDoctor } from "@/lib/patient-shares-store";
import { safeLog } from "@/lib/safe-log";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const digits = (s: string) => s.replace(/\D/g, "");

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  const qn = norm(q);
  const qd = digits(q);

  try {
    const created = await searchPatientsForDoctor(doctorId, q, 20);
    type Row = { key: string; name: string; city: string; phone: string; cpf: string | null; birthdate: string | null; isCreated: boolean; lastSlot: string };
    const rows: Row[] = created.map((p) => ({
      key: p.id,
      name: p.name,
      city: p.address || "",
      phone: p.phone || "",
      cpf: p.cpf || null,
      birthdate: p.birthdate || null,
      isCreated: true,
      lastSlot: p.createdAt,
    }));

    const seen = new Set(rows.map((r) => r.key.toLowerCase()));
    const { incoming } = await listSharesForDoctor(doctorId);
    for (const share of incoming.filter((s) => s.status === "active")) {
      const patient = await findPatientByClinicalKey(share.patientKey);
      const key = patient?.id || share.patientKey;
      if (seen.has(key.toLowerCase()) || (patient?.email && seen.has(patient.email.toLowerCase()))) continue;
      if (qn) {
        const name = norm(patient?.name || share.patientName || "");
        const cpf = patient?.cpf || "";
        const phone = patient?.phone || "";
        const birth = patient?.birthdate || "";
        const hit =
          name.includes(qn) ||
          (qd.length >= 3 && digits(cpf).includes(qd)) ||
          (qd.length >= 3 && digits(phone).includes(qd)) ||
          birth.includes(q) ||
          birth.split("-").reverse().join("/").includes(q);
        if (!hit) continue;
      }
      seen.add(key.toLowerCase());
      rows.push({
        key,
        name: patient?.name || share.patientName || share.patientKey,
        city: patient?.address || "",
        phone: patient?.phone || "",
        cpf: patient?.cpf || null,
        birthdate: patient?.birthdate || null,
        isCreated: Boolean(patient),
        lastSlot: share.createdAt,
      });
    }

    const result = rows.sort((a, b) => b.lastSlot.localeCompare(a.lastSlot)).slice(0, 20);
    return NextResponse.json({ patients: result });
  } catch (err) {
    safeLog("patients/search", err);
    return NextResponse.json({ error: "Não foi possível buscar pacientes agora. Tente novamente." }, { status: 500 });
  }
}
