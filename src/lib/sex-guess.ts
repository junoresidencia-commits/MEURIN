// Palpite de sexo a partir do primeiro nome (heurística PT-BR). Apenas SUGESTÃO —
// deve ser confirmado por quem cadastra. Retorna null quando não há confiança.
const FEM_EXCEPTIONS = new Set(["luca", "noa"]);
const MASC_EXCEPTIONS = new Set(["josé", "jose", "andré", "andre", "thomé", "tomé", "salomé"]); // terminam em e/é mas são masculinos
const FEM_NAMES = new Set(["isis", "ines", "inês", "lais", "laís", "beatriz", "raquel", "isabel", "cris", "mel", "estér", "ester", "carmen", "miriam", "ruth", "eliz"]);
const MASC_NAMES = new Set(["joao", "joão", "elias", "matias", "tobias", "lucas", "jonas", "dimas", "moises", "moisés", "nicolas", "nicolás"]);

export function guessSexFromName(name?: string | null): "feminino" | "masculino" | null {
  const first = String(name || "").trim().split(/\s+/)[0]?.toLowerCase();
  if (!first || first.length < 2) return null;
  if (FEM_NAMES.has(first)) return "feminino";
  if (MASC_NAMES.has(first)) return "masculino";
  if (MASC_EXCEPTIONS.has(first)) return "masculino";
  if (FEM_EXCEPTIONS.has(first)) return "feminino";
  const last = first[first.length - 1];
  if (last === "a") return "feminino";
  if (last === "o") return "masculino";
  return null;
}
