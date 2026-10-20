import type { AvailabilityPeriod } from "./types";

export function parseAvailabilityPeriods(raw: unknown): AvailabilityPeriod[] {
  if (!Array.isArray(raw)) return [];
  const isTime = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
  return raw
    .map((item): AvailabilityPeriod | null => {
      const p = item as Record<string, unknown>;
      const dow = Number(p.dayOfWeek);
      const modality = p.modality === "presencial" ? "presencial" : "teleconsulta";
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) return null;
      if (!isTime(p.start) || !isTime(p.end)) return null;
      if (modality === "presencial" && !p.locationId) return null;
      return {
        id: p.id ? String(p.id) : crypto.randomUUID(),
        dayOfWeek: dow,
        start: String(p.start),
        end: String(p.end),
        modality,
        locationId: modality === "presencial" ? String(p.locationId) : undefined,
        durationMin: Math.max(5, Math.round(Number(p.durationMin) || 30)),
        intervalMin: Math.max(0, Math.round(Number(p.intervalMin) || 0)),
        priceCents:
          p.priceCents === undefined || p.priceCents === null || p.priceCents === ""
            ? undefined
            : Math.max(0, Math.round(Number(p.priceCents))),
        visitKind: p.visitKind === "consulta" || p.visitKind === "retorno" || p.visitKind === "ambos" ? p.visitKind : "ambos",
      };
    })
    .filter((p): p is AvailabilityPeriod => p !== null);
}

const UF = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);

export function composeFiscalAddress(input: {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null;
}): string | null {
  const street = String(input.street || "").trim();
  const number = String(input.number || "").trim();
  const complement = String(input.complement || "").trim();
  const neighborhood = String(input.neighborhood || "").trim();
  const city = String(input.city || "").trim();
  const state = String(input.state || "").trim().toUpperCase();
  const zip = String(input.zip || "").replace(/\D/g, "");
  const parts = [
    [street, number].filter(Boolean).join(", "),
    complement,
    neighborhood,
    [city, state && UF.has(state) ? state : state].filter(Boolean).join(" - "),
    zip ? `CEP ${zip.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
  ].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  const fallback = String(input.address || "").trim();
  return fallback || null;
}
