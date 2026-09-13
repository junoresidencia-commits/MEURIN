import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";
import { collectIntegrityCounts, latestIntegritySnapshot } from "./platform-integrity";
import { listAudit, listClinics } from "./platform-store";
import { listClosings } from "./clinic-closing-store";

export type HealthFlag = {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "ok";
};

export type SystemHealth = {
  at: string;
  mode: "supabase" | "demo";
  databaseOnline: boolean;
  sessionSecretSet: boolean;
  cronSecretSet: boolean;
  saasTablesPresent: boolean;
  lastIntegrityAt: string | null;
  lastDeploy: string | null;
  backupRestoreTestedAt: string | null;
  stagingUrl: string | null;
  counts: Awaited<ReturnType<typeof collectIntegrityCounts>>;
  clinics: { total: number; pilot: number; active: number; suspended: number; draft: number };
  unpaidClosings: number;
  flags: HealthFlag[];
};

async function probeSaasTables(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from("saas_plans").select("id", { count: "exact", head: true });
  if (!error) return true;
  return !/does not exist|could not find the table|42P01|PGRST205/i.test(error.message || error.code || "");
}

async function probeDatabase(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return true;
  const { error } = await sb.from("doctors").select("id", { count: "exact", head: true });
  return !error;
}

export async function collectSystemHealth(): Promise<SystemHealth> {
  const [counts, previous, clinics, saasTablesPresent, databaseOnline] = await Promise.all([
    collectIntegrityCounts(),
    latestIntegritySnapshot(),
    listClinics(),
    probeSaasTables(),
    probeDatabase(),
  ]);

  let unpaidClosings = 0;
  for (const clinic of clinics) {
    const rows = await listClosings(clinic.id);
    unpaidClosings += rows.filter((c) => c.status !== "paid").length;
  }

  const sessionSecretSet = Boolean(process.env.SESSION_SECRET);
  const cronSecretSet = Boolean(process.env.CRON_SECRET);
  const backupRestoreTestedAt = process.env.BACKUP_RESTORE_TESTED_AT || null;
  const stagingUrl = process.env.STAGING_URL || process.env.NEXT_PUBLIC_STAGING_URL || null;
  const lastDeploy =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    null;

  const flags: HealthFlag[] = [
    {
      id: "database",
      ok: databaseOnline,
      label: "Banco",
      detail: databaseOnline ? "Online" : "Não foi possível consultar o banco agora.",
      severity: databaseOnline ? "ok" : "critical",
    },
    {
      id: "session",
      ok: sessionSecretSet,
      label: "SESSION_SECRET",
      detail: sessionSecretSet ? "Configurado" : "Ausente — cookies usam o fallback de desenvolvimento.",
      severity: sessionSecretSet ? "ok" : "critical",
    },
    {
      id: "cron",
      ok: cronSecretSet,
      label: "CRON_SECRET",
      detail: cronSecretSet ? "Configurado" : "Ausente — o cron de lembretes aceita qualquer chamada.",
      severity: cronSecretSet ? "ok" : "critical",
    },
    {
      id: "saas",
      ok: saasTablesPresent,
      label: "Tabelas SaaS",
      detail: saasTablesPresent ? "Presentes" : "Ainda não criadas — licenças não persistem na Vercel.",
      severity: saasTablesPresent ? "ok" : "high",
    },
    {
      id: "integrity",
      ok: Boolean(previous),
      label: "Último snapshot de integridade",
      detail: previous ? new Date(previous.createdAt).toLocaleString("pt-BR") : "Nenhum snapshot ainda.",
      severity: previous ? "ok" : "medium",
    },
    {
      id: "backup",
      ok: Boolean(backupRestoreTestedAt),
      label: "Restore de backup testado",
      detail: backupRestoreTestedAt
        ? `Ensaiado em ${backupRestoreTestedAt}`
        : "Ainda não ensaiado. Ver docs/BACKUP.md.",
      severity: backupRestoreTestedAt ? "ok" : "high",
    },
    {
      id: "staging",
      ok: Boolean(stagingUrl),
      label: "Staging",
      detail: stagingUrl || "Nenhuma URL de staging configurada.",
      severity: stagingUrl ? "ok" : "high",
    },
    {
      id: "isolation",
      ok: Boolean(process.env.ISOLATION_TESTED_AT),
      label: "Isolamento testado",
      detail: process.env.ISOLATION_TESTED_AT
        ? `Ensaiado em ${process.env.ISOLATION_TESTED_AT}`
        : "Rodar scripts/test-clinic-isolation.ts no staging (env de produção desligado).",
      severity: process.env.ISOLATION_TESTED_AT ? "ok" : "high",
    },
  ];

  return {
    at: new Date().toISOString(),
    mode: getSupabaseAdmin() ? "supabase" : "demo",
    databaseOnline,
    sessionSecretSet,
    cronSecretSet,
    saasTablesPresent,
    lastIntegrityAt: previous?.createdAt ?? null,
    lastDeploy,
    backupRestoreTestedAt,
    stagingUrl,
    counts,
    clinics: {
      total: clinics.length,
      pilot: clinics.filter((c) => c.status === "pilot").length,
      active: clinics.filter((c) => c.status === "active").length,
      suspended: clinics.filter((c) => c.status === "suspended").length,
      draft: clinics.filter((c) => c.status === "draft").length,
    },
    unpaidClosings,
    flags,
  };
}

