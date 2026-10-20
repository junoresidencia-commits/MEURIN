"use client";

import { groupSlotsByDayAndPlace, fmtSlotHour, slotDisplayTz, type PatientSlot } from "@/lib/scheduling-client";

export function PatientAgendaSlots({
  slots,
  selectedStart,
  selectedLocationId,
  onSelect,
  emptyText = "Não há horários publicados nos próximos dias.",
  readOnly = false,
}: {
  slots: PatientSlot[];
  selectedStart?: string | null;
  selectedLocationId?: string | null;
  onSelect?: (slot: PatientSlot) => void;
  emptyText?: string;
  readOnly?: boolean;
}) {
  const grouped = groupSlotsByDayAndPlace(slots);
  if (slots.length === 0) {
    return <p className="mt-2 text-sm text-[var(--text-muted)]">{emptyText}</p>;
  }
  return (
    <div className="mt-3 space-y-4">
      {grouped.map((day) => (
        <div key={day.day}>
          <p className="text-sm font-semibold capitalize text-[var(--text)]">{day.day}</p>
          {day.places.map((place) => (
            <div key={place.key} className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{place.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {place.slots.map((s) => {
                  const hour = fmtSlotHour(s.start, slotDisplayTz(s));
                  const selected = selectedStart === s.start && (selectedLocationId || "") === (s.locationId || "");
                  const className = `rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    selected
                      ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]"
                      : "border-[var(--border)]"
                  }`;
                  if (readOnly || !onSelect) {
                    return (
                      <span key={`${s.start}-${s.locationId || s.modality || ""}`} className={className}>
                        {hour}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={`${s.start}-${s.locationId || s.modality || ""}`}
                      type="button"
                      onClick={() => onSelect(s)}
                      className={className}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
