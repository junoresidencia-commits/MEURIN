export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeekMonday(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  x.setDate(x.getDate() - back);
  return x;
}

export type ReportPeriodKey = "hoje" | "semana" | "mes" | "mes_passado" | "ano" | "livre";

export function reportRangeFor(key: ReportPeriodKey, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "hoje") return { from: ymd(today), to: ymd(today) };
  if (key === "semana") return { from: ymd(startOfWeekMonday(today)), to: ymd(today) };
  if (key === "mes") return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  if (key === "mes_passado") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: ymd(first), to: ymd(last) };
  }
  if (key === "ano") return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: ymd(today) };
  return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
}