export async function collectUsageMetrics() {
  const [counts, audit, clinics] = await Promise.all([
    collectIntegrityCounts(),
    listAudit({ limit: 200 }),
    listClinics(),
  ]);
  const actions = new Map<string, number>();
  for (const e of audit) {
    actions.set(e.action, (actions.get(e.action) || 0) + 1);
  }
  const interesting = [
    "create_closing",
    "pay_closing",
    "clinic_checkin",
    "upsert_fee_rule",
    "create_clinic",
    "adjust_closing",
  ];
  return {
    at: new Date().toISOString(),
    counts,
    clinics: clinics.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    auditActions: interesting.map((action) => ({ action, count: actions.get(action) || 0 })),
    note: "Sem conteúdo clínico. Entrada de médicos no login ainda não é medida (não arrisca o auth).",
  };
}

export function readinessFromHealth(health: SystemHealth) {
  const items = [
    { id: "security", label: "Segurança (secrets)", ok: health.sessionSecretSet && health.cronSecretSet, critical: true },
    { id: "backup", label: "Backup / restore testado", ok: Boolean(health.backupRestoreTestedAt), critical: true },
    { id: "multiclinica", label: "Multi-clínica", ok: health.counts.clinics >= 0, critical: false },
    { id: "isolation", label: "Isolamento (teste automático no repo)", ok: Boolean(process.env.ISOLATION_TESTED_AT), critical: true, detail: "Rodar scripts/test-clinic-isolation.ts no staging e gravar ISOLATION_TESTED_AT." },
    { id: "saas", label: "Tabelas SaaS", ok: health.saasTablesPresent, critical: false },
    { id: "database", label: "Banco online", ok: health.databaseOnline, critical: true },
    { id: "integrity", label: "Integridade (sem queda)", ok: Boolean(health.lastIntegrityAt), critical: false },
    { id: "staging", label: "Staging separado", ok: Boolean(health.stagingUrl), critical: true },
    { id: "audit", label: "Auditoria", ok: true, critical: false },
    { id: "finance", label: "Financeiro / fechamentos", ok: true, critical: false, detail: "Conferência e anti-duplicata no app. Transação SQL completa ainda é próxima etapa." },
  ];
  const blocked = items.filter((i) => i.critical && !i.ok);
  return {
    ready: blocked.length === 0,
    blocked: blocked.map((i) => i.label),
    items,
  };
}
