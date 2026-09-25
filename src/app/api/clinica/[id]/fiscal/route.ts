import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import {
  attachIssuedNfse,
  createReceiptDoc,
  listFiscalDocs,
  nfseConfigured,
  NFSE_STATUS_LABEL,
  requestNfseDoc,
} from "@/lib/clinic-cash-store";
import { getEncounter, listPayments } from "@/lib/clinic-finance-store";
import { findPatientByClinicalKey } from "@/lib/patients-store";
import { getDoctorById } from "@/lib/store";
import { formatCrm } from "@/lib/official-report";
import { writeAudit } from "@/lib/platform-store";

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  courtesy: "Cortesia",
  other: "Outro",
};

async function payloadFromEncounter(clinicName: string, encounterId: string, clinicId: string) {
  const encounter = await getEncounter(encounterId);
  if (!encounter || encounter.clinicId !== clinicId) throw new Error("Atendimento não encontrado nesta clínica.");
  const [patient, doctor, payments] = await Promise.all([
    findPatientByClinicalKey(encounter.patientKey),
    getDoctorById(encounter.doctorId),
    listPayments(clinicId, encounter.id),
  ]);
  const lastPay = payments.find((p) => p.amountCents > 0) || payments[0];
  const amount = encounter.receivedCents > 0 ? encounter.receivedCents : encounter.feeCents;
  return {
    encounter,
    amountCents: amount,
    paymentMethod: lastPay ? METHOD_LABEL[lastPay.method] || lastPay.method : null,
    patientKey: encounter.patientKey,
    patientName: patient?.name || encounter.patientName || "Paciente",
    patientCpf: patient?.cpf || null,
    patientEmail: patient?.email || (encounter.patientKey.includes("@") ? encounter.patientKey : null),
    patientPhone: patient?.phone || null,
    patientAddress: patient?.address || null,
    doctorId: encounter.doctorId,
    doctorName: doctor?.name || null,
    doctorCrm: doctor ? formatCrm(doctor.crm, doctor.crmState) : null,
    clinicName,
    serviceLabel: "Consulta",
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const docs = await listFiscalDocs(id);
  return NextResponse.json({
    docs,
    nfseConfigured: nfseConfigured(),
    statusLabel: NFSE_STATUS_LABEL,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const need = action === "recibo" ? "receipt" : "nfse_request";
  const staff = await requireClinicCashPerm(id, need);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const base = body.encounterId
      ? await payloadFromEncounter(staff.clinic.name, String(body.encounterId), id)
      : {
          encounter: null,
          amountCents: Math.round(Number(body.amount != null ? Number(body.amount) * 100 : body.amountCents || 0)),
          paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
          patientKey: String(body.patientKey || body.patientEmail || ""),
          patientName: String(body.patientName || ""),
          patientCpf: body.patientCpf ? String(body.patientCpf) : null,
          patientEmail: body.patientEmail ? String(body.patientEmail) : null,
          patientPhone: body.patientPhone ? String(body.patientPhone) : null,
          patientAddress: body.patientAddress ? String(body.patientAddress) : null,
          doctorId: body.doctorId ? String(body.doctorId) : null,
          doctorName: body.doctorName ? String(body.doctorName) : staff.name,
          doctorCrm: body.doctorCrm ? String(body.doctorCrm) : null,
          clinicName: staff.clinic.name,
          serviceLabel: String(body.serviceLabel || "Consulta"),
        };
    if (!base.patientKey || !base.patientName) throw new Error("Informe o paciente.");
    const actor = { kind: staff.kind, id: staff.actorId, email: staff.email };
    if (action === "recibo") {
      const doc = await createReceiptDoc({
        clinicId: id,
        clinicName: staff.clinic.name,
        clinicLegalName: staff.clinic.legalName,
        clinicCnpj: staff.clinic.cnpj,
        clinicCity: staff.clinic.city,
        encounterId: base.encounter?.id ?? (body.encounterId ? String(body.encounterId) : null),
        patientKey: base.patientKey,
        amountCents: base.amountCents,
        serviceLabel: base.serviceLabel,
        paymentMethod: base.paymentMethod,
        patientName: base.patientName,
        patientCpf: base.patientCpf,
        patientEmail: base.patientEmail,
        patientPhone: base.patientPhone,
        patientAddress: base.patientAddress,
        doctorId: base.doctorId,
        doctorName: base.doctorName,
        doctorCrm: base.doctorCrm,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "clinic_receipt",
        entity: "clinic_fiscal_doc",
        entityId: doc.id,
        detail: `${staff.clinic.name} · ${doc.patientName} · ${doc.number}`,
      });
      return NextResponse.json({ doc }, { status: 201 });
    }
    if (action === "nfse_request") {
      const result = await requestNfseDoc({
        clinicId: id,
        clinicName: staff.clinic.name,
        clinicCnpj: staff.clinic.cnpj,
        encounterId: base.encounter?.id ?? (body.encounterId ? String(body.encounterId) : null),
        patientKey: base.patientKey,
        amountCents: base.amountCents,
        serviceLabel: base.serviceLabel,
        paymentMethod: base.paymentMethod,
        patientName: base.patientName,
        patientCpf: base.patientCpf,
        patientEmail: base.patientEmail,
        patientPhone: base.patientPhone,
        patientAddress: base.patientAddress,
        doctorId: base.doctorId,
        doctorName: base.doctorName,
        doctorCrm: base.doctorCrm,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: result.autoIssued ? "clinic_nfse_issue" : "clinic_nfse_request",
        entity: "clinic_fiscal_doc",
        entityId: result.doc.id,
        detail: `${staff.clinic.name} · ${result.doc.patientName} · ${result.doc.status}`,
      });
      return NextResponse.json(result, { status: 201 });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir." }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "nfse_request");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const docId = String(form.get("docId") || "");
      const number = form.get("number") ? String(form.get("number")) : undefined;
      const pdfFile = form.get("pdf");
      const xmlFile = form.get("xml");
      const pdf =
        pdfFile && typeof pdfFile !== "string"
          ? { name: pdfFile.name, type: pdfFile.type, buffer: Buffer.from(await pdfFile.arrayBuffer()) }
          : null;
      const xml =
        xmlFile && typeof xmlFile !== "string"
          ? { name: xmlFile.name, type: xmlFile.type, buffer: Buffer.from(await xmlFile.arrayBuffer()) }
          : null;
      const doc = await attachIssuedNfse({
        clinicId: id,
        docId,
        number,
        pdf,
        xml,
        actor: { kind: staff.kind, id: staff.actorId, email: staff.email },
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "clinic_nfse_attach",
        entity: "clinic_fiscal_doc",
        entityId: doc.id,
        detail: `${staff.clinic.name} · ${doc.number} · emitida`,
      });
      return NextResponse.json({ doc });
    }
    const body = await req.json().catch(() => ({}));
    const doc = await attachIssuedNfse({
      clinicId: id,
      docId: String(body.docId || ""),
      number: body.number ? String(body.number) : undefined,
      actor: { kind: staff.kind, id: staff.actorId, email: staff.email },
    });
    return NextResponse.json({ doc });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível anexar a nota." }, { status: 400 });
  }
}
