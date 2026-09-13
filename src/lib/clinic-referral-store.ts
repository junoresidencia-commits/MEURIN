import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { getClinic, getClinicsByIds, listMemberships, listMembershipsForActor, writeAudit } from "./platform-store";
import { listDoctors } from "./store";
import type {
  Clinic,
  ClinicPatientLink,
  ClinicPeerDoctor,
  ClinicReferral,
  ClinicReferralStatus,
} from "./platform-types";
import type { PatientDoctorShare } from "./patient-shares-store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-referrals.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { referrals: ClinicReferral[]; links: ClinicPatientLink[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { referrals: [], links: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[clinic-referral] persistência local indisponível", err);
  }
}

function mapReferral(r: Record<string, unknown>): ClinicReferral {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    shareId: (r.share_id as string) ?? (r.shareId as string) ?? null,
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    fromDoctorId: String(r.from_doctor_id ?? r.fromDoctorId),
    fromDoctorName: (r.from_doctor_name as string) ?? (r.fromDoctorName as string) ?? null,
    fromSpecialty: (r.from_specialty as string) ?? (r.fromSpecialty as string) ?? null,
    toDoctorId: String(r.to_doctor_id ?? r.toDoctorId),
    toDoctorName: (r.to_doctor_name as string) ?? (r.toDoctorName as string) ?? null,
    toSpecialty: (r.to_specialty as string) ?? (r.toSpecialty as string) ?? null,
    reason: (r.reason as string) ?? null,
    status: (String(r.status || "active") as ClinicReferralStatus),
    createdAt: String(r.created_at ?? r.createdAt),
    cancelledAt: (r.cancelled_at as string) ?? (r.cancelledAt as string) ?? null,
  };
}

function isClinicDoctorRole(role: string) {
  return role === "MEDICO" || role === "ADMIN_CLINICA";
}

export async function findSharedClinics(fromDoctorId: string, toDoctorId: string): Promise<Clinic[]> {
  if (!fromDoctorId || !toDoctorId || fromDoctorId === toDoctorId) return [];
  try {
    const [fromMs, toMs] = await Promise.all([
      listMembershipsForActor("doctor", fromDoctorId),
      listMembershipsForActor("doctor", toDoctorId),
    ]);
    const toClinics = new Set(
      toMs.filter((m) => isClinicDoctorRole(m.role)).map((m) => m.clinicId)
    );
    const sharedIds = [...new Set(fromMs.filter((m) => isClinicDoctorRole(m.role) && toClinics.has(m.clinicId)).map((m) => m.clinicId))];
    const clinics: Clinic[] = [];
    for (const id of sharedIds) {
      const clinic = await getClinic(id);
      if (clinic && clinic.status === "active") clinics.push(clinic);
    }
    return clinics;
  } catch (err) {
    console.error("[clinic-referral] clínicas em comum", err);
    return [];
  }
}

