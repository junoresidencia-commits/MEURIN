/**
 * SaaS Meu Rim — planos, licenças e MRR.
 * Separado do financeiro da clínica. Tabelas ausentes não derrubam login.
 * Sem licença a área médica continua liberada.
 */
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type { SaasLicense, SaasLicenseStatus, SaasMrrSnapshot, SaasPlan } from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "saas.json");
let tableMissing = false;

const BILLING_STATUSES: SaasLicenseStatus[] = ["trial", "active"];

const DEFAULT_PLANS: Omit<SaasPlan, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Essencial", monthlyCents: 19900, doctorSeats: 1, features: { agenda: true, prontuario: true }, active: true },
  { name: "Clínica", monthlyCents: 49900, doctorSeats: 5, features: { agenda: true, prontuario: true, clinica: true }, active: true },
  { name: "Rede", monthlyCents: 99000, doctorSeats: 20, features: { agenda: true, prontuario: true, clinica: true, pesquisa: true }, active: true },
];

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { plans: SaasPlan[]; licenses: SaasLicense[]; snapshots: SaasMrrSnapshot[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { plans: [], licenses: [], snapshots: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[saas] persistência local indisponível", err);
  }
}

function mapPlan(r: Record<string, unknown>): SaasPlan {
  return {
    id: String(r.id),
    name: String(r.name),
    monthlyCents: Number(r.monthly_cents ?? r.monthlyCents ?? 0),
    doctorSeats: Number(r.doctor_seats ?? r.doctorSeats ?? 1),
    features: (r.features as Record<string, boolean>) || {},
    active: r.active !== false,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapLicense(r: Record<string, unknown>): SaasLicense {
  return {
    id: String(r.id),
    planId: String(r.plan_id ?? r.planId),
    clinicId: (r.clinic_id as string) ?? (r.clinicId as string) ?? null,
    doctorId: (r.doctor_id as string) ?? (r.doctorId as string) ?? null,
    status: ((r.status as SaasLicenseStatus) || "active"),
    periodStart: (r.period_start as string) ?? (r.periodStart as string) ?? null,
    periodEnd: (r.period_end as string) ?? (r.periodEnd as string) ?? null,
    monthlyCents: Number(r.monthly_cents ?? r.monthlyCents ?? 0),
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
    canceledAt: (r.canceled_at as string) ?? (r.canceledAt as string) ?? null,
  };
}

export async function listPlans(includeInactive = false): Promise<SaasPlan[]> {
  let plans: SaasPlan[] = [];
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("saas_plans").select("*").order("monthly_cents");
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      plans = (data || []).map((r) => mapPlan(r as Record<string, unknown>));
    }
  }
  if (!plans.length) plans = (await readLocal()).plans;
  if (!plans.length) plans = await seedDefaultPlans();
  return includeInactive ? plans : plans.filter((p) => p.active);
}

async function seedDefaultPlans(): Promise<SaasPlan[]> {
  const now = new Date().toISOString();
  const created: SaasPlan[] = DEFAULT_PLANS.map((p) => ({
    ...p,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
  }));
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("saas_plans").insert(
      created.map((p) => ({
        id: p.id,
        name: p.name,
        monthly_cents: p.monthlyCents,
        doctor_seats: p.doctorSeats,
        features: p.features,
        active: p.active,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }))
    );
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return created;
  }
  const local = await readLocal();
  if (local.plans.length === 0) {
    local.plans = created;
    await writeLocal(local);
  }
  return (await readLocal()).plans.length ? (await readLocal()).plans : created;
}

