import "server-only";

import { v4 as uuid } from "uuid";
import { getDoctorById } from "@/lib/store";
import { getPatient, clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";
import { createLme } from "@/lib/lme-store";
import { addDocument } from "@/lib/patient-store";
import { receitaFromLme, relatorioFromLme, officialTerSlot } from "@/lib/complementary-docs";
import { buildOfficialCeafPdf } from "@/lib/ceaf-official-pdf";
import { buildDocumentPdfDetailed, type DocBackground } from "@/lib/document-engine";
import { getDefaultLetterhead } from "@/lib/letterheads-store";
import { DOCPDF_BUCKET, LETTERHEADS_BUCKET, readFile, saveFile } from "@/lib/doc-storage";
import { todayBr } from "@/lib/pdf-winansi";
import { hdGetSettings, hdLinkMeuRimPatients, hdLinkOnePatient, hdListPatients, hdPatientDetail, hdSyncPatientCadastro, type HdCtx } from "@/lib/hd-store";
import { suggestHdDocsFromExams, type HdDocPackage, type HdDocSuggestion } from "@/lib/hd-docs-from-exams";

export type HdDocsLinked = {
  id: string;
  name: string;
  key: string;
  cns: string | null;
  cpf: string | null;
  motherName: string | null;
};

export type HdDocsEstablishment = {
  id: string;
  name: string;
  cnes: string;
};

export type HdDocsGenerated = {
  lmeId: string;
  protocolId: string;
  protocolName: string;
  href: string;
  receitaId: string | null;
  receitaUrl: string | null;
  relatorioId: string | null;
  relatorioUrl: string | null;
  terId: string | null;
  terUrl: string | null;
};

export type HdDocsPreview = {
  hdPatientId: string;
  hdPatientName: string;
  linked: HdDocsLinked | null;
  establishment: HdDocsEstablishment | null;
  locations: HdDocsEstablishment[];
  suggestion: HdDocSuggestion;
  blockers: string[];
  canGenerate: boolean;
  cadastro: {
    cpf: string;
    cns: string;
    motherName: string;
    clinicCnes: string;
    clinicName: string;
    doctorCns: string;
  };
};

function pickLocations(doctor: { locations?: Array<{ id: string; name: string; cnes?: string; active?: boolean }> } | null): HdDocsEstablishment[] {
  return (doctor?.locations || [])
    .filter((l) => l.active !== false && txt(l.cnes))
    .map((l) => ({ id: l.id, name: l.name, cnes: String(l.cnes).replace(/\s+/g, "") }));
}

function txt(v?: string | null) {
  return String(v || "").trim();
}

async function resolveLinked(ctx: HdCtx, hdPatientId: string, linkedId: string | null): Promise<HdDocsLinked | null> {
  if (linkedId) {
    const p = await getPatient(linkedId);
    if (p) return { id: p.id, name: p.name, key: clinicalKey(p), cns: p.cns || null, cpf: p.cpf || null, motherName: p.motherName || null };
  }
  await hdLinkMeuRimPatients(ctx);
  const detail = await hdPatientDetail(ctx, hdPatientId);
  const again = detail?.patient.patientId ? await getPatient(detail.patient.patientId) : null;
  if (again) return { id: again.id, name: again.name, key: clinicalKey(again), cns: again.cns || null, cpf: again.cpf || null, motherName: again.motherName || null };
  const mine = await listPatientsByDoctor(ctx.actor.doctorId);
  const byName = mine.find((x) => x.name.trim().toLowerCase() === (detail?.patient.name || "").trim().toLowerCase());
  if (!byName) return null;
  return { id: byName.id, name: byName.name, key: clinicalKey(byName), cns: byName.cns || null, cpf: byName.cpf || null, motherName: byName.motherName || null };
}

export async function hdPreviewDocsFromExams(
  ctx: HdCtx,
  patientId: string,
  year?: number,
  month?: number
): Promise<HdDocsPreview | null> {
  const detail = await hdPatientDetail(ctx, patientId, year, month);
  if (!detail) return null;
  const doctor = await getDoctorById(ctx.actor.doctorId);
  const hdSet = await hdGetSettings(ctx);
  const clinicCnes = txt(hdSet.settings.cnes).replace(/\D/g, "").slice(0, 7);
  const clinicName = txt(hdSet.settings.centerName) || txt(hdSet.unit.name) || "Hemodiálise";
  const clinicLoc: HdDocsEstablishment[] = clinicCnes
    ? [{ id: `hd:${ctx.unit.id}`, name: clinicName, cnes: clinicCnes }]
    : [];
  const locations = [
    ...clinicLoc,
    ...pickLocations(doctor).filter((l) => !clinicCnes || l.cnes !== clinicCnes),
  ];
  const suggestion = suggestHdDocsFromExams({
    labs: detail.labs,
    alerts: detail.alerts,
    map: detail.prescription,
  });
  const linked = await resolveLinked(ctx, patientId, detail.patient.patientId);
  const cpf = txt(detail.patient.cpf) || txt(linked?.cpf);
  const cns = txt(detail.patient.cns) || txt(linked?.cns);
  const motherName = txt(detail.patient.motherName) || txt(linked?.motherName);
  const doctorCns = txt(doctor?.cns);
  const blockers: string[] = [];
  if (!linked) blockers.push("Cadastre CPF, Cartão do SUS e nome da mãe neste paciente — a LME usa esses dados.");
  else if (!cns) blockers.push("Cadastre o Cartão do SUS (CNS) do paciente. A LME sai, mas o campo fica em branco até completar.");
  if (!clinicCnes && !locations.length) blockers.push("Cadastre o CNES da clínica em Hemodiálise → Configurações.");
  if (!doctorCns) blockers.push("Cadastre o CNS do médico em Hemodiálise → Configurações. Vai para todas as LMEs.");
  if (!suggestion.canGenerate) blockers.push("Sem medicamento oficial para gerar. Preencha ferro/EPO/DMO no mapa ou publique exames com alerta.");
  return {
    hdPatientId: detail.patient.id,
    hdPatientName: detail.patient.name,
    linked,
    establishment: locations[0] || null,
    locations,
    suggestion,
    blockers,
    canGenerate: suggestion.canGenerate && Boolean(linked),
    cadastro: {
      cpf,
      cns,
      motherName,
      clinicCnes,
      clinicName,
      doctorCns,
    },
  };
}

async function saveTer(opts: {
  protocolId: string;
  lmeId: string;
  patientKey: string;
  patientName: string;
  patientCpf: string | null;
  doctorId: string;
  doctorName: string;
  doctorCrm: string | null;
}): Promise<{ id: string; url: string } | null> {
  const slot = officialTerSlot(opts.protocolId);
  if (slot.status !== "available") return null;
  try {
    const built = await buildOfficialCeafPdf(opts.protocolId, "ter", {
      name: opts.patientName,
      doctor: opts.doctorName,
      crm: opts.doctorCrm || "",
      date: todayBr(),
      cpf: opts.patientCpf || "",
      birth: "",
    });
    const saved = await saveFile(DOCPDF_BUCKET, opts.doctorId, {
      name: "ter-oficial.pdf",
      type: "application/pdf",
      buffer: Buffer.from(built.bytes),
    });
    const doc = await addDocument({
      patientEmail: opts.patientKey,
      doctorId: opts.doctorId,
      doctorName: opts.doctorName,
      doctorCrm: opts.doctorCrm,
      type: "ter",
      title: built.label,
      body: `TER oficial — ${built.label}`,
      sharedWithPatient: false,
      pdfPath: saved.path,
      pdfStorage: saved.storage,
      status: "final",
      version: 1,
      groupId: uuid(),
      sourceLmeId: opts.lmeId,
    });
    return { id: doc.id, url: `/api/documents/${doc.id}/pdf` };
  } catch {
    return null;
  }
}

async function letterheadBackground(doctorId: string): Promise<DocBackground | null> {
  const lh = await getDefaultLetterhead(doctorId).catch(() => null);
  if (!lh) return null;
  const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath).catch(() => null);
  if (!file) return null;
  return { kind: lh.kind, bytes: file.buffer, mime: lh.mime || file.mime };
}

