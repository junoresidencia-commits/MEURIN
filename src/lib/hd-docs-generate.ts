import "server-only";

import { v4 as uuid } from "uuid";
import { getDoctorById } from "@/lib/store";
import { getPatient, clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";
import { createLme } from "@/lib/lme-store";
import { addDocument } from "@/lib/patient-store";
import { receitaFromLme, relatorioFromLme, officialTerSlot } from "@/lib/complementary-docs";
import { buildOfficialCeafPdf } from "@/lib/ceaf-official-pdf";
import { DOCPDF_BUCKET, saveFile } from "@/lib/doc-storage";
import { todayBr } from "@/lib/pdf-winansi";
import { hdLinkMeuRimPatients, hdLinkOnePatient, hdListPatients, hdPatientDetail, type HdCtx } from "@/lib/hd-store";
import { suggestHdDocsFromExams, type HdDocPackage, type HdDocSuggestion } from "@/lib/hd-docs-from-exams";

export type HdDocsLinked = {
  id: string;
  name: string;
  key: string;
  cns: string | null;
  cpf: string | null;
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
  relatorioId: string | null;
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
    if (p) return { id: p.id, name: p.name, key: clinicalKey(p), cns: p.cns || null, cpf: p.cpf || null };
  }
  await hdLinkMeuRimPatients(ctx);
  const detail = await hdPatientDetail(ctx, hdPatientId);
  const again = detail?.patient.patientId ? await getPatient(detail.patient.patientId) : null;
  if (again) return { id: again.id, name: again.name, key: clinicalKey(again), cns: again.cns || null, cpf: again.cpf || null };
  const mine = await listPatientsByDoctor(ctx.actor.doctorId);
  const byName = mine.find((x) => x.name.trim().toLowerCase() === (detail?.patient.name || "").trim().toLowerCase());
  if (!byName) return null;
  return { id: byName.id, name: byName.name, key: clinicalKey(byName), cns: byName.cns || null, cpf: byName.cpf || null };
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
  const locations = pickLocations(doctor);
  const suggestion = suggestHdDocsFromExams({
    labs: detail.labs,
    alerts: detail.alerts,
    map: detail.prescription,
  });
  const linked = await resolveLinked(ctx, patientId, detail.patient.patientId);
  const blockers: string[] = [];
  if (!linked) blockers.push("Vincule este paciente da hemodiálise ao cadastro do Meu Rim para gerar a LME com CNS.");
  else if (!linked.cns) blockers.push("Cadastro sem CNS. A LME sai pronta, mas o CNS fica em branco até o médico completar o paciente.");
  if (!locations.length) blockers.push("Nenhum local da agenda tem CNES. Cadastre o CNES em Configurar agenda → Locais — a LME usa esse número.");
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
  const preview = await hdPreviewDocsFromExams(ctx, input.patientId, input.year, input.month);
  if (!preview) throw new Error("Paciente não encontrado.");
  if (!preview.linked) throw new Error("Vincule o paciente do Meu Rim para gerar a LME com CNS.");
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

  const missingTer = generated.filter((g) => !g.terId).length;
  const note = missingTer
    ? `Gerei ${generated.length} LME(s) com receita e relatório. TER oficial faltou em ${missingTer} — abra a LME e gere o termo.`
    : `Gerei ${generated.length} LME(s) com receita, relatório e TER oficial. Médico revisa e assina.`;
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
    cnes: loc?.cnes ?? null,
    patientName: linked.name,
    motherName: null,
    weightKg: null,
    heightCm: null,
    patientCpf: linked.cpf,
    patientCns: linked.cns,
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

  let receitaId: string | null = null;
  let relatorioId: string | null = null;
  const receitaDoc = await addDocument({
    patientEmail: linked.key,
    doctorId: doctor?.id ?? ctx.actor.doctorId,
    doctorName: doctor?.name ?? ctx.actor.name,
    doctorCrm: doctor?.crm ?? null,
    type: "receita",
    title: rx.title,
    body: rx.body,
    sharedWithPatient: false,
    status: "draft",
    sourceLmeId: lme.id,
  });
  receitaId = receitaDoc.id;
  const relDoc = await addDocument({
    patientEmail: linked.key,
    doctorId: doctor?.id ?? ctx.actor.doctorId,
    doctorName: doctor?.name ?? ctx.actor.name,
    doctorCrm: doctor?.crm ?? null,
    type: "relatorio",
    title: `Relatório médico — ${pack.protocolName}`,
    body: relBody,
    sharedWithPatient: false,
    status: "draft",
    sourceLmeId: lme.id,
  });
  relatorioId = relDoc.id;

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
    receitaId,
    relatorioId,
    terId: ter?.id ?? null,
    terUrl: ter?.url ?? null,
  };
}