export async function createPlan(input: {
  name: string;
  monthlyCents: number;
  doctorSeats: number;
}): Promise<SaasPlan> {
  const name = input.name.trim();
  if (!name) throw new Error("Nome do plano é obrigatório.");
  const monthlyCents = Math.max(0, Math.round(Number(input.monthlyCents) || 0));
  const doctorSeats = Math.max(1, Math.round(Number(input.doctorSeats) || 1));
  const now = new Date().toISOString();
  const row: SaasPlan = {
    id: uuid(),
    name,
    monthlyCents,
    doctorSeats,
    features: {},
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("saas_plans").insert({
      id: row.id,
      name: row.name,
      monthly_cents: row.monthlyCents,
      doctor_seats: row.doctorSeats,
      features: row.features,
      active: true,
      created_at: now,
      updated_at: now,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.plans.push(row);
  await writeLocal(local);
  return row;
}

export async function getPlan(id: string): Promise<SaasPlan | null> {
  const plans = await listPlans(true);
  return plans.find((p) => p.id === id) ?? null;
}

export async function listLicenses(): Promise<SaasLicense[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("saas_licenses").select("*").order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapLicense(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).licenses;
}

export async function getActiveLicenseForClinic(clinicId: string): Promise<SaasLicense | null> {
  const all = await listLicenses();
  return (
    all.find((l) => l.clinicId === clinicId && BILLING_STATUSES.includes(l.status)) ?? null
  );
}

export async function getActiveLicenseForDoctor(doctorId: string): Promise<SaasLicense | null> {
  const all = await listLicenses();
  return (
    all.find((l) => l.doctorId === doctorId && !l.clinicId && BILLING_STATUSES.includes(l.status)) ?? null
  );
}

export async function assignLicense(input: {
  planId: string;
  clinicId?: string;
  doctorId?: string;
  status?: SaasLicenseStatus;
}): Promise<SaasLicense> {
  const clinicId = input.clinicId?.trim() || null;
  const doctorId = input.doctorId?.trim() || null;
  if (!clinicId && !doctorId) throw new Error("Informe a clínica ou o médico solo.");
  if (clinicId && doctorId) throw new Error("Licença é da clínica ou do médico solo — não dos dois.");
  const plan = await getPlan(input.planId);
  if (!plan || !plan.active) throw new Error("Plano inválido.");
  const status: SaasLicenseStatus = input.status === "trial" ? "trial" : "active";

  const existing = clinicId
    ? await getActiveLicenseForClinic(clinicId)
    : await getActiveLicenseForDoctor(doctorId!);
  if (existing) await cancelLicense(existing.id);

  const now = new Date();
  const periodStart = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  const row: SaasLicense = {
    id: uuid(),
    planId: plan.id,
    clinicId,
    doctorId,
    status,
    periodStart,
    periodEnd: end.toISOString().slice(0, 10),
    monthlyCents: plan.monthlyCents,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    canceledAt: null,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("saas_licenses").insert({
      id: row.id,
      plan_id: row.planId,
      clinic_id: row.clinicId,
      doctor_id: row.doctorId,
      status: row.status,
      period_start: row.periodStart,
      period_end: row.periodEnd,
      monthly_cents: row.monthlyCents,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.licenses.unshift(row);
  await writeLocal(local);
  return row;
}

export async function cancelLicense(id: string): Promise<SaasLicense> {
  const now = new Date().toISOString();
  const all = await listLicenses();
  const current = all.find((l) => l.id === id);
  if (!current) throw new Error("Licença não encontrada.");
  const next: SaasLicense = { ...current, status: "canceled", canceledAt: now, updatedAt: now };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from("saas_licenses")
      .update({ status: "canceled", canceled_at: now, updated_at: now })
      .eq("id", id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return next;
  }
  const local = await readLocal();
  local.licenses = local.licenses.map((l) => (l.id === id ? next : l));
  await writeLocal(local);
  return next;
}

export function computeMrr(licenses: SaasLicense[]): { mrrCents: number; licensesActive: number } {
  const live = licenses.filter((l) => BILLING_STATUSES.includes(l.status));
  return {
    mrrCents: live.reduce((sum, l) => sum + (l.monthlyCents || 0), 0),
    licensesActive: live.length,
  };
}

export async function getMrrSummary(): Promise<{
  mrrCents: number;
  arrCents: number;
  licensesActive: number;
  yearMonth: string;
}> {
  const licenses = await listLicenses();
  const { mrrCents, licensesActive } = computeMrr(licenses);
  const yearMonth = new Date().toISOString().slice(0, 7);
  try {
    await saveMrrSnapshot({ yearMonth, mrrCents, licensesActive });
  } catch (err) {
    console.error("[saas] snapshot MRR ignorado", err);
  }
  return { mrrCents, arrCents: mrrCents * 12, licensesActive, yearMonth };
}

async function saveMrrSnapshot(input: { yearMonth: string; mrrCents: number; licensesActive: number }): Promise<void> {
  const row: SaasMrrSnapshot = {
    id: uuid(),
    yearMonth: input.yearMonth,
    mrrCents: input.mrrCents,
    licensesActive: input.licensesActive,
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data } = await sb
      .from("saas_mrr_snapshots")
      .select("id,mrr_cents")
      .eq("year_month", input.yearMonth)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && Number((data as { mrr_cents: number }).mrr_cents) === input.mrrCents) return;
    const { error } = await sb.from("saas_mrr_snapshots").insert({
      id: row.id,
      year_month: row.yearMonth,
      mrr_cents: row.mrrCents,
      licenses_active: row.licensesActive,
      created_at: row.createdAt,
    });
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const last = local.snapshots[0];
  if (last && last.yearMonth === row.yearMonth && last.mrrCents === row.mrrCents) return;
  local.snapshots.unshift(row);
  local.snapshots = local.snapshots.slice(0, 24);
  await writeLocal(local);
}

export async function countSaasRows(): Promise<{ saasPlans: number; saasLicenses: number }> {
  try {
    if (active()) {
      const sb = getSupabaseAdmin()!;
      const [p, l] = await Promise.all([
        sb.from("saas_plans").select("id", { count: "exact", head: true }),
        sb.from("saas_licenses").select("id", { count: "exact", head: true }),
      ]);
      if (isMissing(p.error) || isMissing(l.error)) tableMissing = true;
      else return { saasPlans: p.count ?? 0, saasLicenses: l.count ?? 0 };
    }
    const local = await readLocal();
    return { saasPlans: local.plans.length, saasLicenses: local.licenses.filter((x) => x.status !== "canceled").length };
  } catch {
    return { saasPlans: 0, saasLicenses: 0 };
  }
}
