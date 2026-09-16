import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getLme } from "@/lib/lme-store";
import {
  inferProtocolFromMedNames,
  type OfficialDocKind,
} from "@/lib/ceaf-documents";
import { inferCeafProtocols } from "@/lib/ceaf-catalog";
import { buildOfficialCeafPdf, type FillValues } from "@/lib/ceaf-official-pdf";
import { idadeFromBirthdate, todayBr } from "@/lib/pdf-winansi";
import { jsonUtf8 } from "@/lib/json-utf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DOCS: OfficialDocKind[] = ["ter", "form", "residencia"];

function cityFrom(address?: string | null): string {
  const s = String(address || "").trim();
  if (!s) return "";
  const parts = s.split(/[,\-/]/).map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || s;
  if (/^\d+$/.test(last)) return parts[parts.length - 2] || "";
  return last.length > 40 ? last.slice(0, 40) : last;
}

function crmNumber(raw?: string | null) {
  const s = String(raw || "").trim();
  const digits = s.match(/(\d{3,})/);
  if (digits) return digits[1];
  return s.replace(/-.*$/, "").trim();
}

function inferProtocol(cid10: string | null | undefined, medNames: string[]): string {
  return (
    inferProtocolFromMedNames(medNames) ||
    inferCeafProtocols({ cid10, medications: medNames.map((name) => ({ name })) })[0] ||
    ""
  );
}

/** Extrai as páginas oficiais exatas do pacote SESAB e preenche identificação. Só médico logado. */
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  const { searchParams } = new URL(req.url);
  const doc = (searchParams.get("doc") || "") as OfficialDocKind;
  if (!DOCS.includes(doc)) return jsonUtf8({ error: "Informe o documento: ter, form ou residencia." }, 400);

  const doctor = await getDoctorById(doctorId);
  if (!doctor) return jsonUtf8({ error: "Médico não encontrado." }, 404);

  const lmeId = (searchParams.get("lmeId") || "").trim();
  const patientParam = (searchParams.get("patient") || "").trim();
  let protocol = (searchParams.get("protocol") || "").trim();

  const values: FillValues = {};
  let medNames: string[] = [];

  if (lmeId) {
    const lme = await getLme(lmeId);
    if (!lme) return jsonUtf8({ error: "LME não encontrada." }, 404);
    if (lme.doctorId && lme.doctorId !== doctorId) {
      return jsonUtf8({ error: "Sem acesso a esta LME." }, 403);
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
    if (!protocol) protocol = inferProtocol(lme.cid10, medNames);
    const access = await resolvePatientAccess(lme.patientEmail || patientParam);
    if (access?.allowed) {
      values.age = idadeFromBirthdate(access.birthdate);
      values.birth = access.birthdate ? new Date(access.birthdate).toLocaleDateString("pt-BR") : "";
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
    values.birth = searchParams.get("birth") || "";
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
        if (!values.birth && access.birthdate) {
          values.birth = new Date(access.birthdate).toLocaleDateString("pt-BR");
        }
        if (!values.city) values.city = cityFrom(access.city);
        if (!values.local) values.local = values.city;
      }
    }
  }

  const crmNum = crmNumber(values.crm || doctor.crm);
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

  const result = await buildOfficialCeafPdf({ protocol, doc, values, medNames });
  if (!result.ok) return jsonUtf8({ error: result.error }, result.status);

  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
