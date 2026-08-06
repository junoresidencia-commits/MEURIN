import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";
import type { CompanySettings } from "./company";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");
const ROW_ID = "default";

let tableMissing = false;
function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("platform_settings")
      .select("data")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return (data?.data as CompanySettings) || {};
    }
  }
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as CompanySettings;
  } catch {
    return {};
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ id: ROW_ID, data: settings, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return;
    }
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(settings, null, 2), "utf8");
}
