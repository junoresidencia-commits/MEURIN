/** OCR de laudo troca letra por dígito (MAR1A, Hemoglob1na). Só mexe em 0/1 no meio de letras. */
export function softenOcrText(s: string): string {
  return String(s || "")
    .replace(/(?<=\p{L})0(?=\p{L})/gu, "O")
    .replace(/(?<=\p{L})1(?=\p{L})/gu, "I");
}

export function extractLabeledPatientName(text: string): string | null {
  const raw = softenOcrText(text);
  const re =
    /(?:nome\s+do\s+paciente|paciente|nome\s+completo|nome)[: .\-–—]+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'’-]{4,80})/i;
  const m = raw.match(re);
  if (!m) return null;
  const name = m[1]
    .replace(/\s+/g, " ")
    .replace(/\s+(cpf|rg|dn|nasc|sexo|idade|coleta|data|creatinina|hemoglobina|ureia|potassio|fosforo|exame)\b.*/i, "")
    .trim();
  const parts = name.split(" ").filter((p) => p.length > 1);
  if (parts.length < 2) return null;
  return parts.slice(0, 6).join(" ");
}
