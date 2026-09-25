import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { getDoctorByEmail, listDoctors } from "./store";
import { listPatientsByDoctor } from "./patients-store";
import { HD_BUCKET, saveFile } from "./doc-storage";
import { hdPerm, HD_ROLE_DEFAULTS, resolvedPerms } from "./hd-access";
import { DEFAULT_HD_RULES, evaluateHdLabs, worstLevel, type LabMap } from "./hd-rules";
import { calcKtv, calcUrr, parseHours, parseLocaleNumber } from "./hd-calcs";
import { HD_EXAM_LABEL, HD_EXAM_UNIT } from "./hd-labels";
import { buildSalaBrancaWorkbook, parseDateBr, parseLabSpreadsheet, parseSalaBrancaWorkbook } from "./hd-xlsx";
import type {
  HdActor,
  HdAlert,
  HdAuditLog,
  HdExamCode,
  HdLabFile,
  HdLabResult,
  HdLabSource,
  HdMapField,
  HdMapRow,
  HdMember,
  HdMonth,
  HdPatient,
  HdPermKey,
  HdPermMap,
  HdPrescription,
  HdReview,
  HdReviewDecision,
  HdRole,
  HdRule,
  HdSettings,
  HdShift,
  HdUnit,
  HdMachine,
} from "./hd-types";
import { HD_EXAM_CODES, HD_MAP_FIELDS } from "./hd-types";

export { HD_BUCKET } from "./doc-storage";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "hemodialise.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type HdDb = {
  units: HdUnit[];
  members: HdMember[];
  patients: HdPatient[];
  machines: HdMachine[];
  months: HdMonth[];
  mapRows: HdMapRow[];
  labs: HdLabResult[];
  labFiles: HdLabFile[];
  prescriptions: HdPrescription[];
  reviews: HdReview[];
  rules: HdRule[];
  audit: HdAuditLog[];
  settings: HdSettings[];
};

function emptyDb(): HdDb {
  return {
    units: [],
    members: [],
    patients: [],
    machines: [],
    months: [],
    mapRows: [],
    labs: [],
    labFiles: [],
    prescriptions: [],
    reviews: [],
    rules: [],
    audit: [],
    settings: [],
  };
}

function nowIso() {
  return new Date().toISOString();
}

function seedRules(): HdRule[] {
  return DEFAULT_HD_RULES.map((r) => ({ ...r, id: `rule-${r.code}` }));
}

async function readFileDb(): Promise<HdDb> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<HdDb>;
    const db = emptyDb();
    for (const k of Object.keys(db) as (keyof HdDb)[]) {
      const v = parsed[k];
      (db as unknown as Record<string, unknown>)[k] = Array.isArray(v) ? v : [];
    }
    if (db.rules.length === 0) db.rules = seedRules();
    return db;
  } catch {
    const db = emptyDb();
    db.rules = seedRules();
    return db;
  }
}

async function writeFileDb(db: HdDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

const TABLES: Record<keyof HdDb, string> = {
  units: "hd_units",
  members: "hd_members",
  patients: "hd_patients",
  machines: "hd_machines",
  months: "hd_months",
  mapRows: "hd_map_rows",
  labs: "hd_lab_results",
  labFiles: "hd_lab_files",
  prescriptions: "hd_prescriptions",
  reviews: "hd_reviews",
  rules: "hd_rules",
  audit: "hd_audit_logs",
  settings: "hd_settings",
};

function toSnake(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
}

function toCamel<T>(rec: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as T;
}

async function readSb(): Promise<HdDb | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const db = emptyDb();
  for (const key of Object.keys(TABLES) as (keyof HdDb)[]) {
    const { data, error } = await sb.from(TABLES[key]).select("*");
    if (error) {
      if (isMissing(error)) {
        tableMissing = true;
        return null;
      }
      throw error;
    }
    (db as unknown as Record<string, unknown[]>)[key] = (data ?? []).map((r) => toCamel(r as Record<string, unknown>));
  }
  if (db.rules.length === 0) db.rules = seedRules();
  return db;
}

async function writeSb(prev: HdDb, next: HdDb) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  for (const key of Object.keys(TABLES) as (keyof HdDb)[]) {
    if (key === "audit") {
      const had = new Set(prev.audit.map((a) => a.id));
      const added = next.audit.filter((a) => !had.has(a.id)).map((a) => toSnake(a as unknown as Record<string, unknown>));
      if (added.length) {
        const { error } = await sb.from("hd_audit_logs").insert(added);
        if (error) {
          if (isMissing(error)) {
            tableMissing = true;
            return;
          }
          throw error;
        }
      }
      continue;
    }
    const table = TABLES[key];
    const rows = (next[key] as unknown as Record<string, unknown>[]).map((r) => toSnake(r));
    if (rows.length === 0) continue;
    const { error } = await sb.from(table).upsert(rows);
    if (error) {
      if (isMissing(error)) {
        tableMissing = true;
        return;
      }
      throw error;
    }
  }
}

async function load(): Promise<HdDb> {
  if (active()) {
    try {
      const sb = await readSb();
      if (sb) return sb;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (isMissing(e)) tableMissing = true;
      else throw err;
    }
  }
  return readFileDb();
}

async function save(prev: HdDb, next: HdDb) {
  if (active() && !tableMissing) {
    try {
      await writeSb(prev, next);
      if (!tableMissing) return;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (!isMissing(e)) throw err;
      tableMissing = true;
    }
  }
  await writeFileDb(next);
}

async function withDb<T>(fn: (db: HdDb) => T | Promise<T>): Promise<T> {
  const prev = await load();
  const db: HdDb = {
    units: [...prev.units],
    members: [...prev.members],
    patients: [...prev.patients],
    machines: [...prev.machines],
    months: [...prev.months],
    mapRows: [...prev.mapRows],
    labs: [...prev.labs],
    labFiles: [...prev.labFiles],
    prescriptions: [...prev.prescriptions],
    reviews: [...prev.reviews],
    rules: [...prev.rules],
    audit: [...prev.audit],
    settings: [...prev.settings],
  };
  const result = await fn(db);
  await save(prev, db);
  return result;
}

