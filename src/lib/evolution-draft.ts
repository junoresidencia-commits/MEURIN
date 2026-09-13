const PREFIX = "meurim-evolucao-rascunho:";

function key(patientKey: string) {
  return PREFIX + String(patientKey || "").toLowerCase();
}

export type EvolutionDraft = { history: string; savedAt: string };

export function loadEvolutionDraft(patientKey: string): EvolutionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(patientKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EvolutionDraft;
    if (!parsed?.history?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEvolutionDraft(patientKey: string, history: string) {
  if (typeof window === "undefined") return;
  try {
    if (!history.trim()) {
      window.localStorage.removeItem(key(patientKey));
      return;
    }
    const row: EvolutionDraft = { history, savedAt: new Date().toISOString() };
    window.localStorage.setItem(key(patientKey), JSON.stringify(row));
  } catch {
    /* quota / privado */
  }
}

export function clearEvolutionDraft(patientKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(patientKey));
  } catch {
    /* ignore */
  }
}