async function savePrintableDoc(opts: {
  type: "receita" | "relatorio";
  title: string;
  body: string;
  patientKey: string;
  patientName: string;
  patientCpf: string | null;
  doctor: {
    id: string;
    name: string;
    crm?: string | null;
    crmState?: string | null;
    rqe?: string | null;
    specialty?: string | null;
  };
  lmeId: string;
}): Promise<{ id: string; url: string } | null> {
  try {
    const background = await letterheadBackground(opts.doctor.id);
    const built = await buildDocumentPdfDetailed({
      title: opts.title,
      content: opts.body,
      patient: { name: opts.patientName, cpf: opts.patientCpf || undefined },
      doctor: {
        name: opts.doctor.name,
        crm: opts.doctor.crm || undefined,
        crmState: opts.doctor.crmState || undefined,
        rqe: opts.doctor.rqe || undefined,
        specialty: opts.doctor.specialty || undefined,
      },
      area: { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true },
      background,
    });
    const saved = await saveFile(DOCPDF_BUCKET, opts.doctor.id, {
      name: `${opts.type}.pdf`,
      type: "application/pdf",
      buffer: Buffer.from(built.bytes),
    });
    const doc = await addDocument({
      patientEmail: opts.patientKey,
      doctorId: opts.doctor.id,
      doctorName: opts.doctor.name,
      doctorCrm: opts.doctor.crm ?? null,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      sharedWithPatient: false,
      letterheadId: null,
      pdfPath: saved.path,
      pdfStorage: saved.storage,
      status: "final",
      version: 1,
      groupId: uuid(),
      sourceLmeId: opts.lmeId,
    });
    return { id: doc.id, url: `/api/documents/${doc.id}/pdf` };
  } catch {
    return null;
  }
}