function audit(
  db: HdDb,
  actor: HdActor,
  unitId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
  justification?: string | null,
  protocol?: string | null
) {
  db.audit.push({
    id: uuid(),
    unitId,
    actorId: actor.doctorId,
    actorName: actor.name,
    action,
    entity,
    entityId,
    before: before == null ? null : typeof before === "string" ? before : JSON.stringify(before),
    after: after == null ? null : typeof after === "string" ? after : JSON.stringify(after),
    justification: justification ?? null,
    protocol: protocol ?? null,
    createdAt: nowIso(),
  });
}

export function normName(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function findMember(db: HdDb, actor: HdActor): HdMember | null {
  return (
    db.members.find((m) => m.doctorId === actor.doctorId && m.status === "active") ||
    db.members.find((m) => m.email.toLowerCase() === actor.email.toLowerCase() && m.status === "active") ||
    null
  );
}

export async function ensureHdSession(actor: HdActor) {
  return withDb((db) => {
    const mine = db.members.filter(
      (m) => m.doctorId === actor.doctorId || m.email.toLowerCase() === actor.email.toLowerCase()
    );
    if (
      !actor.isSuperAdmin &&
      mine.some((m) => m.status === "inactive") &&
      !mine.some((m) => m.status === "active" || m.status === "invited") &&
      !db.units.some((u) => u.ownerDoctorId === actor.doctorId)
    ) {
      const blocked = mine.find((m) => m.status === "inactive") || null;
      return {
        unit: blocked ? db.units.find((u) => u.id === blocked.unitId) : undefined,
        member: blocked,
        perms: resolvedPerms(blocked, false),
        allowed: false,
      };
    }
    let member = findMember(db, actor);
    let unit = member ? db.units.find((u) => u.id === member!.unitId) : db.units.find((u) => u.ownerDoctorId === actor.doctorId);
    if (!unit) {
      const t = nowIso();
      unit = {
        id: uuid(),
        ownerDoctorId: actor.doctorId,
        name: "Hemodiálise",
        city: null,
        createdAt: t,
        updatedAt: t,
      };
      db.units.push(unit);
      db.settings.push({
        unitId: unit.id,
        expectedExams: [...HD_EXAM_CODES],
        centerName: "Hemodiálise",
        updatedAt: t,
      });
      if (db.rules.length === 0) db.rules = seedRules();
    }
    if (!member) {
      const t = nowIso();
      member = {
        id: uuid(),
        unitId: unit.id,
        doctorId: actor.doctorId,
        email: actor.email,
        name: actor.name,
        role: actor.doctorId === unit.ownerDoctorId || actor.isSuperAdmin ? "ADMIN" : "MEDICO",
        functionLabel: "Responsável",
        status: "active",
        permissions: {},
        lastAccessAt: t,
        createdAt: t,
        updatedAt: t,
      };
      db.members.push(member);
      audit(db, actor, unit.id, "bootstrap", "member", member.id, null, { email: member.email, role: member.role });
    } else {
      member.lastAccessAt = nowIso();
      if (!member.doctorId) member.doctorId = actor.doctorId;
    }
    const invited = db.members.find(
      (m) => m.status === "invited" && m.email.toLowerCase() === actor.email.toLowerCase()
    );
    if (invited) {
      invited.status = "active";
      invited.doctorId = actor.doctorId;
      invited.lastAccessAt = nowIso();
      invited.updatedAt = nowIso();
      member = invited;
      unit = db.units.find((u) => u.id === invited.unitId) || unit;
    }
    return {
      unit,
      member,
      perms: resolvedPerms(member, actor.isSuperAdmin),
      allowed: actor.isSuperAdmin || member.status === "active",
    };
  });
}

export type HdCtx = {
  actor: HdActor;
  unit: HdUnit;
  member: HdMember;
  perms: Record<HdPermKey, boolean>;
};

export async function requireHd(actor: HdActor, perm?: HdPermKey): Promise<HdCtx | null> {
  const ses = await ensureHdSession(actor);
  if (!ses.allowed || !ses.unit || !ses.member) return null;
  if (perm && !hdPerm(ses.member, perm, actor.isSuperAdmin)) return null;
  return { actor, unit: ses.unit, member: ses.member, perms: ses.perms };
}

function currentYearMonth(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthKey(m: HdMonth) {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

export function getOrCreateMonth(db: HdDb, unitId: string, year: number, month: number): HdMonth {
  let m = db.months.find((x) => x.unitId === unitId && x.year === year && x.month === month);
  if (m) return m;
  m = {
    id: uuid(),
    unitId,
    year,
    month,
    status: "open",
    closedAt: null,
    closedBy: null,
    closedByName: null,
    createdAt: nowIso(),
  };
  db.months.push(m);
  const prev = db.months
    .filter((x) => x.unitId === unitId && (x.year < year || (x.year === year && x.month < month)))
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .at(-1);
  if (prev) {
    const prevRows = db.mapRows.filter((r) => r.monthId === prev.id);
    for (const r of prevRows) {
      db.mapRows.push({ ...r, id: uuid(), monthId: m.id, updatedAt: nowIso() });
    }
    const prevRx = db.prescriptions.filter((p) => p.monthId === prev.id);
    for (const p of prevRx) {
      db.prescriptions.push({ ...p, id: uuid(), monthId: m.id, updatedAt: nowIso() });
    }
  }
  return m;
}

function mapToRx(row: HdMapRow): HdPrescription {
  return {
    id: uuid(),
    unitId: row.unitId,
    monthId: row.monthId,
    patientId: row.patientId,
    epo: row.epo,
    iron: row.iron,
    sevelamer: row.sevelamer,
    calcitriol: row.calcitriol,
    cinacalcet: row.cinacalcet,
    paricalcitol: row.paricalcitol,
    heparin: row.heparin,
    time: row.time,
    capillary: row.capillary,
    access: row.access,
    status: "approved",
    updatedAt: row.updatedAt,
  };
}

function labsFor(db: HdDb, patientId: string, monthId?: string): HdLabResult[] {
  return db.labs
    .filter((l) => l.patientId === patientId && l.status === "confirmed" && (!monthId || l.monthId === monthId))
    .sort((a, b) => (b.collectedAt || b.createdAt).localeCompare(a.collectedAt || a.createdAt));
}

function latestLabs(db: HdDb, patientId: string, monthId?: string): LabMap {
  const map: LabMap = {};
  for (const code of HD_EXAM_CODES) {
    const hit = labsFor(db, patientId, monthId).find((l) => l.examCode === code && l.value != null);
    map[code] = hit?.value ?? null;
  }
  return map;
}

function trendOf(db: HdDb, patientId: string, code: HdExamCode, limit = 12): Array<{ at: string; value: number }> {
  return labsFor(db, patientId)
    .filter((l) => l.examCode === code && l.value != null)
    .slice(0, limit)
    .map((l) => ({ at: l.collectedAt || l.createdAt, value: l.value as number }))
    .reverse();
}

function settingsOf(db: HdDb, unitId: string): HdSettings {
  return (
    db.settings.find((s) => s.unitId === unitId) || {
      unitId,
      expectedExams: [...HD_EXAM_CODES],
      centerName: "Hemodiálise",
      updatedAt: nowIso(),
    }
  );
}

function patientName(db: HdDb, id: string) {
  return db.patients.find((p) => p.id === id)?.name || "Paciente";
}

function mapFieldPerm(field: HdMapField): HdPermKey {
  if (field === "access") return "edit_access";
  if (field === "machine" || field === "ward") return "edit_machine";
  if (field === "shift" || field === "weekdayGroup") return "edit_shift";
  if (field === "time") return "edit_time";
  if (field === "capillary") return "edit_capillary";
  if (field === "heparin") return "edit_heparin";
  if (field === "notes") return "edit_access";
  return "edit_prescription";
}

export async function hdDashboard(ctx: HdCtx, year?: number, month?: number, shift?: HdShift | "ALL", q?: string) {
  return withDb((db) => {
    const ym = year && month ? { year, month } : currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    const set = settingsOf(db, ctx.unit.id);
    let rows = db.mapRows.filter((r) => r.monthId === m.id);
    if (shift && shift !== "ALL") rows = rows.filter((r) => r.shift === shift);
    if (q) {
      const n = normName(q);
      rows = rows.filter((r) => normName(patientName(db, r.patientId)).includes(n) || r.machine.includes(q));
    }
    const reviews = db.reviews.filter((r) => r.monthId === m.id);
    const reviewedIds = new Set(reviews.map((r) => r.patientId));
    const labs = db.labs.filter((l) => l.monthId === m.id);
    const received = labs.length;
    const pendingConfirm = labs.filter((l) => l.status === "pending").length;
    let toReview = 0;
    let pendencies = 0;
    let critical = 0;
    let reviewed = 0;
    const missing: Record<string, number> = {};
    for (const code of set.expectedExams) missing[code] = 0;

    for (const row of rows) {
      const labMap = latestLabs(db, row.patientId, m.id);
      const alerts = evaluateHdLabs(labMap, db.rules);
      const level = worstLevel(alerts);
      if (level === "CRITICO") critical += 1;
      if (reviewedIds.has(row.patientId)) reviewed += 1;
      else if (alerts.length || labs.some((l) => l.patientId === row.patientId)) toReview += 1;
      let miss = false;
      for (const code of set.expectedExams) {
        if (labMap[code] == null) {
          missing[code] += 1;
          miss = true;
        }
      }
      if (miss) pendencies += 1;
    }

    return {
      month: m,
      cards: {
        examesRecebidos: received,
        paraRevisar: toReview,
        pendencias: pendencies + pendingConfirm,
        criticos: critical,
        revisados: reviewed,
        total: rows.length,
      },
      missing,
      unit: ctx.unit,
      perms: ctx.perms,
      member: publicMember(ctx.member),
    };
  });
}

function publicMember(m: HdMember) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    functionLabel: m.functionLabel,
    status: m.status,
    lastAccessAt: m.lastAccessAt,
    permissions: { ...HD_ROLE_DEFAULTS[m.role], ...m.permissions },
  };
}

export async function hdListTeam(ctx: HdCtx) {
  const db = await load();
  return db.members
    .filter((m) => m.unitId === ctx.unit.id)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(publicMember);
}

export async function hdAddMember(
  ctx: HdCtx,
  input: { email: string; name?: string; role: HdRole; functionLabel?: string; permissions?: HdPermMap }
) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.");
  const existing = await getDoctorByEmail(email);
  return withDb((db) => {
    const dup = db.members.find((m) => m.unitId === ctx.unit.id && m.email.toLowerCase() === email);
    if (dup && dup.status === "active") throw new Error("Esta pessoa já está na equipe.");
    const t = nowIso();
    const member: HdMember = dup || {
      id: uuid(),
      unitId: ctx.unit.id,
      doctorId: existing?.id ?? null,
      email,
      name: input.name?.trim() || existing?.name || email,
      role: input.role,
      functionLabel: input.functionLabel?.trim() || HD_ROLE_DEFAULTS[input.role] ? "" : "",
      status: existing ? "active" : "invited",
      permissions: input.permissions || {},
      lastAccessAt: null,
      createdAt: t,
      updatedAt: t,
    };
    if (dup) {
      dup.status = existing ? "active" : "invited";
      dup.role = input.role;
      dup.functionLabel = input.functionLabel?.trim() || dup.functionLabel;
      dup.permissions = input.permissions || dup.permissions;
      dup.doctorId = existing?.id ?? dup.doctorId;
      dup.name = input.name?.trim() || existing?.name || dup.name;
      dup.updatedAt = t;
    } else {
      member.functionLabel = input.functionLabel?.trim() || "";
      db.members.push(member);
    }
    const saved = dup || member;
    audit(db, ctx.actor, ctx.unit.id, dup ? "reactivate_member" : "add_member", "member", saved.id, null, {
      email,
      role: input.role,
      status: saved.status,
    });
    return publicMember(saved);
  });
}

