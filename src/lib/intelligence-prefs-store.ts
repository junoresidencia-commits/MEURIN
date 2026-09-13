import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { listMembershipsForActor } from "./platform-store";
import {
  DEFAULT_INTEL_PREFS,
  DEFAULT_INTEL_MODULES,
  mergeIntelPrefs,
  type IntelligenceModules,
  type IntelligencePrefs,
} from "./intelligence-prefs";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "intelligence-prefs.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type Stored = {
  id: string;
  scope: "doctor" | "clinic";
  scopeId: string;
  enabled: boolean;
  applyMode: "review_only";
  modules: IntelligenceModules;
  allowBackfill: boolean;
  updatedAt: string;
};

type LocalDb = { rows: Stored[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { rows: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[intelligence-prefs] persistência local indisponível", err);
  }
}

function mapRow(r: Record<string, unknown>): Stored {
  const modules = { ...DEFAULT_INTEL_MODULES, ...((r.modules as IntelligenceModules) || {}) };
  return {
    id: String(r.id),
    scope: String(r.scope) as Stored["scope"],
    scopeId: String(r.scope_id ?? r.scopeId),
    enabled: r.enabled !== false,
    applyMode: "review_only",
    modules,
    allowBackfill: r.allow_backfill !== false && r.allowBackfill !== false,
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}

function toPrefs(row: Stored | null, source: IntelligencePrefs["source"]): IntelligencePrefs {
  if (!row) return { ...DEFAULT_INTEL_PREFS, modules: { ...DEFAULT_INTEL_MODULES }, source };
  return {
    enabled: row.enabled,
    applyMode: "review_only",
    modules: { ...DEFAULT_INTEL_MODULES, ...row.modules },
    allowBackfill: row.allowBackfill,
    source,
  };
}

export async function getStoredPrefs(scope: "doctor" | "clinic", scopeId: string): Promise<Stored | null> {
  if (!scopeId) return null;
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("intelligence_preferences")
      .select("*")
      .eq("scope", scope)
      .eq("scope_id", scopeId)
      .maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapRow(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).rows.find((r) => r.scope === scope && r.scopeId === scopeId) ?? null;
}

export async function upsertPrefs(input: {
  scope: "doctor" | "clinic";
  scopeId: string;
  enabled?: boolean;
  modules?: Partial<IntelligenceModules>;
  allowBackfill?: boolean;
}): Promise<IntelligencePrefs> {
  const current = await getStoredPrefs(input.scope, input.scopeId);
  const now = new Date().toISOString();
  const row: Stored = {
    id: current?.id || uuid(),
    scope: input.scope,
    scopeId: input.scopeId,
    enabled: input.enabled ?? current?.enabled ?? true,
    applyMode: "review_only",
    modules: { ...DEFAULT_INTEL_MODULES, ...(current?.modules || {}), ...(input.modules || {}) },
    allowBackfill: input.allowBackfill ?? current?.allowBackfill ?? true,
    updatedAt: now,
  };

  if (active()) {
    const sb = getSupabaseAdmin()!;
    const payload = {
      id: row.id,
      scope: row.scope,
      scope_id: row.scopeId,
      enabled: row.enabled,
      apply_mode: "review_only",
      modules: row.modules,
      allow_backfill: row.allowBackfill,
      updated_at: now,
    };
    const { error } = current
      ? await sb.from("intelligence_preferences").update(payload).eq("id", row.id)
      : await sb.from("intelligence_preferences").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return toPrefs(row, input.scope);
  }

  const local = await readLocal();
  const idx = local.rows.findIndex((r) => r.scope === row.scope && r.scopeId === row.scopeId);
  if (idx >= 0) local.rows[idx] = row;
  else local.rows.push(row);
  await writeLocal(local);
  return toPrefs(row, input.scope);
}

/** Clínica (se o médico tiver exatamente uma com config) + override do médico. Sempre review_only. */
export async function getEffectivePrefs(doctorId: string): Promise<IntelligencePrefs> {
  try {
    const doctorRow = doctorId ? await getStoredPrefs("doctor", doctorId) : null;
    let clinicPrefs: IntelligencePrefs | null = null;
    if (doctorId) {
      const memberships = await listMembershipsForActor("doctor", doctorId);
      const clinicIds = [...new Set(memberships.map((m) => m.clinicId))];
      const found: IntelligencePrefs[] = [];
      for (const id of clinicIds) {
        const row = await getStoredPrefs("clinic", id);
        if (row) found.push(toPrefs(row, "clinic"));
      }
      if (found.length === 1) clinicPrefs = found[0];
    }
    const withClinic = mergeIntelPrefs(DEFAULT_INTEL_PREFS, clinicPrefs, clinicPrefs ? "clinic" : "default");
    return mergeIntelPrefs(withClinic, doctorRow ? toPrefs(doctorRow, "doctor") : null, doctorRow ? "doctor" : withClinic.source);
  } catch (err) {
    console.error("[intelligence-prefs] efetiva ignorada", err);
    return { ...DEFAULT_INTEL_PREFS, modules: { ...DEFAULT_INTEL_MODULES } };
  }
}
