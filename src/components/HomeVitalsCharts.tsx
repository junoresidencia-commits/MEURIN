"use client";

type Point = { x: string; y: number };

function fmtVal(n: number) {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function shortWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function range(values: number[], extras: number[]) {
  const all = [...values, ...extras].filter((n) => Number.isFinite(n));
  if (!all.length) return { min: 0, max: 1 };
  const minV = Math.min(...all);
  const maxV = Math.max(...all);
  const spread = maxV - minV;
  const magnitude = Math.max(Math.abs(maxV), Math.abs(minV), 1);
  const pad = spread > 0 ? Math.max(spread * 0.22, magnitude * 0.06) : Math.max(magnitude * 0.12, 0.4);
  let min = minV - pad;
  let max = maxV + pad;
  if (minV >= 0 && min < 0) min = 0;
  if (max <= min) max = min + 1;
  return { min, max };
}

function SeriesChart({
  series,
  refs = [],
  unit,
  height = 150,
}: {
  series: { label: string; color: string; points: Point[] }[];
  refs?: { y: number; label: string; color: string }[];
  unit?: string;
  height?: number;
}) {
  const W = 340;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 20, left: 32 };
  const all = series.flatMap((s) => s.points.filter((p) => Number.isFinite(p.y)));
  if (all.length === 0) return null;
  const { min, max } = range(all.map((p) => p.y), refs.map((r) => r.y));
  const span = max - min || 1;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = Math.max(...series.map((s) => s.points.length), 1);
  const xAt = (i: number, len: number) =>
    pad.left + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;
  const first = all[0];
  const last = all[all.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-40 w-full" role="img" aria-label="Gráfico de sinais em casa">
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
      <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
      <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{fmtVal(max)}</text>
      <text x={pad.left - 4} y={H - pad.bottom} textAnchor="end" fontSize="9" fill="var(--text-muted)">{fmtVal(min)}</text>
      {refs.map((r) => (
        <g key={r.label}>
          <line
            x1={pad.left}
            y1={yAt(r.y)}
            x2={W - pad.right}
            y2={yAt(r.y)}
            stroke={r.color}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.55"
          />
          <text x={W - pad.right} y={yAt(r.y) - 3} textAnchor="end" fontSize="8" fill={r.color}>
            {r.label}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const pts = s.points.filter((p) => Number.isFinite(p.y));
        if (!pts.length) return null;
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i, pts.length).toFixed(1)} ${yAt(p.y).toFixed(1)}`).join(" ");
        return (
          <g key={s.label}>
            {pts.length > 1 && (
              <path d={path} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {pts.map((p, i) => (
              <circle key={`${s.label}-${i}`} cx={xAt(i, pts.length)} cy={yAt(p.y)} r={i === pts.length - 1 ? 4 : 2.6} fill={s.color} />
            ))}
          </g>
        );
      })}
      <text x={xAt(0, n)} y={H - 5} textAnchor="start" fontSize="9" fill="var(--text-muted)">{dayLabel(first.x)}</text>
      <text x={xAt(Math.max(n - 1, 0), n)} y={H - 5} textAnchor="end" fontSize="9" fill="var(--text-muted)">{dayLabel(last.x)}</text>
      {unit && (
        <text x={pad.left} y={12} fontSize="9" fill="var(--text-muted)">{unit}</text>
      )}
    </svg>
  );
}

export type HomeVital = {
  kind: "bp" | "glucose" | "weight" | "symptom";
  systolic?: number | null;
  diastolic?: number | null;
  glucoseMgDl?: number | null;
  weightKg?: number | null;
  measuredAt: string;
};

export { SeriesChart };

export function HomeVitalsCharts({ records }: { records: HomeVital[] }) {
  const bp = records
    .filter((r) => r.kind === "bp" && r.systolic != null && r.diastolic != null)
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const glu = records
    .filter((r) => r.kind === "glucose" && r.glucoseMgDl != null)
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const wt = records
    .filter((r) => r.kind === "weight" && r.weightKg != null)
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));

  const lastBp = bp[bp.length - 1];
  const lastGlu = glu[glu.length - 1];
  const lastWt = wt[wt.length - 1];

  if (bp.length === 0 && glu.length === 0 && wt.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">HAS</p>
            <p className="text-xs text-[var(--text-muted)]">Pressão medida em casa</p>
          </div>
          {lastBp && (
            <p className="text-right text-sm font-extrabold text-[var(--text)]">
              {lastBp.systolic}/{lastBp.diastolic} <span className="text-xs font-semibold text-[var(--text-muted)]">mmHg</span>
              <span className="block text-[11px] font-normal text-[var(--text-muted)]">{shortWhen(lastBp.measuredAt)}</span>
            </p>
          )}
        </div>
        {bp.length > 0 ? (
          <SeriesChart
            unit="mmHg"
            series={[
              { label: "Sistólica", color: "#c04b46", points: bp.map((r) => ({ x: r.measuredAt, y: Number(r.systolic) })) },
              { label: "Diastólica", color: "#087b82", points: bp.map((r) => ({ x: r.measuredAt, y: Number(r.diastolic) })) },
            ]}
            refs={[
              { y: 140, label: "140", color: "#c04b46" },
              { y: 90, label: "90", color: "#087b82" },
            ]}
          />
        ) : (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Sem pressão registrada.</p>
        )}
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          <span className="font-semibold text-[#c04b46]">●</span> Sistólica
          {"  "}
          <span className="font-semibold text-[#087b82]">●</span> Diastólica
          {" · "}linha pontilhada = 140/90
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Glicemia</p>
            <p className="text-xs text-[var(--text-muted)]">Medida em casa</p>
          </div>
          {lastGlu && (
            <p className="text-right text-sm font-extrabold text-[var(--text)]">
              {lastGlu.glucoseMgDl} <span className="text-xs font-semibold text-[var(--text-muted)]">mg/dL</span>
              <span className="block text-[11px] font-normal text-[var(--text-muted)]">{shortWhen(lastGlu.measuredAt)}</span>
            </p>
          )}
        </div>
        {glu.length > 0 ? (
          <SeriesChart
            unit="mg/dL"
            series={[
              { label: "Glicemia", color: "#2b7fb0", points: glu.map((r) => ({ x: r.measuredAt, y: Number(r.glucoseMgDl) })) },
            ]}
            refs={[{ y: 180, label: "180", color: "#c04b46" }]}
          />
        ) : (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Sem glicemia registrada.</p>
        )}
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Linha pontilhada = 180 mg/dL</p>
      </div>

      {wt.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-3 md:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Peso</p>
              <p className="text-xs text-[var(--text-muted)]">Medido em casa, ao longo do tempo</p>
            </div>
            {lastWt && (
              <p className="text-right text-sm font-extrabold text-[var(--text)]">
                {fmtVal(Number(lastWt.weightKg))} <span className="text-xs font-semibold text-[var(--text-muted)]">kg</span>
                <span className="block text-[11px] font-normal text-[var(--text-muted)]">{shortWhen(lastWt.measuredAt)}</span>
              </p>
            )}
          </div>
          <SeriesChart
            unit="kg"
            series={[{ label: "Peso", color: "#7758c6", points: wt.map((r) => ({ x: r.measuredAt, y: Number(r.weightKg) })) }]}
          />
          {wt.length === 1 && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Só uma data ainda. O gráfico cresce quando o paciente registrar de novo.</p>
          )}
        </div>
      )}
    </div>
  );
}
