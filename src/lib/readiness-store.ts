import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";

export { parseStagingUrl, PRODUCTION_HOSTS } from "./readiness-url";

export type ReadinessAttestation = {
  stagingUrl: string | null;
  isolationTestedAt: string | null;
  backupRestoreTestedAt: string | null;
  attestedBy: string | null;
  updatedAt: string | null;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "readiness.json");
const ROW_ID = "readiness";
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return Boolean(error.message && /does not exist|could not find the table|schema cache/i.test(error.message));
}

function empty(): ReadinessAttestation {
  return {
    stagingUrl: null,
    isolationTestedAt: null,
    backupRestoreTestedAt: null,
    attestedBy: null,
    updatedAt: null,
  };
}

function normalize(raw: Partial<ReadinessAttestation> | null | undefined): ReadinessAttestation {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  return {
    stagingUrl: raw.stagingUrl ? String(raw.stagingUrl) : null,
    isolationTestedAt: raw.isolationTestedAt ? String(raw.isolationTestedAt) : null,
    backupRestoreTestedAt: raw.backupRestoreTestedAt ? String(raw.backupRestoreTestedAt) : null,
    attestedBy: raw.attestedBy ? String(raw.attestedBy) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

export async function getReadinessAttestation(): Promise<ReadinessAttestation> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("platform_settings").select("data").eq("id", ROW_ID).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return empty();
    } else {
      return normalize(data?.data as Partial<ReadinessAttestation>);
    }
  }
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<ReadinessAttestation>;
    return normalize(raw);
  } catch {
    return empty();
  }
}

export async function saveReadinessAttestation(
  next: ReadinessAttestation,
): Promise<ReadinessAttestation> {
  const payload = normalize({ ...next, updatedAt: new Date().toISOString() });
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from("platform_settings")
      .upsert({ id: ROW_ID, data: payload, updated_at: payload.updatedAt }, { onConflict: "id" });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return payload;
    }
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}
