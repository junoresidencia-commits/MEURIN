"use client";

// Gráfico de linha simples (SVG) — apresentação apenas. Recebe pontos {x,y} já
// prontos (datas + valores que já existem no sistema). Não busca dados.
export function LabChart({
  points,
  color = "var(--gold)",
  height = 120,
  unit,
}: {
  points: { x: string; y: number }[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const W = 320;
  const H = height;
  const pad = { top: 14, right: 10, bottom: 18, left: 30 };
  const data = points.filter((p) => Number.isFinite(p.y));
  if (data.length < 2) return null;

  const ys = data.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const xAt = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;

  const path = data.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`).join(" ");
  const first = data[0];
  const last = data[data.length - 1];
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  const label = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de evolução">
      {/* linhas de base */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
      <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
      {/* max/min */}
      <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{fmt(max)}</text>
      <text x={pad.left - 4} y={H - pad.bottom} textAnchor="end" fontSize="9" fill="var(--text-muted)">{fmt(min)}</text>
      {/* linha */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((p, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={i === data.length - 1 ? 4 : 2.5} fill={color} />
      ))}
      {/* rótulos extremos */}
      <text x={xAt(0)} y={H - 5} textAnchor="start" fontSize="9" fill="var(--text-muted)">{label(first.x)}</text>
      <text x={xAt(data.length - 1)} y={H - 5} textAnchor="end" fontSize="9" fill="var(--text-muted)">{label(last.x)}</text>
      {/* valor atual */}
      <text x={xAt(data.length - 1)} y={yAt(last.y) - 7} textAnchor="end" fontSize="10" fontWeight="700" fill={color}>
        {fmt(last.y)}{unit ? ` ${unit}` : ""}
      </text>
    </svg>
  );
}
