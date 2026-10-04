/** Chaves clínicas usadas no Meu Rim: e-mail, pid:<id> e o id cru. */

export function patientKeyCandidates(
  rawKey: string,
  patient?: { id: string; email?: string | null } | null
): string[] {
  const keys = new Set<string>();
  const add = (value?: string | null) => {
    const s = String(value || "").trim();
    if (!s) return;
    keys.add(s);
    keys.add(s.toLowerCase());
  };
  add(rawKey);
  if (rawKey.startsWith("pid:")) add(rawKey.slice(4));
  if (patient) {
    add(patient.id);
    add(`pid:${patient.id}`);
    add(patient.email);
  }
  return [...keys];
}

export function patientKeysMatch(candidates: string[], stored?: string | null): boolean {
  if (!stored) return false;
  const set = new Set(candidates.map((k) => k.toLowerCase().trim()).filter(Boolean));
  return set.has(String(stored).toLowerCase().trim());
}
