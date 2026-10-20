/** Client-safe money formatting (no Node-only imports). */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Horários do paciente seguem o fuso publicado pelo profissional (Irecê = Bahia). */
export const PATIENT_DISPLAY_TZ = "America/Bahia";

export function formatSlotLabel(iso: string, timeZone = PATIENT_DISPLAY_TZ): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type PatientSlot = {
  start: string;
  end: string;
  label?: string;
  modality?: "presencial" | "teleconsulta" | string;
  locationId?: string;
  locationName?: string;
  locationCity?: string;
  priceCents?: number;
  visitKind?: string;
  tz?: string;
};

export function slotPlaceLabel(s: PatientSlot): string {
  if (s.modality === "presencial") {
    const name = String(s.locationName || "").trim();
    const city = String(s.locationCity || "").trim();
    if (name && city && !name.toLowerCase().includes(city.toLowerCase())) return `Presencial · ${name} — ${city}`;
    if (name) return `Presencial · ${name}`;
    return "Presencial";
  }
  return "Teleconsulta (online)";
}

export function slotPlaceKey(s: PatientSlot): string {
  if (s.modality === "presencial") return `presencial:${s.locationId || s.locationName || "local"}`;
  return "teleconsulta";
}

export function slotDisplayTz(s?: { tz?: string } | null): string {
  return s?.tz || PATIENT_DISPLAY_TZ;
}

export function fmtSlotDay(iso: string, timeZone = PATIENT_DISPLAY_TZ) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function fmtSlotHour(iso: string, timeZone = PATIENT_DISPLAY_TZ) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type SlotPlaceGroup = { key: string; label: string; slots: PatientSlot[] };
export type SlotDayGroup = { day: string; places: SlotPlaceGroup[] };

export function groupSlotsByDayAndPlace(slots: PatientSlot[]): SlotDayGroup[] {
  const dayMap = new Map<string, Map<string, SlotPlaceGroup>>();
  for (const s of slots) {
    const day = fmtSlotDay(s.start, slotDisplayTz(s));
    if (!dayMap.has(day)) dayMap.set(day, new Map());
    const places = dayMap.get(day)!;
    const key = slotPlaceKey(s);
    if (!places.has(key)) places.set(key, { key, label: slotPlaceLabel(s), slots: [] });
    places.get(key)!.slots.push(s);
  }
  return [...dayMap.entries()].map(([day, places]) => ({
    day,
    places: [...places.values()],
  }));
}
