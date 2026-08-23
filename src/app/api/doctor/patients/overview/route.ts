import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";
import { getProfilesByDoctor } from "@/lib/clinical-profile-store";
import { getLatestLabsByEmails } from "@/lib/patient-store";
import { ageFromBirthdate } from "@/lib/egfr";

type LabVal = { value: number; unit: string | null; date: string } | null;
type Row = {
  key: string;
  name: string;
  photoUrl: string | null;
  city: string;
  age: number | null;
  sex: string | null;
  drc: { flag: boolean; g: string | null; a: string | null };
  comorbidities: { has: boolean; dm: boolean };
  flags: { dialise: boolean; transplante: boolean; glomerulopatia: boolean; pediatria: boolean };
  labs: { tfge: LabVal; creatinina: LabVal; rac: LabVal; potassio: LabVal };
  alert: { level: "urgente" | "importante" | null; text: string | null; date: string | null };
  retornoPendente: boolean;
  active: boolean;
  isCreated: boolean;
  lastConsultation: string | null;
  nextConsultation: string | null;
  lastSlot: string;
};

const isYes = (v: unknown) => String(v ?? "").toLowerCase() === "sim";
const DAY = 86400000;

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const db = await readDb();
  const created = await listPatientsByDoctor(doctorId);
  const createdEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));

  // Chave clínica por linha (email ou pid:<id>) — usada para casar exames/perfil.
  type Base = { key: string; clinicalKey: string; name: string; photoUrl: string | null; city: string; birthdate: string | null; sex: string | null; isCreated: boolean };
  const bases: Base[] = [];

  for (const p of created) {
    if (p.status === "archived") continue;
    bases.push({ key: p.id, clinicalKey: clinicalKey(p), name: p.name, photoUrl: p.photoUrl ?? null, city: p.address || "", birthdate: p.birthdate || null, sex: p.sex || null, isCreated: true });
  }
  const byEmail = new Map<string, Base & { lastSlot: string }>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const email = b.patientEmail.toLowerCase();
    if (createdEmails.has(email)) continue;
    const cur = byEmail.get(email);
    if (!cur || b.slotStart > cur.lastSlot) {
      byEmail.set(email, { key: email, clinicalKey: email, name: b.patientName, photoUrl: null, city: b.patientCity, birthdate: null, sex: null, isCreated: false, lastSlot: b.slotStart });
    }
  }
  for (const v of byEmail.values()) bases.push(v);

  const profiles = await getProfilesByDoctor(doctorId);
  const profByKey = new Map(profiles.map((p) => [p.patientKey.toLowerCase().trim(), p.data]));
  const labsByKey = await getLatestLabsByEmails(bases.map((b) => b.clinicalKey));

  const now = Date.now();
  const rows: Row[] = bases.map((b) => {
    const data = profByKey.get(b.clinicalKey.toLowerCase().trim()) || {};
    const labs = labsByKey.get(b.clinicalKey.toLowerCase().trim()) || new Map();
    const pick = (k: string): LabVal => {
      const v = labs.get(k);
      return v ? { value: v.value, unit: v.unit, date: v.measuredAt } : null;
    };
    const tfge = pick("tfge") || pick("tfge_cistatina");
    const creatinina = pick("creatinina");
    const rac = pick("rac");
    const potassio = pick("potassio");
    const hb = pick("hemoglobina");

    // Alerta clínico (mesmas regras conservadoras do resumo rápido).
    let alert: Row["alert"] = { level: null, text: null, date: null };
    if (potassio && potassio.value >= 6.0) alert = { level: "urgente", text: `K ${potassio.value} mEq/L`, date: potassio.date };
    else if (tfge && tfge.value < 15) alert = { level: "urgente", text: `TFGe ${tfge.value}`, date: tfge.date };
    else if (potassio && potassio.value >= 5.5) alert = { level: "importante", text: `K ${potassio.value} mEq/L`, date: potassio.date };
    else if (hb && hb.value < 8) alert = { level: "importante", text: `Hb ${hb.value} g/dL`, date: hb.date };

    const bks = db.bookings
      .filter((x) => x.doctorId === doctorId && x.patientEmail.toLowerCase() === b.clinicalKey.toLowerCase() && x.status !== "cancelled")
      .sort((a, c) => a.slotStart.localeCompare(c.slotStart));
    const past = bks.filter((x) => new Date(x.slotStart).getTime() <= now);
    const future = bks.filter((x) => new Date(x.slotStart).getTime() > now);
    const lastConsultation = past[past.length - 1]?.slotStart || null;
    const nextConsultation = future[0]?.slotStart || null;
    // Retorno pendente (heurística até "Finalizar atendimento" gravar retorno explícito):
    // já teve consulta e não há consulta futura marcada.
    const retornoPendente = past.length > 0 && future.length === 0;
    const active = Boolean(nextConsultation) || (lastConsultation ? now - new Date(lastConsultation).getTime() <= 180 * DAY : false) || bks.length === 0;

    const age = ageFromBirthdate(b.birthdate);
    return {
      key: b.key,
      name: b.name,
      photoUrl: b.photoUrl ?? null,
      city: b.city,
      age,
      sex: b.sex,
      drc: { flag: isYes(data["drc"]) || Boolean(data["estagio_g"]), g: (data["estagio_g"] as string) || null, a: (data["categoria_a"] as string) || null },
      comorbidities: { has: isYes(data["has"]), dm: isYes(data["dm"]) },
      flags: {
        dialise: isYes(data["hemodialise"]) || isYes(data["dialise_peritoneal"]),
        transplante: isYes(data["transplante"]),
        glomerulopatia: isYes(data["glomerulopatia"]),
        pediatria: age != null && age < 18,
      },
      labs: { tfge, creatinina, rac, potassio },
      alert,
      retornoPendente,
      active,
      isCreated: b.isCreated,
      lastConsultation,
      nextConsultation,
      lastSlot: (b as Base & { lastSlot?: string }).lastSlot || nextConsultation || lastConsultation || "",
    };
  });

  rows.sort((a, b) => (b.lastSlot || "").localeCompare(a.lastSlot || ""));
  return NextResponse.json({ patients: rows });
}
