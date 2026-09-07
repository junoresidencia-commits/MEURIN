import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getDoctorSessionId } from "@/lib/auth";
import { reprocessDoctorPatients, type IntelligenceAuditRow } from "@/lib/clinical-intelligence-apply";

const FILE = path.join(process.cwd(), "data", "intelligence-audit.json");

async function readRuns(): Promise<Record<string, IntelligenceAuditRow[]>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}
async function writeRuns(data: Record<string, IntelligenceAuditRow[]>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const all = await readRuns();
  return NextResponse.json({ rows: all[doctorId] || [] });
}

export async function POST() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const rows = await reprocessDoctorPatients(doctorId);
  const all = await readRuns();
  all[doctorId] = rows;
  try {
    await writeRuns(all);
  } catch (e) {
    console.error("[intelligence] persist audit", e);
  }
  return NextResponse.json({ ok: true, rows });
}
