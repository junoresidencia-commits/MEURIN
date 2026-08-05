import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { addHomeRecord, getPatientData, type VitalKind } from "@/lib/patient-store";

const KINDS: VitalKind[] = ["bp", "glucose", "weight", "symptom"];

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const data = await getPatientData(email);
  return NextResponse.json({ email, ...data });
}

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }

  const body = await req.json();
  const kind = String(body.kind) as VitalKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Tipo de registro inválido." }, { status: 400 });
  }

  if (kind === "bp") {
    const systolic = toInt(body.systolic);
    const diastolic = toInt(body.diastolic);
    if (!systolic || !diastolic) {
      return NextResponse.json({ error: "Informe pressão sistólica e diastólica." }, { status: 400 });
    }
  }
  if (kind === "glucose" && !toInt(body.glucoseMgDl)) {
    return NextResponse.json({ error: "Informe o valor da glicemia." }, { status: 400 });
  }
  if (kind === "weight" && !toNum(body.weightKg)) {
    return NextResponse.json({ error: "Informe o peso." }, { status: 400 });
  }
  if (kind === "symptom" && !String(body.symptoms || "").trim()) {
    return NextResponse.json({ error: "Descreva os sintomas." }, { status: 400 });
  }

  const record = await addHomeRecord({
    patientEmail: email,
    kind,
    systolic: kind === "bp" ? toInt(body.systolic) : null,
    diastolic: kind === "bp" ? toInt(body.diastolic) : null,
    heartRate: kind === "bp" ? toInt(body.heartRate) : null,
    glucoseMgDl: kind === "glucose" ? toInt(body.glucoseMgDl) : null,
    glucoseContext: kind === "glucose" ? (body.glucoseContext ?? null) : null,
    weightKg: kind === "weight" ? toNum(body.weightKg) : null,
    arm: kind === "bp" ? (body.arm ?? null) : null,
    bodyPosition: kind === "bp" ? (body.bodyPosition ?? null) : null,
    medContext: kind === "bp" ? (body.medContext ?? null) : null,
    symptoms: body.symptoms ? String(body.symptoms) : null,
    note: body.note ? String(body.note) : null,
  });

  return NextResponse.json({ record }, { status: 201 });
}