export async function hdUpdateMember(
  ctx: HdCtx,
  memberId: string,
  patch: { role?: HdRole; functionLabel?: string; permissions?: HdPermMap; status?: "active" | "inactive" }
) {
  return withDb((db) => {
    const m = db.members.find((x) => x.id === memberId && x.unitId === ctx.unit.id);
    if (!m) throw new Error("Membro não encontrado.");
    const before = { role: m.role, status: m.status, permissions: m.permissions, functionLabel: m.functionLabel };
    if (patch.role) m.role = patch.role;
    if (patch.functionLabel != null) m.functionLabel = patch.functionLabel;
    if (patch.permissions) m.permissions = { ...m.permissions, ...patch.permissions };
    if (patch.status) m.status = patch.status;
    m.updatedAt = nowIso();
    audit(db, ctx.actor, ctx.unit.id, patch.status === "inactive" ? "deactivate_member" : "update_member", "member", m.id, before, {
      role: m.role,
      status: m.status,
      permissions: m.permissions,
    });
    return publicMember(m);
  });
}

export async function hdSearchDoctors(q: string) {
  const doctors = await listDoctors();
  const n = normName(q);
  return doctors
    .filter((d) => !n || normName(d.name).includes(n) || d.email.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((d) => ({ id: d.id, name: d.name, email: d.email, specialty: d.specialty }));
}

export async function hdListPatients(ctx: HdCtx, shift?: HdShift | "ALL", q?: string, year?: number, month?: number) {
  const db = await load();
  const ym = year && month ? { year, month } : currentYearMonth();
  const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === ym.year && x.month === ym.month);
  const rows = m ? db.mapRows.filter((r) => r.monthId === m.id) : [];
  const byPatient = new Map(rows.map((r) => [r.patientId, r]));
  let list = db.patients.filter((p) => p.unitId === ctx.unit.id && p.active);
  if (q) {
    const n = normName(q);
    list = list.filter((p) => normName(p.name).includes(n));
  }
  if (shift && shift !== "ALL") {
    list = list.filter((p) => byPatient.get(p.id)?.shift === shift);
  }
  return list.map((p) => {
    const row = byPatient.get(p.id);
    const labMap = m ? latestLabs(db, p.id, m.id) : {};
    const alerts = evaluateHdLabs(labMap, db.rules);
    return {
      id: p.id,
      name: p.name,
      patientId: p.patientId,
      shift: row?.shift ?? null,
      ward: row?.ward ?? "",
      machine: row?.machine ?? "",
      access: row?.access ?? "",
      time: row?.time ?? "",
      status: worstLevel(alerts),
      alerts: alerts.length,
    };
  });
}

