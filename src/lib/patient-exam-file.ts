/** Teto dos exames do paciente (PDF/foto). O arquivo vai direto ao Storage, sem passar pela Vercel. */
export const EXAM_MAX_BYTES = 50 * 1024 * 1024;
export const EXAM_MAX_LABEL = "50 MB";
/** Acima disso a Vercel recusa o corpo da requisição — só usamos o POST antigo como reserva. */
export const EXAM_PROXY_MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heif",
  "image/gif": "image/gif",
};

const IMAGE_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

export function inspectExamFile(input: {
  name: string;
  type?: string | null;
  size: number;
}): { ok: true; mime: string } | { ok: false; error: string } {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (input.size > EXAM_MAX_BYTES) {
    return { ok: false, error: `Arquivo muito grande (máx. ${EXAM_MAX_LABEL}).` };
  }

  const ext = extOf(input.name || "");
  const type = String(input.type || "").toLowerCase().trim();

  if (type === "application/pdf" || type === "application/x-pdf" || ext === "pdf") {
    return { ok: true, mime: "application/pdf" };
  }
  if (IMAGE_MIME[type]) return { ok: true, mime: IMAGE_MIME[type] };
  if (IMAGE_EXT[ext]) return { ok: true, mime: IMAGE_EXT[ext] };

  return {
    ok: false,
    error: "Formato não permitido (use JPG, PNG, WEBP, HEIC ou PDF).",
  };
}

export function examPathBelongsToPatient(filePath: string, email: string): boolean {
  const prefix = `${email.toLowerCase().trim()}/`;
  if (!filePath.startsWith(prefix)) return false;
  if (filePath.includes("..") || filePath.includes("\\") || filePath.includes("//")) return false;
  const rest = filePath.slice(prefix.length);
  return Boolean(rest) && !rest.includes("/");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
