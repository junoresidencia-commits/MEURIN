/**
 * Helvetica (WinAnsi) não desenha vários unicode comuns em texto médico
 * colado do Word/ChatGPT: ≥ ≤ − → μ ₃ e espaços invisíveis.
 * Sem esta limpeza, pdf-lib lança e a API devolve 500.
 */

const MAP: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u00AB": '"',
  "\u00BB": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2012": "-",
  "\u2015": "-",
  "\u2212": "-",
  "\u2011": "-",
  "\u00AD": "",
  "\u2026": "...",
  "\u00B7": "-",
  "\u2022": "-",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u2260": "!=",
  "\u2248": "~",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u00D7": "x",
  "\u00F7": "/",
  "\u03BC": "u",
  "\u00B5": "u",
  "\u2122": "(TM)",
  "\u00A0": " ",
  "\u202F": " ",
  "\u2007": " ",
  "\u2008": " ",
  "\u2009": " ",
  "\u200A": " ",
  "\u200B": "",
  "\u200C": "",
  "\u200D": "",
  "\u2060": "",
  "\uFEFF": "",
  "\u33A1": "m2",
};

const SUB: Record<string, string> = {
  "\u2070": "0",
  "\u2074": "4", "\u2075": "5", "\u2076": "6", "\u2077": "7",
  "\u2078": "8", "\u2079": "9",
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3",
  "\u2084": "4", "\u2085": "5", "\u2086": "6", "\u2087": "7",
  "\u2088": "8", "\u2089": "9",
};

function mapChar(ch: string): string {
  if (MAP[ch] !== undefined) return MAP[ch];
  if (SUB[ch] !== undefined) return SUB[ch];
  return ch;
}

/** Texto seguro para Helvetica/WinAnsi: acentos PT-BR permanecem; o resto vira ASCII. */
export function winAnsiSafe(text: string): string {
  const mapped = Array.from((text || "").normalize("NFC"), mapChar).join("");
  return mapped
    .replace(/\t/g, "    ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "");
}

export function idadeFromBirthdate(birthdate?: string | null): string {
  if (!birthdate) return "";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? String(a) : "";
}

export function todayBr(): string {
  const d = new Date();
  try {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
  } catch {
    try {
      return d.toLocaleDateString("pt-BR");
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
}
