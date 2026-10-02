/** Cortesia de consulta — o médico escolhe quem atende de graça. Sem cobrança. */

export const COURTESY_KINDS = ["retorno", "gratis"] as const;
export type CourtesyKind = (typeof COURTESY_KINDS)[number];

export const COURTESY_STATUSES = ["open", "used", "revoked"] as const;
export type CourtesyStatus = (typeof COURTESY_STATUSES)[number];

export const COURTESY_KIND_LABEL: Record<CourtesyKind, string> = {
  retorno: "Retorno grátis",
  gratis: "Consulta grátis",
};

export function isCourtesyKind(v: unknown): v is CourtesyKind {
  return v === "retorno" || v === "gratis";
}

export function courtesyLabel(kind?: CourtesyKind | null): string {
  return kind ? COURTESY_KIND_LABEL[kind] : "Cortesia";
}

export function normalizeCourtesyKey(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function courtesyKeysMatch(
  credit: { patientKey: string; patientEmail?: string | null },
  candidate: string
): boolean {
  const key = normalizeCourtesyKey(candidate);
  if (!key) return false;
  if (normalizeCourtesyKey(credit.patientKey) === key) return true;
  if (normalizeCourtesyKey(credit.patientEmail) === key) return true;
  return false;
}
