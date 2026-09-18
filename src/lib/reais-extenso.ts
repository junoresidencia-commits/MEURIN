/** Valor em reais por extenso (pt-BR), para recibos. */

const UNITS = ["zero", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest === 0) return parts.join(" e ");
  if (rest < 10) parts.push(UNITS[rest]);
  else if (rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
  }
  return parts.join(" e ");
}

function integerPart(n: number): string {
  if (n === 0) return "zero";
  const million = Math.floor(n / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (million) {
    parts.push(million === 1 ? "um milhao" : `${underThousand(million)} milhoes`);
  }
  if (thousand) {
    parts.push(thousand === 1 ? "mil" : `${underThousand(thousand)} mil`);
  }
  if (rest) parts.push(underThousand(rest));
  return parts.join(" e ");
}

export function reaisPorExtenso(cents: number): string {
  const abs = Math.max(0, Math.round(cents));
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const realWord = reais === 1 ? "real" : "reais";
  const centWord = centavos === 1 ? "centavo" : "centavos";
  if (reais === 0 && centavos === 0) return "zero reais";
  if (reais === 0) return `${integerPart(centavos)} ${centWord}`;
  if (centavos === 0) return `${integerPart(reais)} ${realWord}`;
  return `${integerPart(reais)} ${realWord} e ${integerPart(centavos)} ${centWord}`;
}
