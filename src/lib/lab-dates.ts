/** Datas civis de exame no fuso do consultório (America/Bahia, UTC−3 o ano todo). */

const TZ = "America/Bahia";

/** Hoje como YYYY-MM-DD em America/Bahia (não UTC — evita virar “amanhã” à noite no Brasil). */
export function todayCivilBahia(): string {
  return civilDateInBahia(new Date());
}

/**
 * Dia civil YYYY-MM-DD em America/Bahia.
 * `YYYY-MM-DD` puro (sem hora) é devolvido como está — é data de coleta, não instante UTC.
 */
export function civilDateInBahia(isoOrDate: string | Date): string {
  if (typeof isoOrDate === "string") {
    const s = isoOrDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    const s = String(isoOrDate ?? "");
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : todayCivilBahia();
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Grava uma data de coleta YYYY-MM-DD como meio-dia em America/Bahia.
 * Evita o bug clássico: `new Date("2026-08-21")` = meia-noite UTC = 20/08 à noite no Brasil.
 */
export function persistLabDate(civilYmd: string): string {
  const m = String(civilYmd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return persistLabDate(todayCivilBahia());
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000-03:00`;
}

/** Aceita YYYY-MM-DD, ISO com fuso, ou vazio → ISO persistível sem pular o dia civil. */
export function normalizeMeasuredAt(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return persistLabDate(todayCivilBahia());
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return persistLabDate(s);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return persistLabDate(todayCivilBahia());
  return d.toISOString();
}

/**
 * Dia usado para colisão (mesmo exame na mesma data).
 * YYYY-MM-DD puro passa direto. Instante ISO usa o dia UTC — com persistLabDate
 * (meio-dia Bahia) isso coincide com o dia civil no Brasil e também com exames
 * antigos gravados como meia-noite UTC.
 */
export function labCollisionDay(iso: string): string {
  const s = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10) || todayCivilBahia();
  return d.toISOString().slice(0, 10);
}
