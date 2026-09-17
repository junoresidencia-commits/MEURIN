import { createHash } from "crypto";

export function makeIdempotencyKey(parts: { documentId?: string | null; doctorId: string; method: string; day?: string }) {
  const day = parts.day || new Date().toISOString().slice(0, 10);
  const raw = `${parts.documentId || "none"}|${parts.doctorId}|${parts.method}|${day}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
