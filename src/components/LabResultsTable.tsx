"use client";

import { useMemo, useState } from "react";
import { labLabel, labUnit } from "@/lib/labs";

export type LabRow = { id: string; testKey: string; value: number; unit?: string | null; measuredAt: string };

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function fmtVal(n: number) {
  return String(n).replace(".", ",");
}

export function LabResultsTable({
  labs,
  onSelect,
  selectedKey,
}: {
  labs: LabRow[];
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
}) {
  const { keys, dates, grid } = useMemo(() => {
    const dateSet = new Set<string>();
    const keySet = new Set<string>();
    const map = new Map<string, number>();
    for (const l of labs) {
      const day = dayKey(l.measuredAt);
      dateSet.add(day);
      keySet.add(l.testKey);
      map.set(`${l.testKey}|${day}`, l.value);
    }
    const dates = [...dateSet].sort((a, b) => b.localeCompare(a));
    const keys = [...keySet].sort((a, b) => labLabel(a).localeCompare(labLabel(b), "pt-BR"));
    return { keys, dates, grid: map };
  }, [labs]);

  if (keys.length === 0) return <p className="text-[var(--text-muted)]">Nenhum exame registrado ainda.</p>;

  return (
    <div className="overflow-auto rounded-2xl border border-[var(--border)] bg-white">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-[var(--gold-soft)] px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--gold)] shadow-[1px_0_0_var(--border)]">
              Exame
            </th>
            {dates.map((d) => (
              <th key={d} className="sticky top-0 z-10 whitespace-nowrap bg-[var(--gold-soft)] px-3 py-2 text-right text-xs font-bold text-[var(--text)]">
                {dayLabel(d + "T12:00:00")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const unit = labUnit(key);
            const active = selectedKey === key;
            return (
              <tr key={key} className={active ? "bg-[var(--gold-soft)]/60" : "odd:bg-white even:bg-[var(--bg)]"}>
                <th className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-3 py-2 text-left font-semibold text-[var(--text)] shadow-[1px_0_0_var(--border)]">
                  <button type="button" className="text-left" onClick={() => onSelect?.(key)}>
                    {labLabel(key)}
                    {unit ? <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({unit})</span> : null}
                  </button>
                </th>
                {dates.map((d) => {
                  const v = grid.get(`${key}|${d}`);
                  return (
                    <td key={d} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--text)]">
                      {v == null ? <span className="text-[var(--text-muted)]">—</span> : fmtVal(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
        Toque no nome do exame para ver o gráfico da evolução. Traço (—) significa ausência naquela data — o valor anterior não é repetido.
      </p>
    </div>
  );
}

export function LabSparkline({ points }: { points: { x: string; y: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const w = 480;
  const h = 140;
  const p = 22;
  const ys = points.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const n = points.length;
  const xAt = (i: number) => (n === 1 ? w / 2 : p + (i * (w - 2 * p)) / (n - 1));
  const yAt = (v: number) => h - p - ((v - min) / span) * (h - 2 * p);
  const path = points.map((d, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(d.y).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-32 w-full" preserveAspectRatio="none">
        {n > 1 && <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((d, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.y)}
            r={hover === i ? 5 : 3.5}
            fill="white"
            stroke="var(--gold)"
            strokeWidth="2.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        {points.map((s, i) => (
          <span key={i} className={hover === i ? "font-bold text-[var(--text)]" : undefined}>
            {new Date(s.x).toLocaleDateString("pt-BR")}: <b className="text-[var(--text-soft)]">{fmtVal(s.y)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
