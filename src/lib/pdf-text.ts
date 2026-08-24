/** Texto seguro para Helvetica / WinAnsi (pdf-lib). */

const WIN1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Mantém só o que a fonte padrão consegue desenhar. */
export function winAnsiSafe(text: string): string {
  return Array.from(text || "")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 9) return "    ";
      if (c === 10 || c === 13) return ch;
      if (c >= 0x20 && c <= 0x7e) return ch;
      if (c >= 0xa0 && c <= 0xff) return ch;
      if (WIN1252_EXTRA.includes(ch)) return ch;
      if (ch === "\u2018" || ch === "\u2019") return "'";
      if (ch === "\u201c" || ch === "\u201d") return '"';
      if (ch === "\u2026") return "...";
      return "?";
    })
    .join("");
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
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
}