export async function listClinicPeersForDoctor(doctorId: string): Promise<ClinicPeerDoctor[]> {
  if (!doctorId) return [];
  try {
    const mine = (await listMembershipsForActor("doctor", doctorId)).filter((m) => isClinicDoctorRole(m.role));
    const clinics = await getClinicsByIds(mine.map((m) => m.clinicId));
    const clinicById = new Map(clinics.filter((c) => c.status === "active").map((c) => [c.id, c]));
    const [doctors, membershipLists] = await Promise.all([
      listDoctors(),
      Promise.all(mine.map((m) => listMemberships(m.clinicId))),
    ]);
    const doctorById = new Map(doctors.map((d) => [d.id, d]));
    const byPeer = new Map<string, ClinicPeerDoctor>();
    mine.forEach((m, idx) => {
      const clinic = clinicById.get(m.clinicId);
      if (!clinic) return;
      const members = (membershipLists[idx] || []).filter(
        (x) => x.actorKind === "doctor" && x.status === "active" && isClinicDoctorRole(x.role) && x.actorId !== doctorId
      );
      for (const peer of members) {
        const doc = doctorById.get(peer.actorId);
        if (!doc || (doc.status ?? "approved") !== "approved") continue;
        const existing = byPeer.get(doc.id);
        if (existing) {
          if (!existing.clinics.some((c) => c.id === clinic.id)) {
            existing.clinics.push({ id: clinic.id, name: clinic.name });
          }
        } else {
          byPeer.set(doc.id, {
            id: doc.id,
            name: doc.name,
            specialty: doc.specialty || "",
            crm: doc.crm,
            clinics: [{ id: clinic.id, name: clinic.name }],
          });
        }
      }
    });
    return [...byPeer.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } catch (err) {
    console.error("[clinic-referral] pares da clínica", err);
    return [];
  }
}

export async function listReferrals(clinicId: string): Promise<ClinicReferral[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("clinic_referrals")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapReferral(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).referrals
    .filter((r) => r.clinicId === clinicId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReferralsForDoctor(doctorId: string): Promise<ClinicReferral[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("clinic_referrals")
      .select("*")
      .or(`from_doctor_id.eq.${doctorId},to_doctor_id.eq.${doctorId}`)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapReferral(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).referrals
    .filter((r) => r.fromDoctorId === doctorId || r.toDoctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countPatientLinks(clinicId: string): Promise<number> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { count, error } = await sb
      .from("clinic_patient_links")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return 0;
    } else {
      return count ?? 0;
    }
  }
  return (await readLocal()).links.filter((l) => l.clinicId === clinicId).length;
}

async function ensurePatientClinicLink(clinicId: string, patientKey: string): Promise<void> {
  const key = patientKey.toLowerCase().trim();
  if (!clinicId || !key) return;
  const row: ClinicPatientLink = {
    id: uuid(),
    clinicId,
    patientKey: key,
    source: "referral",
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const existing = await sb
      .from("clinic_patient_links")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_key", key)
      .maybeSingle();
    if (existing.data) return;
    const { error } = await sb.from("clinic_patient_links").insert({
      id: row.id,
      clinic_id: row.clinicId,
      patient_key: row.patientKey,
      source: row.source,
      created_at: row.createdAt,
    });
    if (error && !isMissing(error)) {
      console.error("[clinic-referral] vínculo paciente↔clínica", error);
      return;
    }
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  if (!local.links.some((l) => l.clinicId === clinicId && l.patientKey === key)) {
    local.links.push(row);
    await writeLocal(local);
  }
}

/**
 * Se os dois médicos compartilham clínica, registra o encaminhamento intra-clínica.
 * Nunca move o paciente (doctor_id permanece). Falha aqui NÃO pode derrubar o share.
 */
export async function recordIntraClinicReferral(input: {
  share: PatientDoctorShare;
  preferredClinicId?: string | null;
}): Promise<ClinicReferral | null> {
  try {
    const clinics = await findSharedClinics(input.share.fromDoctorId, input.share.toDoctorId);
    if (!clinics.length) return null;
    const clinic =
      (input.preferredClinicId && clinics.find((c) => c.id === input.preferredClinicId)) || clinics[0];

    const existing = (await listReferrals(clinic.id)).find(
      (r) =>
        r.status === "active" &&
        r.patientKey === input.share.patientKey &&
        r.toDoctorId === input.share.toDoctorId
    );
    if (existing) return existing;

    const row: ClinicReferral = {
      id: uuid(),
      clinicId: clinic.id,
      shareId: input.share.id,
      patientKey: input.share.patientKey,
      patientName: input.share.patientName,
      fromDoctorId: input.share.fromDoctorId,
      fromDoctorName: input.share.fromDoctorName,
      fromSpecialty: input.share.fromSpecialty,
      toDoctorId: input.share.toDoctorId,
      toDoctorName: input.share.toDoctorName,
      toSpecialty: input.share.toSpecialty,
      reason: input.share.reason,
      status: "active",
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };

    if (active()) {
      const sb = getSupabaseAdmin()!;
      const { error } = await sb.from("clinic_referrals").insert({
        id: row.id,
        clinic_id: row.clinicId,
        share_id: row.shareId,
        patient_key: row.patientKey,
        patient_name: row.patientName,
        from_doctor_id: row.fromDoctorId,
        from_doctor_name: row.fromDoctorName,
        from_specialty: row.fromSpecialty,
        to_doctor_id: row.toDoctorId,
        to_doctor_name: row.toDoctorName,
        to_specialty: row.toSpecialty,
        reason: row.reason,
        status: row.status,
        created_at: row.createdAt,
      });
      if (error && !isMissing(error)) {
        console.error("[clinic-referral] insert", error);
        return null;
      }
      if (error && isMissing(error)) tableMissing = true;
      else if (!error) {
        await afterReferral(row, clinic.name);
        return row;
      }
    }

    const local = await readLocal();
    local.referrals.unshift(row);
    await writeLocal(local);
    await afterReferral(row, clinic.name);
    return row;
  } catch (err) {
    console.error("[clinic-referral] registro ignorado", err);
    return null;
  }
}

async function afterReferral(row: ClinicReferral, clinicName: string) {
  try {
    await ensurePatientClinicLink(row.clinicId, row.patientKey);
  } catch (err) {
    console.error("[clinic-referral] link pontual", err);
  }
  try {
    await writeAudit({
      actorKind: "doctor",
      actorId: row.fromDoctorId,
      actorEmail: null,
      action: "clinic_referral",
      entity: "clinic_referral",
      entityId: row.id,
      detail: `Intra-clínica ${clinicName}: ${row.fromDoctorName} → ${row.toDoctorName}. Paciente permanece no médico original.`,
    });
  } catch (err) {
    console.error("[clinic-referral] audit", err);
  }
}

export async function cancelReferralsForShare(shareId: string): Promise<void> {
  if (!shareId) return;
  const now = new Date().toISOString();
  try {
    if (active()) {
      const sb = getSupabaseAdmin()!;
      const { error } = await sb
        .from("clinic_referrals")
        .update({ status: "cancelled", cancelled_at: now })
        .eq("share_id", shareId)
        .eq("status", "active");
      if (error && !isMissing(error)) {
        console.error("[clinic-referral] cancel", error);
        return;
      }
      if (error && isMissing(error)) tableMissing = true;
      else if (!error) return;
    }
    const local = await readLocal();
    let changed = false;
    for (const r of local.referrals) {
      if (r.shareId === shareId && r.status === "active") {
        r.status = "cancelled";
        r.cancelledAt = now;
        changed = true;
      }
    }
    if (changed) await writeLocal(local);
  } catch (err) {
    console.error("[clinic-referral] cancel ignorado", err);
  }
}