function anamnesisOf(preview: HdDocsPreview, pack: HdDocPackage): string {
  const lines = [
    "Paciente em programa de hemodiálise.",
    preview.suggestion.labsText ? `Exames publicados (não inventados):\n${preview.suggestion.labsText}` : "",
    preview.suggestion.opinion.length ? `Opinião do protocolo:\n${preview.suggestion.opinion.join("\n")}` : "",
    pack.reasons.length ? `Motivo do pacote: ${pack.reasons.join(" ")}` : "",
    "Pacote CEAF/SESAB montado com o catálogo oficial. O médico revisa quantidade, via e assina. A IA não prescreve.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export async function hdListDocsFromExams(ctx: HdCtx, year?: number, month?: number): Promise<{ items: HdDocsPreview[] }> {
  const patients = await hdListPatients(ctx, undefined, "", year, month);
  const items: HdDocsPreview[] = [];
  for (const p of patients) {
    const preview = await hdPreviewDocsFromExams(ctx, p.id, year, month);
    if (!preview) continue;
    if (!preview.suggestion.hasLabs && !preview.suggestion.packages.length) continue;
    items.push(preview);
  }
  return { items };
}

export async function hdGenerateDocsFromExams(
  ctx: HdCtx,
  input: {
    patientId: string;
    year?: number;
    month?: number;
    meuRimPatientId?: string;
    locationId?: string;
  }
): Promise<{ preview: HdDocsPreview; generated: HdDocsGenerated[]; note: string }> {
  if (input.meuRimPatientId) {
    await hdLinkOnePatient(ctx, input.patientId, input.meuRimPatientId);
  }
  await hdSyncPatientCadastro(ctx, input.patientId);
  const preview = await hdPreviewDocsFromExams(ctx, input.patientId, input.year, input.month);
  if (!preview) throw new Error("Paciente não encontrado.");
  if (!preview.linked) throw new Error("Cadastre CPF, Cartão do SUS e nome da mãe neste paciente para gerar a LME.");
  const ready = preview.suggestion.packages.filter((p) => p.ready);
  if (!ready.length) throw new Error("Sem medicamento oficial para gerar. Não inventamos dose nem apresentação.");

  const doctor = await getDoctorById(ctx.actor.doctorId);
  const loc =
    preview.locations.find((l) => l.id === input.locationId) ||
    preview.establishment ||
    preview.locations[0] ||
    null;

  const generated: HdDocsGenerated[] = [];
  for (const pack of ready) {
    const item = await createOnePack(ctx, preview, pack, doctor, loc);
    generated.push(item);
  }

  const missingPdf = generated.filter((g) => !g.receitaUrl || !g.relatorioUrl || !g.terId).length;
  const note = missingPdf
    ? `Gerei ${generated.length} LME(s). Algum PDF (receita, relatório ou TER) faltou — abra a LME e imprima o que já está pronto.`
    : `Gerei ${generated.length} LME(s) com receita, relatório e TER em PDF, cada um separado. Conferir e imprimir — o médico assina.`;
  return { preview, generated, note };
}

async function createOnePack(
  ctx: HdCtx,
  preview: HdDocsPreview,
  pack: HdDocPackage,
  doctor: Awaited<ReturnType<typeof getDoctorById>>,
  loc: HdDocsEstablishment | null
): Promise<HdDocsGenerated> {
  const linked = preview.linked!;
  const lme = await createLme({
    patientEmail: linked.key,
    doctorId: doctor?.id ?? ctx.actor.doctorId,
    doctorName: doctor?.name ?? ctx.actor.name,
    doctorCrm: doctor?.crm ?? null,
    doctorCns: doctor?.cns ?? null,
    establishmentName: loc?.name ?? null,
    cnes: loc?.cnes || preview.cadastro.clinicCnes || null,
    patientName: linked.name,
    motherName: preview.cadastro.motherName || linked.motherName || null,
    weightKg: null,
    heightCm: null,
    patientCpf: preview.cadastro.cpf || linked.cpf,
    patientCns: preview.cadastro.cns || linked.cns,
    patientPhone: null,
    patientEmailContact: linked.key.includes("@") ? linked.key : null,
    race: null,
    cid10: pack.cid10,
    diagnosis: pack.diagnosis,
    anamnesis: anamnesisOf(preview, pack),
    priorTreatment: true,
    priorTreatmentDesc: "Hemodiálise",
    incapable: false,
    responsibleName: null,
    medications: pack.medications.map((m) => ({
      name: m.name,
      presentation: m.presentation,
      monthlyQty: m.monthlyQty,
    })),
    protocolId: pack.protocolId,
    status: "rascunho",
  });

  const rx = receitaFromLme(lme);
  const rel = relatorioFromLme(lme);
  const relBody = [
    rel.body,
    "",
    preview.suggestion.labsText ? `Exames publicados:\n${preview.suggestion.labsText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const docDoctor = {
    id: doctor?.id ?? ctx.actor.doctorId,
    name: doctor?.name ?? ctx.actor.name,
    crm: doctor?.crm ?? null,
    crmState: doctor?.crmState ?? null,
    rqe: doctor?.rqe ?? null,
    specialty: doctor?.specialty ?? null,
  };
  const receitaDoc = await savePrintableDoc({
    type: "receita",
    title: rx.title,
    body: rx.body,
    patientKey: linked.key,
    patientName: linked.name,
    patientCpf: linked.cpf,
    doctor: docDoctor,
    lmeId: lme.id,
  });
  const relDoc = await savePrintableDoc({
    type: "relatorio",
    title: `Relatório médico — ${pack.protocolName}`,
    body: relBody,
    patientKey: linked.key,
    patientName: linked.name,
    patientCpf: linked.cpf,
    doctor: docDoctor,
    lmeId: lme.id,
  });

  const ter = await saveTer({
    protocolId: pack.protocolId,
    lmeId: lme.id,
    patientKey: linked.key,
    patientName: linked.name,
    patientCpf: linked.cpf,
    doctorId: doctor?.id ?? ctx.actor.doctorId,
    doctorName: doctor?.name ?? ctx.actor.name,
    doctorCrm: doctor?.crm ?? null,
  });

  return {
    lmeId: lme.id,
    protocolId: pack.protocolId,
    protocolName: pack.protocolName,
    href: `/lme/${lme.id}`,
    receitaId: receitaDoc?.id ?? null,
    receitaUrl: receitaDoc?.url ?? null,
    relatorioId: relDoc?.id ?? null,
    relatorioUrl: relDoc?.url ?? null,
    terId: ter?.id ?? null,
    terUrl: ter?.url ?? null,
  };
}
