import { NextResponse } from "next/server";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { findPatientByClinicalKey } from "@/lib/patients-store";
import { getClinic, listMembershipsForActor, writeAudit } from "@/lib/platform-store";
import { getPlatformActor } from "@/lib/platform-access";
import { listPayments } from "@/lib/clinic-finance-store";
import {
  createReceiptDoc,
  encountersForPatientKeys,
  listFiscalForPatient,
  nfseConfigured,
  NFSE_STATUS_LABEL,
  requestNfseDoc,
} from "@/lib/clinic-cash-store";
import { formatCrm } from "@/lib/official-report";

const PAY_LABEL: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  courtesy: "Cortesia",
  other: "Outro",
};
const PAY_STATUS: Record<string, string> = {
  paid: "Pago",
  partial: "Parcial",
  pending: "Pendente",
  courtesy: "Cortesia",
};

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const access = await resolvePatientAccess(email);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  const actor = await getPlatformActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const patient = await findPatientByClinicalKey(access.key);
  const keys = Array.from(
    new Set([access.key, access.email, patient?.email, patient ? `pid:${patient.id}` : ""].filter(Boolean).map((k) => String(k).toLowerCase()))
  );
  const all = await encountersForPatientKeys(keys);
  const memberships = await listMembershipsForActor("doctor", actor.doctorId);
  const adminClinics = new Set(memberships.filter((m) => m.role === "ADMIN_CLINICA").map((m) => m.clinicId));
  const encounters = all.filter((e) => actor.isSuperAdmin || adminClinics.has(e.clinicId) || e.doctorId === actor.doctorId);
  const docs = await listFiscalForPatient(keys);
  const paymentsByClinic = new Map<string, Awaited<ReturnType<typeof listPayments>>>();
  for (const enc of encounters) {
    if (!paymentsByClinic.has(enc.clinicId)) paymentsByClinic.set(enc.clinicId, await listPayments(enc.clinicId));
  }
  const items = encounters.map((enc) => {
    const pays = (paymentsByClinic.get(enc.clinicId) || []).filter((p) => p.encounterId === enc.id);
    const last = pays.find((p) => p.amountCents > 0) || pays[0];
    const rec = docs.filter((d) => d.kind === "recibo" && d.encounterId === enc.id);
    const nf = docs.filter((d) => d.kind === "nfse" && d.encounterId === enc.id);
    const nfStatus = nf[0]?.status || "not_requested";
    return {
      encounter: enc,
      payment: last
        ? { method: last.method, methodLabel: PAY_LABEL[last.method] || last.method, status: enc.paymentStatus, statusLabel: PAY_STATUS[enc.paymentStatus] || enc.paymentStatus }
        : { method: null, methodLabel: "—", status: enc.paymentStatus, statusLabel: PAY_STATUS[enc.paymentStatus] || enc.paymentStatus },
      recibo: rec[0] ? { id: rec[0].id, number: rec[0].number, status: "issued" } : null,
      nfse: { status: nfStatus, statusLabel: NFSE_STATUS_LABEL[nfStatus] || "Não solicitada", id: nf[0]?.id || null, number: nf[0]?.number || null },
    };
  });
  return NextResponse.json({
    patient: {
      name: patient?.name || access.name,
      cpf: patient?.cpf || access.cpf,
      email: patient?.email || access.email,
      phone: patient?.phone || access.phone,
      address: patient?.address || access.city,
    },
    doctor: { id: actor.doctorId, name: actor.name, email: actor.email },
    items,
    docs,
    nfseConfigured: nfseConfigured(),
    statusLabel: NFSE_STATUS_LABEL,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const access = await resolvePatientAccess(email);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  const actor = await getPlatformActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const patient = await findPatientByClinicalKey(access.key);
  const keys = Array.from(
    new Set([access.key, access.email, patient?.email, patient ? `pid:${patient.id}` : ""].filter(Boolean).map((k) => String(k).toLowerCase()))
  );
  const all = await encountersForPatientKeys(keys);
  const memberships = await listMembershipsForActor("doctor", actor.doctorId);
  const adminClinics = new Set(memberships.filter((m) => m.role === "ADMIN_CLINICA").map((m) => m.clinicId));
  const encounters = all.filter((e) => actor.isSuperAdmin || adminClinics.has(e.clinicId) || e.doctorId === actor.doctorId);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const encounter = encounters.find((e) => e.id === String(body.encounterId || "")) || encounters[0] || null;
  const doctor = await getDoctorById(actor.doctorId);
  let clinicId = encounter?.clinicId || "";
  if (!clinicId) clinicId = memberships[0]?.clinicId || "";
  if (!clinicId) {
    return NextResponse.json({ error: "Este atendimento ainda não está vinculado a uma clínica." }, { status: 400 });
  }
  const clinic = await getClinic(clinicId);
  const pays = encounter ? await listPayments(clinicId, encounter.id) : [];
  const last = pays.find((p) => p.amountCents > 0);
  const amountCents =
    encounter && encounter.receivedCents > 0
      ? encounter.receivedCents
      : encounter?.feeCents || Math.round(Number(body.amountCents || 0));
  const payload = {
    clinicId,
    clinicName: clinic?.name || "Clínica",
    clinicLegalName: clinic?.legalName,
    clinicCnpj: clinic?.cnpj,
    clinicCity: clinic?.city,
    encounterId: encounter?.id ?? null,
    patientKey: access.key,
    amountCents,
    serviceLabel: "Consulta",
    paymentMethod: last ? PAY_LABEL[last.method] : null,
    patientName: patient?.name || access.name,
    patientCpf: patient?.cpf || access.cpf,
    patientEmail: patient?.email || access.email,
    patientPhone: patient?.phone || access.phone,
    patientAddress: patient?.address || null,
    doctorId: encounter?.doctorId || actor.doctorId,
    doctorName: doctor?.name || actor.name,
    doctorCrm: doctor ? formatCrm(doctor.crm, doctor.crmState) : null,
    actor: { kind: "doctor" as const, id: actor.doctorId, email: actor.email },
  };
  try {
    if (action === "recibo") {
      const doc = await createReceiptDoc(payload);
      await writeAudit({
        actorKind: "doctor",
        actorId: actor.doctorId,
        actorEmail: actor.email,
        action: "clinic_receipt",
        entity: "clinic_fiscal_doc",
        entityId: doc.id,
        detail: `${payload.patientName} · ${doc.number}`,
      });
      return NextResponse.json({ doc }, { status: 201 });
    }
    if (action === "nfse_request") {
      const result = await requestNfseDoc(payload);
      await writeAudit({
        actorKind: "doctor",
        actorId: actor.doctorId,
        actorEmail: actor.email,
        action: result.autoIssued ? "clinic_nfse_issue" : "clinic_nfse_request",
        entity: "clinic_fiscal_doc",
        entityId: result.doc.id,
        detail: `${payload.patientName} · ${result.doc.status}`,
      });
      return NextResponse.json(result, { status: 201 });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível gerar o documento." }, { status: 400 });
  }
}