export async function hdPatientDetail(ctx: HdCtx, patientId: string, year?: number, month?: number) {
  const db = await load();
  const p = db.patients.find((x) => x.id === patientId && x.unitId === ctx.unit.id);
  if (!p) return null;
  const ym = year && month ? { year, month } : currentYearMonth();
  const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === ym.year && x.month === ym.month);
  const row = m ? db.mapRows.find((r) => r.monthId === m.id && r.patientId === p.id) : undefined;
  const labMap = m ? latestLabs(db, p.id, m.id) : {};
  const alerts = evaluateHdLabs(labMap, db.rules);
  const hours = parseHours(row?.time);
  const urr = calcUrr(labMap.urea_pre ?? null, labMap.urea_post ?? null);
  const ktv = calcKtv(labMap.urea_pre ?? null, labMap.urea_post ?? null, hours);
  const trends: Record<string, Array<{ at: string; value: number }>> = {};
  for (const code of HD_EXAM_CODES) trends[code] = trendOf(db, p.id, code);
  const files = db.labFiles.filter((f) => f.unitId === ctx.unit.id).slice(-20);
  const review = m ? db.reviews.filter((r) => r.monthId === m.id && r.patientId === p.id).at(-1) : undefined;
  const hideRx = !ctx.perms.view_exams && ctx.member.role === "LABORATORIO";
  const prescription = hideRx
    ? null
    : row
      ? {
          epo: row.epo,
          iron: row.iron,
          sevelamer: row.sevelamer,
          calcitriol: row.calcitriol,
          cinacalcet: row.cinacalcet,
          paricalcitol: row.paricalcitol,
          heparin: row.heparin,
          time: row.time,
          capillary: row.capillary,
          access: row.access,
        }
      : null;
  return {
    patient: p,
    row: row || null,
    month: m || null,
    labs: labMap,
    labRows: labsFor(db, p.id).slice(0, 80),
    alerts,
    status: worstLevel(alerts),
    urr,
    ktv,
    trends,
    review: review || null,
    prescription,
    suggestion: alerts[0]?.suggestion || "Nenhuma alteração automática. O médico decide.",
    files: ctx.perms.view_exams ? files.filter((f) => db.labs.some((l) => l.fileId === f.id && l.patientId === p.id)) : [],
  };
}

export async function hdListMap(ctx: HdCtx, year?: number, month?: number, shift?: HdShift | "ALL", q?: string) {
  return withDb((db) => {
    const ym = year && month ? { year, month } : currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    let rows = db.mapRows.filter((r) => r.monthId === m.id);
    if (shift && shift !== "ALL") rows = rows.filter((r) => r.shift === shift);
    if (q) {
      const n = normName(q);
      rows = rows.filter((r) => normName(patientName(db, r.patientId)).includes(n) || r.machine.includes(q));
    }
    rows = [...rows].sort((a, b) => a.shift.localeCompare(b.shift) || a.ward.localeCompare(b.ward) || Number(a.machine) - Number(b.machine));
    return {
      month: m,
      rows: rows.map((r) => ({
        ...r,
        patientName: patientName(db, r.patientId),
        status: worstLevel(evaluateHdLabs(latestLabs(db, r.patientId, m.id), db.rules)),
      })),
      closed: m.status === "closed",
    };
  });
}

