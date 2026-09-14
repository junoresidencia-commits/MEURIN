import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { CEAF_LME_FILE, CEAF_PACOTE } from "@/lib/ceaf-documents";

export function ceafPackCandidates(file: string = CEAF_PACOTE.file) {
  return [
    path.join(process.cwd(), "public", "forms", file),
    path.join(process.cwd(), "forms", file),
  ];
}

export async function readCeafOfficialFile(file: string = CEAF_PACOTE.file): Promise<{ bytes: Buffer; path: string }> {
  const tried: string[] = [];
  for (const candidate of ceafPackCandidates(file)) {
    tried.push(candidate);
    try {
      const bytes = await fs.readFile(candidate);
      return { bytes, path: candidate };
    } catch {
      /* tenta o próximo */
    }
  }
  throw Object.assign(new Error(`Arquivo oficial ausente: ${file}`), { tried });
}

export async function ceafOfficialFileExists(file: string = CEAF_PACOTE.file) {
  for (const candidate of ceafPackCandidates(file)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* next */
    }
  }
  return null;
}

export function ceafLmeCandidates() {
  return ceafPackCandidates(CEAF_LME_FILE);
}
