/** Chaves clínicas usadas no Meu Rim: e-mail, pid:<id> e o id cru. */

function addKey(keys: Set<string>, value?: string | null) {
  const s = String(value || "").trim();
  if (!s) return;
  keys.add(s);
  keys.add(s.toLowerCase());
  const lower = s.toLowerCase();
  if (lower.startsWith("pid:")) {
    const id = s.slice(4);
    if (id) {
      keys.add(id);
      keys.add(id.toLowerCase());
    }
  } else if (!s.includes("@") && /^[0-9a-f-]{36}$/i.test(s)) {
    keys.add(`pid:${s}`);
    keys.add(`pid:${lower}`);
  }
}

export function patientKeyCandidates(
  rawKey: string,
  patient?: { id: string; email?: string | null } | null
): string[] {
  const keys = new Set<string>();
  addKey(keys, rawKey);
  if (patient) {
    addKey(keys, patient.id);
    addKey(keys, `pid:${patient.id}`);
    addKey(keys, patient.email);
  }
  return [...keys];
}

export function patientKeysMatch(candidates: string[], stored?: string | null): boolean {
  if (!stored) return false;
  const set = new Set<string>();
  for (const k of candidates) addKey(set, k);
  const v = String(stored).toLowerCase().trim();
  if (!v) return false;
  if (set.has(v) || set.has(String(stored).trim())) return true;
  if (v.startsWith("pid:") && set.has(v.slice(4))) return true;
  if (!v.includes("@") && set.has(`pid:${v}`)) return true;
  return false;
}