export async function hdUpdateMapCell(
  ctx: HdCtx,
  rowId: string,
  field: HdMapField,
  value: string,
  justification?: string
) {
  if (!HD_MAP_FIELDS.includes(field)) throw new Error("Campo inválido.");
  const need = mapFieldPerm(field);
  if (!hdPerm(ctx.member, need, ctx.actor.isSuperAdmin)) throw new Error("Sem permissão para editar este campo.");
  return withDb((db) => {
    const row = db.mapRows.find((r) => r.id === rowId && r.unitId === ctx.unit.id);
    if (!row) throw new Error("Linha não encontrada.");
    const month = db.months.find((m) => m.id === row.monthId);
    if (month?.status === "closed" && !justification?.trim()) {
      throw new Error("Mês fechado. Informe a justificativa para alterar.");
    }
    const before = row[field];
    if (field === "shift") {
      if (value !== "MANHA" && value !== "TARDE" && value !== "NOITE") throw new Error("Turno inválido.");
      row.shift = value;
    } else if (field === "weekdayGroup") {
      if (value !== "SEG_QUA_SEX" && value !== "TER_QUI_SAB") throw new Error("Grupo inválido.");
      row.weekdayGroup = value;
    } else {
      (row as unknown as Record<string, string>)[field] = value;
    }
    if (field === "machine") {
      const clash = db.mapRows.find(
        (r) =>
          r.id !== row.id &&
          r.monthId === row.monthId &&
          r.shift === row.shift &&
          r.weekdayGroup === row.weekdayGroup &&
          r.machine === value
      );
      if (clash) {
        const old = before;
        clash.machine = String(old);
        clash.updatedAt = nowIso();
      }
    }
    row.updatedAt = nowIso();
    const rx = db.prescriptions.find((p) => p.monthId === row.monthId && p.patientId === row.patientId);
    if (rx && ["epo", "iron", "sevelamer", "calcitriol", "cinacalcet", "paricalcitol", "heparin", "time", "capillary", "access"].includes(field)) {
      (rx as unknown as Record<string, string>)[field] = value;
      rx.updatedAt = nowIso();
    }
    audit(db, ctx.actor, ctx.unit.id, "edit_map", "map", row.id, { [field]: before }, { [field]: value }, justification || null);
    return { ...row, patientName: patientName(db, row.patientId) };
  });
}

export async function hdImportSalaBranca(ctx: HdCtx, buf: Buffer, fileName: string) {
  const parsed = parseSalaBrancaWorkbook(buf);
  if (parsed.rows.length === 0) throw new Error("Não encontrei pacientes no XLSX. Use o formato Mapa Sala Branca.");
  const ym = parseDateBr(parsed.updatedAt) || currentYearMonth();
  const mine = await listPatientsByDoctor(ctx.actor.doctorId);
  return withDb((db) => {
    const unit = db.units.find((u) => u.id === ctx.unit.id)!;
    if (parsed.unitName) {
      unit.name = parsed.unitName;
      unit.updatedAt = nowIso();
    }
    const set = settingsOf(db, unit.id);
    set.centerName = parsed.unitName || set.centerName;
    if (!db.settings.some((s) => s.unitId === unit.id)) db.settings.push(set);
    const month = getOrCreateMonth(db, unit.id, ym.year, ym.month);
    let linked = 0;
    let created = 0;
    const machines = new Map<string, HdMachine>();

    for (const row of parsed.rows) {
      const n = normName(row.name);
      let p = db.patients.find((x) => x.unitId === unit.id && normName(x.name) === n);
      if (!p) {
        const existing = mine.find((x) => normName(x.name) === n);
        p = {
          id: uuid(),
          unitId: unit.id,
          patientId: existing?.id ?? null,
          name: row.name,
          active: true,
          notes: row.notes,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.patients.push(p);
        created += 1;
        if (existing) linked += 1;
      } else if (!p.patientId) {
        const existing = mine.find((x) => normName(x.name) === n);
        if (existing) {
          p.patientId = existing.id;
          linked += 1;
        }
        if (row.notes) p.notes = row.notes;
      }
      const mk = `${row.ward}|${row.machine}`;
      if (!machines.has(mk) && !db.machines.some((m) => m.unitId === unit.id && m.ward === row.ward && m.number === row.machine)) {
        const mac: HdMachine = { id: uuid(), unitId: unit.id, number: row.machine, ward: row.ward, active: true };
        db.machines.push(mac);
        machines.set(mk, mac);
      }
      let map = db.mapRows.find((r) => r.monthId === month.id && r.patientId === p.id);
      const payload = {
        shift: row.shift,
        weekdayGroup: row.weekdayGroup,
        ward: row.ward,
        machine: row.machine,
        access: row.access,
        heparin: row.heparin,
        time: row.time,
        capillary: row.capillary,
        epo: row.epo,
        iron: row.iron,
        sevelamer: row.sevelamer,
        calcitriol: row.calcitriol,
        cinacalcet: row.cinacalcet,
        paricalcitol: row.paricalcitol,
        notes: row.notes,
        updatedAt: nowIso(),
      };
      if (!map) {
        map = { id: uuid(), unitId: unit.id, monthId: month.id, patientId: p.id, ...payload };
        db.mapRows.push(map);
      } else {
        Object.assign(map, payload);
      }
      const rx = db.prescriptions.find((x) => x.monthId === month.id && x.patientId === p.id);
      const nextRx = mapToRx(map);
      if (rx) Object.assign(rx, { ...nextRx, id: rx.id });
      else db.prescriptions.push(nextRx);
    }

    audit(db, ctx.actor, unit.id, "import_xlsx", "month", month.id, null, {
      fileName,
      rows: parsed.rows.length,
      created,
      linked,
    });
    return {
      unitName: unit.name,
      month,
      imported: parsed.rows.length,
      created,
      linked,
      patients: db.patients.filter((p) => p.unitId === unit.id).length,
    };
  });
}

export async function hdExportXlsx(ctx: HdCtx, year?: number, month?: number) {
  const db = await load();
  const ym = year && month ? { year, month } : currentYearMonth();
  const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === ym.year && x.month === ym.month);
  if (!m) throw new Error("Mês não encontrado.");
  const rows = db.mapRows
    .filter((r) => r.monthId === m.id)
    .map((r) => ({ ...r, patientName: patientName(db, r.patientId) }));
  const set = settingsOf(db, ctx.unit.id);
  return buildSalaBrancaWorkbook({
    unitName: set.centerName || ctx.unit.name,
    updatedLabel: new Date().toLocaleDateString("pt-BR"),
    rows,
  });
}

