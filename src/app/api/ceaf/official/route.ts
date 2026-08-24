import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getLme } from "@/lib/lme-store";
import {
  CEAF_PACOTE,
  officialDocPages,
  OFFICIAL_OVERLAY,
  TER_MED_MARKS,
  TER_MED_SKIP_AUTO,
  terMedKeysFromNames,
  inferProtocolFromMedNames,
  type OverlayField,
  type OverlayFieldName,
} from "@/lib/ceaf-documents";
import { winAnsiSafe, idadeFromBirthdate, todayBr } from "@/lib/pdf-text";

export const maxDuration = 30;

type FillValues = Partial<Record<OverlayFieldName, string>>;

function fit(font: PDFFont, text: string, size: number, maxWidth?: number): string {
  let t = winAnsiSafe(text || "").trim();
  if (!t) return "";
  if (!maxWidth || maxWidth <= 0) return t;
  try {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
  } catch {
    t = t.slice(0, Math.max(1, Math.floor(maxWidth / (size * 0.5))));
  }
  return t;
}

function drawFields(pages: PDFPage[], font: PDFFont, fields: OverlayField[] | undefined, values: FillValues) {
  if (!fields) return;
  for (const f of fields) {
    const val = values[f.field];
    if (!val) continue;
    const pg = pages[f.page];
    if (!pg) continue;
    const size = f.size ?? 10;
    const text = fit(font, val, size, f.maxWidth);
    if (!text) continue;
    try {
      pg.drawText(text, { x: f.x, y: f.y, size, font, color: rgb(0, 0, 0) });
    } catch {
      /* caractere residual — não bloqueia o PDF oficial */
    }
  }
}

/**
 * Extrai as páginas oficiais (TER, formulário ou declaração) e preenche
 * identificação do paciente/médico. Critérios clínicos ficam em branco.
 */
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const doc = (searchParams.get("doc") || "") as "ter" | "form" | "residencia";
  const lmeId = (searchParams.get("lmeId") || "").trim();
  const patientParam = (searchParams.get("patient") || "").trim();
  let protocol = (searchParams.get("protocol") || "").trim();

  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const values: FillValues = {};
  let medNames: string[] = [];

  if (lmeId) {
    const lme = await getLme(lmeId);
    if (!lme) return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });
    if (lme.doctorId && lme.doctorId !== doctorId) {
      return NextResponse.json({ error: "Sem acesso a esta LME." }, { status: 403 });
    }
    values.introName = lme.patientName || "";
    values.name = lme.patientName || "";
    values.cpf = lme.patientCpf || "";
    values.cns = lme.patientCns || "";
    values.introDoctor = lme.doctorName || doctor.name;
    values.doctor = lme.doctorName || doctor.name;
    values.crm = (lme.doctorCrm || [doctor.crm, doctor.crmState].filter(Boolean).join("-") || "").replace(/^-+|-+$/g, "");
    values.date = new Date(lme.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
    values.service = lme.establishmentName || "";
    medNames = (lme.medications || []).map((m) => m.name);
    if (!protocol) protocol = inferProtocolFromMedNames(medNames) || "";
    const access = await resolvePatientAccess(lme.patientEmail || patientParam);
    if (access?.allowed) {
      values.age = idadeFromBirthdate(access.birthdate);
      values.city = cityFrom(access.city);
      values.local = values.city || values.service || "";
      if (!values.cpf) values.cpf = access.cpf || "";
      if (!values.cns) values.cns = access.cns || "";
      if (!values.name) values.name = access.name;
      if (!values.introName) values.introName = access.name;
    }
  } else {
    values.introName = searchParams.get("name") || "";
    values.name = values.introName;
    values.introDoctor = searchParams.get("doctor") || doctor.name;
    values.doctor = values.introDoctor;
    values.crm = searchParams.get("crm") || [doctor.crm, doctor.crmState].filter(Boolean).join("-");
    values.date = searchParams.get("date") || todayBr();
    values.cpf = searchParams.get("cpf") || "";
    values.cns = searchParams.get("cns") || "";
    values.age = searchParams.get("age") || "";
    values.city = searchParams.get("city") || "";
    values.service = searchParams.get("service") || "";
    values.local = values.city || values.service || "";
    const medsParam = searchParams.get("meds") || "";
    medNames = medsParam ? medsParam.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];
    if (patientParam) {
      const access = await resolvePatientAccess(patientParam);
      if (access?.allowed) {
        if (!values.name) values.name = access.name;
        if (!values.introName) values.introName = access.name;
        if (!values.cpf) values.cpf = access.cpf || "";
        if (!values.cns) values.cns = access.cns || "";
        if (!values.age) values.age = idadeFromBirthdate(access.birthdate);
        if (!values.city) values.city = cityFrom(access.city);
        if (!values.local) values.local = values.city;
      }
    }
  }

  // UF / CRM / serviço: perfil do médico (Bahia por padrão neste fluxo SESAB).
  const crmNum = String(values.crm || doctor.crm || "").replace(/-.*$/, "").trim() || doctor.crm;
  const uf = (doctor.crmState || "BA").toUpperCase().slice(0, 2);
  values.uf = uf;
  values.crm = crmNum;
  if (!values.introDoctor) values.introDoctor = doctor.name;
  if (!values.doctor) values.doctor = doctor.name;
  if (!values.date) values.date = todayBr();
  if (!values.service) {
    const loc = (doctor.locations || []).find((l) => l.active) || (doctor.locations || [])[0];
    if (loc) {
      values.service = loc.name;
      if (!values.city) values.city = loc.city || "";
      if (!values.local) values.local = loc.city || loc.name;
    }
  }
  if (!values.local) values.local = values.city || "";

  const ref = officialDocPages(protocol, doc);
  if (!ref) return NextResponse.json({ error: "Documento oficial não encontrado para este protocolo." }, { status: 404 });

  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "forms", CEAF_PACOTE.file));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const valid = ref.pages.filter((i) => i >= 0 && i < src.getPageCount());
    const copied = await out.copyPages(src, valid);
    copied.forEach((p) => out.addPage(p));

    const font = await out.embedFont(StandardFonts.Helvetica);
    const pages = out.getPages();
    const overlay = OFFICIAL_OVERLAY[protocol];
    if (doc === "ter") drawFields(pages, font, overlay?.ter, values);
    if (doc === "form") drawFields(pages, font, overlay?.form, values);

    if (doc === "ter") {
      const marks = TER_MED_MARKS[protocol] || {};
      const selected = terMedKeysFromNames(medNames).filter((k) => !TER_MED_SKIP_AUTO.includes(k));
      for (const key of selected) {
        const m = marks[key];
        if (!m) continue;
        const pg = pages[m.page];
        if (!pg) continue;
        try {
          pg.drawText("X", { x: m.x, y: m.y, size: m.size ?? 10, font, color: rgb(0, 0, 0) });
        } catch { /* ok */ }
      }
    }

    const pdf = await out.save();
    const fname = `${doc}-${protocol || "ceaf"}-oficial.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("ceaf/official", err);
    return NextResponse.json({ error: "Não foi possível gerar o documento oficial." }, { status: 500 });
  }
}

function cityFrom(address?: string | null): string {
  const s = String(address || "").trim();
  if (!s) return "";
  // Endereço completo: pega o último segmento que parece cidade (sem número).
  const parts = s.split(/[,\-/]/).map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || s;
  if (/^\d+$/.test(last)) return parts[parts.length - 2] || "";
  return last.length > 40 ? last.slice(0, 40) : last;
}