export function matchExamCode(raw: string): HdExamCode | null {
  const u = normName(raw);
  const table: Array<[RegExp, HdExamCode]> = [
    [/HEMOGLOB/, "hb"],
    [/\bHB\b/, "hb"],
    [/HEMATOCR/, "ht"],
    [/\bHT\b/, "ht"],
    [/FERRIT/, "ferritin"],
    [/TSAT|SATURA/, "tsat"],
    [/FERRO/, "serum_iron"],
    [/CALCIO|CÁLCIO|\bCA\b/, "ca"],
    [/FOSFOR|FÓSFOR|\bP\b/, "p"],
    [/\bPTH\b|PARAT/, "pth"],
    [/POTASS|POTÁSS|\bK\b/, "k"],
    [/ALBUM/, "albumin"],
    [/BICARB|HCO/, "hco3"],
    [/UREIA PRE|UREIA PRÉ|PRE[- ]DIAL/, "urea_pre"],
    [/UREIA POS|UREIA PÓS|POS[- ]DIAL/, "urea_post"],
    [/UREIA/, "urea_pre"],
    [/CREAT/, "creat"],
    [/SODIO|SÓDIO|\bNA\b/, "na"],
  ];
  for (const [re, code] of table) if (re.test(u)) return code;
  return null;
}

export async function hdAddLabs(
  ctx: HdCtx,
  items: Array<{
    patientId?: string;
    name?: string;
    exam: string;
    value: string;
    unit?: string;
    date?: string;
    confidence?: number;
    source?: HdLabSource;
    fileId?: string;
  }>,
  year?: number,
  month?: number
) {
  return withDb((db) => {
    const ym = year && month ? { year, month } : currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    const created: HdLabResult[] = [];
    for (const item of items) {
      const code = matchExamCode(item.exam);
      if (!code) continue;
      let p: HdPatient | undefined;
      if (item.patientId) p = db.patients.find((x) => x.id === item.patientId && x.unitId === ctx.unit.id);
      if (!p && item.name) {
        const n = normName(item.name);
        p = db.patients.find((x) => x.unitId === ctx.unit.id && normName(x.name) === n);
      }
      if (!p) continue;
      const confidence = item.confidence ?? (item.source === "manual" ? 100 : 70);
      const status = confidence >= 90 || item.source === "manual" ? "confirmed" : "pending";
      const lab: HdLabResult = {
        id: uuid(),
        unitId: ctx.unit.id,
        monthId: m.id,
        patientId: p.id,
        examCode: code,
        value: parseLocaleNumber(item.value),
        rawValue: item.value,
        unit: item.unit || HD_EXAM_UNIT[code],
        collectedAt: item.date || null,
        confidence,
        source: item.source || "manual",
        status,
        fileId: item.fileId || null,
        createdBy: ctx.actor.doctorId,
        createdByName: ctx.actor.name,
        createdAt: nowIso(),
        confirmedBy: status === "confirmed" ? ctx.actor.doctorId : null,
        confirmedAt: status === "confirmed" ? nowIso() : null,
      };
      db.labs.push(lab);
      created.push(lab);
    }
    audit(db, ctx.actor, ctx.unit.id, "add_labs", "lab", m.id, null, { count: created.length });
    return { created: created.length, pending: created.filter((l) => l.status === "pending").length, labs: created };
  });
}

export async function hdConfirmLab(ctx: HdCtx, labId: string, value?: string, reject = false) {
  return withDb((db) => {
    const lab = db.labs.find((l) => l.id === labId && l.unitId === ctx.unit.id);
    if (!lab) throw new Error("Exame não encontrado.");
    const before = { value: lab.value, rawValue: lab.rawValue, status: lab.status };
    if (reject) lab.status = "rejected";
    else {
      if (value != null) {
        lab.rawValue = value;
        lab.value = parseLocaleNumber(value);
      }
      lab.status = "confirmed";
      lab.confirmedBy = ctx.actor.doctorId;
      lab.confirmedAt = nowIso();
    }
    audit(db, ctx.actor, ctx.unit.id, reject ? "reject_ocr" : "confirm_ocr", "lab", lab.id, before, {
      value: lab.value,
      status: lab.status,
    });
    return lab;
  });
}

export async function hdSaveLabFile(
  ctx: HdCtx,
  file: { name: string; type: string; buffer: Buffer },
  year?: number,
  month?: number
) {
  const saved = await saveFile(HD_BUCKET, `hd/${ctx.unit.id}`, file);
  return withDb((db) => {
    const ym = year && month ? { year, month } : currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    const rec: HdLabFile = {
      id: uuid(),
      unitId: ctx.unit.id,
      monthId: m.id,
      name: file.name,
      mime: file.type,
      path: saved.path,
      storage: saved.storage,
      uploadedBy: ctx.actor.doctorId,
      uploadedByName: ctx.actor.name,
      createdAt: nowIso(),
    };
    db.labFiles.push(rec);
    audit(db, ctx.actor, ctx.unit.id, "upload_exam", "file", rec.id, null, { name: file.name });
    return rec;
  });
}

export async function hdImportLabSheet(ctx: HdCtx, buf: Buffer, year?: number, month?: number) {
  const rows = parseLabSpreadsheet(buf);
  return hdAddLabs(
    ctx,
    rows.map((r) => ({ name: r.name, exam: r.exam, value: r.value, unit: r.unit, date: r.date, source: "xlsx", confidence: 95 })),
    year,
    month
  );
}

export async function hdListExams(ctx: HdCtx, year?: number, month?: number) {
  const db = await load();
  const ym = year && month ? { year, month } : currentYearMonth();
  const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === ym.year && x.month === ym.month);
  if (!m) return { month: null, labs: [], files: [], pending: [] };
  const labs = db.labs.filter((l) => l.monthId === m.id).map((l) => ({
    ...l,
    patientName: patientName(db, l.patientId),
    examLabel: HD_EXAM_LABEL[l.examCode],
  }));
  return {
    month: m,
    labs,
    pending: labs.filter((l) => l.status === "pending"),
    files: db.labFiles.filter((f) => f.monthId === m.id),
  };
}

export async function hdReviewQueue(ctx: HdCtx, year?: number, month?: number, shift?: HdShift | "ALL") {
  const db = await load();
  const ym = year && month ? { year, month } : currentYearMonth();
  const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === ym.year && x.month === ym.month);
  if (!m) return { month: null, items: [] };
  const reviewed = new Set(db.reviews.filter((r) => r.monthId === m.id).map((r) => r.patientId));
  let rows = db.mapRows.filter((r) => r.monthId === m.id);
  if (shift && shift !== "ALL") rows = rows.filter((r) => r.shift === shift);
  const items = [];
  for (const row of rows) {
    if (reviewed.has(row.patientId)) continue;
    const labMap = latestLabs(db, row.patientId, m.id);
    const alerts = evaluateHdLabs(labMap, db.rules);
    const hasLabs = Object.values(labMap).some((v) => v != null);
    if (!hasLabs && alerts.length === 0) continue;
    items.push({
      patientId: row.patientId,
      patientName: patientName(db, row.patientId),
      shift: row.shift,
      machine: row.machine,
      status: worstLevel(alerts),
      alerts,
      labs: labMap,
      prescription: {
        epo: row.epo,
        iron: row.iron,
        sevelamer: row.sevelamer,
        calcitriol: row.calcitriol,
        cinacalcet: row.cinacalcet,
        paricalcitol: row.paricalcitol,
      },
      suggestion: alerts[0]?.suggestion || "Manter conduta até nova avaliação médica.",
      trends: {
        hb: trendOf(db, row.patientId, "hb"),
        p: trendOf(db, row.patientId, "p"),
        pth: trendOf(db, row.patientId, "pth"),
      },
    });
  }
  items.sort((a, b) => (a.status === "CRITICO" ? -1 : b.status === "CRITICO" ? 1 : 0));
  return { month: m, items, reviewed: reviewed.size, total: rows.length };
}

export async function hdReviewPatient(
  ctx: HdCtx,
  input: {
    patientId: string;
    decision: HdReviewDecision;
    notes?: string;
    year?: number;
    month?: number;
    changes?: Partial<Pick<HdMapRow, "epo" | "iron" | "sevelamer" | "calcitriol" | "cinacalcet" | "paricalcitol" | "heparin" | "time">>;
  }
) {
  return withDb((db) => {
    const ym = input.year && input.month ? { year: input.year, month: input.month } : currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    const row = db.mapRows.find((r) => r.monthId === m.id && r.patientId === input.patientId);
    if (!row) throw new Error("Paciente não está no mapa deste mês.");
    if (m.status === "closed" && !input.notes?.trim()) throw new Error("Mês fechado. Justifique a alteração.");
    const labMap = latestLabs(db, input.patientId, m.id);
    const alerts = evaluateHdLabs(labMap, db.rules);
    const before = { epo: row.epo, iron: row.iron, sevelamer: row.sevelamer };
    if (input.decision === "alterar" && input.changes) {
      if (!hdPerm(ctx.member, "edit_prescription", ctx.actor.isSuperAdmin)) {
        throw new Error("Sem permissão para alterar prescrição.");
      }
      Object.assign(row, input.changes);
      row.updatedAt = nowIso();
    }
    const rec: HdReview = {
      id: uuid(),
      unitId: ctx.unit.id,
      monthId: m.id,
      patientId: input.patientId,
      decision: input.decision,
      situation: alerts.map((a) => a.message).join(" · ") || "Sem alerta do protocolo.",
      suggestion: alerts[0]?.suggestion || "Manter.",
      notes: input.notes || "",
      protocolCodes: alerts.map((a) => a.code),
      reviewedBy: ctx.actor.doctorId,
      reviewedByName: ctx.actor.name,
      reviewedAt: nowIso(),
    };
    db.reviews.push(rec);
    audit(db, ctx.actor, ctx.unit.id, "review", "patient", input.patientId, before, { decision: input.decision, changes: input.changes || null }, input.notes || null, alerts[0]?.code || null);
    return rec;
  });
}

export async function hdCloseMonth(ctx: HdCtx, year: number, month: number) {
  return withDb((db) => {
    const m = db.months.find((x) => x.unitId === ctx.unit.id && x.year === year && x.month === month);
    if (!m) throw new Error("Mês não encontrado.");
    if (m.status === "closed") throw new Error("Este mês já está fechado.");
    m.status = "closed";
    m.closedAt = nowIso();
    m.closedBy = ctx.actor.doctorId;
    m.closedByName = ctx.actor.name;
    audit(db, ctx.actor, ctx.unit.id, "close_month", "month", m.id, { status: "open" }, { status: "closed" });
    return m;
  });
}

export async function hdListHistory(ctx: HdCtx) {
  const db = await load();
  return db.months
    .filter((m) => m.unitId === ctx.unit.id)
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .map((m) => ({
      ...m,
      patients: db.mapRows.filter((r) => r.monthId === m.id).length,
      reviews: db.reviews.filter((r) => r.monthId === m.id).length,
      labs: db.labs.filter((l) => l.monthId === m.id).length,
    }));
}

export async function hdListAudit(ctx: HdCtx) {
  const db = await load();
  return db.audit.filter((a) => a.unitId === ctx.unit.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 400);
}

export async function hdGetSettings(ctx: HdCtx) {
  const db = await load();
  return {
    settings: settingsOf(db, ctx.unit.id),
    rules: db.rules,
    machines: db.machines.filter((m) => m.unitId === ctx.unit.id),
    unit: ctx.unit,
  };
}

export async function hdSaveSettings(
  ctx: HdCtx,
  patch: { centerName?: string; expectedExams?: HdExamCode[]; unitName?: string }
) {
  return withDb((db) => {
    const set = settingsOf(db, ctx.unit.id);
    if (patch.centerName != null) set.centerName = patch.centerName;
    if (patch.expectedExams) set.expectedExams = patch.expectedExams;
    set.updatedAt = nowIso();
    if (!db.settings.some((s) => s.unitId === ctx.unit.id)) db.settings.push(set);
    const unit = db.units.find((u) => u.id === ctx.unit.id);
    if (unit && patch.unitName) {
      unit.name = patch.unitName;
      unit.updatedAt = nowIso();
    }
    audit(db, ctx.actor, ctx.unit.id, "save_settings", "settings", ctx.unit.id, null, patch);
    return set;
  });
}

export async function hdAddPatient(ctx: HdCtx, input: { name: string; patientId?: string | null; notes?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome obrigatório.");
  return withDb((db) => {
    const n = normName(name);
    const exist = db.patients.find((p) => p.unitId === ctx.unit.id && normName(p.name) === n);
    if (exist) return exist;
    const p: HdPatient = {
      id: uuid(),
      unitId: ctx.unit.id,
      patientId: input.patientId ?? null,
      name,
      active: true,
      notes: input.notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.patients.push(p);
    const ym = currentYearMonth();
    const m = getOrCreateMonth(db, ctx.unit.id, ym.year, ym.month);
    db.mapRows.push({
      id: uuid(),
      unitId: ctx.unit.id,
      monthId: m.id,
      patientId: p.id,
      shift: "MANHA",
      weekdayGroup: "SEG_QUA_SEX",
      ward: "ALA 1",
      machine: String(db.mapRows.filter((r) => r.monthId === m.id).length + 1),
      access: "",
      heparin: "",
      time: "4:00 H",
      capillary: "",
      epo: "",
      iron: "",
      sevelamer: "",
      calcitriol: "",
      cinacalcet: "",
      paricalcitol: "",
      notes: "",
      updatedAt: nowIso(),
    });
    audit(db, ctx.actor, ctx.unit.id, "add_patient", "patient", p.id, null, { name, linked: Boolean(input.patientId) });
    return p;
  });
}

export async function hdLinkMeuRimPatients(ctx: HdCtx) {
  const mine = await listPatientsByDoctor(ctx.actor.doctorId);
  return withDb((db) => {
    let linked = 0;
    for (const p of db.patients.filter((x) => x.unitId === ctx.unit.id && !x.patientId)) {
      const hit = mine.find((x) => normName(x.name) === normName(p.name));
      if (hit) {
        p.patientId = hit.id;
        p.updatedAt = nowIso();
        linked += 1;
      }
    }
    if (linked) audit(db, ctx.actor, ctx.unit.id, "link_patients", "patient", ctx.unit.id, null, { linked });
    return { linked };
  });
}

export async function hdMeuRimPatients(ctx: HdCtx) {
  const mine = await listPatientsByDoctor(ctx.actor.doctorId);
  return mine
    .filter((p) => p.status !== "archived")
    .slice(0, 200)
    .map((p) => ({ id: p.id, name: p.name, email: p.email, cpf: p.cpf }));
}

export async function hdListMonths(ctx: HdCtx) {
  const db = await load();
  return db.months.filter((m) => m.unitId === ctx.unit.id).sort((a, b) => b.year - a.year || b.month - a.month);
}

export async function hdPeekMenu(actor: HdActor) {
  const db = await load();
  const mine = db.members.filter(
    (m) => m.doctorId === actor.doctorId || m.email.toLowerCase() === actor.email.toLowerCase()
  );
  if (actor.isSuperAdmin) return { allowed: true as const, bootstrapped: mine.some((m) => m.status === "active") };
  if (mine.some((m) => m.status === "active" || m.status === "invited")) return { allowed: true as const, bootstrapped: true };
  if (mine.some((m) => m.status === "inactive")) return { allowed: false as const, bootstrapped: true };
  return { allowed: true as const, bootstrapped: false };
}

export function canSeeHdMenu(allowed: boolean) {
  return allowed;
}

/**
 * Pacientes do Meu Rim já vinculados à Hemodiálise deste médico.
 * Somente leitura — não cria unidade, não altera o mapa, não recria cadastro.
 */
export async function listHdLinkedPatientIds(doctorId: string): Promise<Set<string>> {
  const db = await load();
  const unitIds = new Set(
    [
      ...db.units.filter((u) => u.ownerDoctorId === doctorId).map((u) => u.id),
      ...db.members.filter((m) => m.doctorId === doctorId && m.status === "active").map((m) => m.unitId),
    ]
  );
  const ids = new Set<string>();
  for (const p of db.patients) {
    if (!p.active || !p.patientId || !unitIds.has(p.unitId)) continue;
    ids.add(p.patientId);
  }
  return ids;
}

export type { HdAlert };
