"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { RESEARCH_VARS, RESEARCH_VARS_BY_KEY } from "@/lib/research-fields";
import { NEPHRO_LABS, labLabel, labUnit } from "@/lib/labs";

type Row = Record<string, unknown>;
type Series = { code: string; points: { t: string; y: number }[] };
type ChartType = "bar" | "hist" | "scatter" | "box" | "line";

const TEAL = "#0f766e";
const TEAL_SOFT = "#5eead4";
const GRAY = "#64748b";
const AXIS = "#cbd5e1";
const W = 680;
const H = 400;
const PAD = { l: 56, r: 20, t: 40, b: 56 };

const numVars = RESEARCH_VARS.filter((v) => v.type === "num");
const catVars = RESEARCH_VARS.filter((v) => v.type === "cat");

export default function GraficosPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [type, setType] = useState<ChartType>("bar");
  const [catVar, setCatVar] = useState("estagio_g");
  const [xVar, setXVar] = useState("idade");
  const [yVar, setYVar] = useState("lab_tfge");
  const [groupVar, setGroupVar] = useState("dm");
  const [testKey, setTestKey] = useState("tfge");
  const [title, setTitle] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch(`/api/pesquisa/studies/${id}/analysis`).then((r) => r.json()).then((x) => setRows(x.patients || []));
    });
  }, [router, id]);

  useEffect(() => {
    if (type === "line") {
      fetch(`/api/pesquisa/studies/${id}/series?testKey=${testKey}`).then((r) => r.json()).then((x) => setSeries(x.series || []));
    }
  }, [type, testKey, id]);

  const autoTitle = useMemo(() => {
    if (type === "bar") return `Distribuição de ${RESEARCH_VARS_BY_KEY.get(catVar)?.label || catVar}`;
    if (type === "hist") return `Histograma de ${RESEARCH_VARS_BY_KEY.get(xVar)?.label || xVar}`;
    if (type === "scatter") return `${RESEARCH_VARS_BY_KEY.get(yVar)?.label || yVar} × ${RESEARCH_VARS_BY_KEY.get(xVar)?.label || xVar}`;
    if (type === "box") return `${RESEARCH_VARS_BY_KEY.get(yVar)?.label || yVar} por ${RESEARCH_VARS_BY_KEY.get(groupVar)?.label || groupVar}`;
    return `Evolução de ${labLabel(testKey)} ao longo do tempo`;
  }, [type, catVar, xVar, yVar, groupVar, testKey]);

  const shownTitle = title || autoTitle;

  function nums(key: string): number[] {
    return rows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
  }

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `grafico-${type}.png`;
      a.click();
    };
    img.src = svg64;
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href={`/medicos/pesquisa/estudos/${id}`} className="hover:underline">Estudo</Link> › Gráficos</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Gráficos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Gerados a partir dos dados reais do estudo ({rows.length} paciente(s)). Exporte em PNG para o artigo/apresentação.</p>

          <div className="panel mt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              {([["bar", "Distribuição"], ["hist", "Histograma"], ["scatter", "Dispersão"], ["box", "Boxplot por grupo"], ["line", "Evolução (linha)"]] as [ChartType, string][]).map(([t, label]) => (
                <button key={t} type="button" onClick={() => { setType(t); setTitle(""); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${type === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>{label}</button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {type === "bar" && (
                <Sel label="Variável (categórica)" value={catVar} onChange={setCatVar} options={catVars.map((v) => [v.key, v.label])} />
              )}
              {type === "hist" && (
                <Sel label="Variável (numérica)" value={xVar} onChange={setXVar} options={numVars.map((v) => [v.key, v.label])} />
              )}
              {type === "scatter" && (
                <>
                  <Sel label="Eixo X (numérica)" value={xVar} onChange={setXVar} options={numVars.map((v) => [v.key, v.label])} />
                  <Sel label="Eixo Y (numérica)" value={yVar} onChange={setYVar} options={numVars.map((v) => [v.key, v.label])} />
                </>
              )}
              {type === "box" && (
                <>
                  <Sel label="Variável (numérica)" value={yVar} onChange={setYVar} options={numVars.map((v) => [v.key, v.label])} />
                  <Sel label="Grupo (categórica)" value={groupVar} onChange={setGroupVar} options={catVars.map((v) => [v.key, v.label])} />
                </>
              )}
              {type === "line" && (
                <Sel label="Exame" value={testKey} onChange={setTestKey} options={NEPHRO_LABS.map((l) => [l.key, l.label])} />
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Título</span>
                <input className="input-field" value={shownTitle} onChange={(e) => setTitle(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="panel mt-4">
            <div className="w-full overflow-x-auto">
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, background: "#ffffff" }} xmlns="http://www.w3.org/2000/svg">
                <text x={W / 2} y={22} textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">{shownTitle}</text>
                {type === "bar" && <BarChart data={catCounts(rows, catVar)} />}
                {type === "hist" && <Histogram values={nums(xVar)} unit={RESEARCH_VARS_BY_KEY.get(xVar)?.unit} />}
                {type === "scatter" && <Scatter rows={rows} xKey={xVar} yKey={yVar} xLabel={axisLabel(xVar)} yLabel={axisLabel(yVar)} />}
                {type === "box" && <BoxByGroup rows={rows} yKey={yVar} groupKey={groupVar} yLabel={axisLabel(yVar)} />}
                {type === "line" && <LineEvolution series={series} yLabel={labUnit(testKey) || labLabel(testKey)} />}
              </svg>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-gold" onClick={exportPng}>Exportar PNG</button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Gráfico construído apenas com dados reais da coorte. Confira antes de usar em publicação.</p>
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function axisLabel(key: string): string {
  const v = RESEARCH_VARS_BY_KEY.get(key);
  return v ? `${v.label}${v.unit ? ` (${v.unit})` : ""}` : key;
}
function catCounts(rows: Row[], key: string): { label: string; value: number }[] {
  const m: Record<string, number> = {};
  for (const r of rows) { const v = String(r[key] ?? "desconhecido"); m[v] = (m[v] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

/* ---- Sub-gráficos (SVG puro, cores fixas p/ exportar PNG) ---- */

function Axes({ yTicks, yLabel }: { yTicks: { y: number; v: string }[]; yLabel?: string }) {
  return (
    <>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke={AXIS} strokeWidth="1" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={AXIS} strokeWidth="1" />
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l - 4} y1={t.y} x2={PAD.l} y2={t.y} stroke={AXIS} />
          <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill={GRAY}>{t.v}</text>
        </g>
      ))}
      {yLabel && <text x={16} y={H / 2} textAnchor="middle" fontSize="11" fill={GRAY} transform={`rotate(-90 16 ${H / 2})`}>{yLabel}</text>}
    </>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <text x={W / 2} y={H / 2} textAnchor="middle" fill={GRAY}>Sem dados</text>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (W - PAD.l - PAD.r) / data.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: H - PAD.b - f * (H - PAD.t - PAD.b), v: String(Math.round(f * max)) }));
  return (
    <>
      <Axes yTicks={yTicks} yLabel="n" />
      {data.map((d, i) => {
        const h = (d.value / max) * (H - PAD.t - PAD.b);
        const x = PAD.l + i * bw + bw * 0.15;
        const w = bw * 0.7;
        const y = H - PAD.b - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={TEAL} rx="3" />
            <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#0f172a">{d.value}</text>
            <text x={x + w / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill={GRAY}>{d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}</text>
          </g>
        );
      })}
    </>
  );
}

function Histogram({ values, unit }: { values: number[]; unit?: string }) {
  if (values.length === 0) return <text x={W / 2} y={H / 2} textAnchor="middle" fill={GRAY}>Sem dados</text>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(values.length))));
  const width = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) { let idx = Math.floor((v - min) / width); if (idx >= bins) idx = bins - 1; if (idx < 0) idx = 0; counts[idx] += 1; }
  const maxC = Math.max(...counts, 1);
  const bw = (W - PAD.l - PAD.r) / bins;
  const yTicks = [0, 0.5, 1].map((f) => ({ y: H - PAD.b - f * (H - PAD.t - PAD.b), v: String(Math.round(f * maxC)) }));
  return (
    <>
      <Axes yTicks={yTicks} yLabel="n" />
      {counts.map((c, i) => {
        const h = (c / maxC) * (H - PAD.t - PAD.b);
        const x = PAD.l + i * bw + 1;
        const y = H - PAD.b - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw - 2} height={h} fill={TEAL} />
            <text x={x + (bw - 2) / 2} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fill={GRAY}>{(min + i * width).toFixed(1)}</text>
          </g>
        );
      })}
      <text x={(W) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={GRAY}>{unit || "valor"}</text>
    </>
  );
}

function Scatter({ rows, xKey, yKey, xLabel, yLabel }: { rows: Row[]; xKey: string; yKey: string; xLabel: string; yLabel: string }) {
  const pts = rows.map((r) => ({ x: Number(r[xKey]), y: Number(r[yKey]) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return <text x={W / 2} y={H / 2} textAnchor="middle" fill={GRAY}>Sem dados</text>;
  const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (x: number) => PAD.l + ((x - xmin) / (xmax - xmin || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - ymin) / (ymax - ymin || 1)) * (H - PAD.t - PAD.b);
  const yTicks = [0, 0.5, 1].map((f) => ({ y: H - PAD.b - f * (H - PAD.t - PAD.b), v: (ymin + f * (ymax - ymin)).toFixed(1) }));
  return (
    <>
      <Axes yTicks={yTicks} yLabel={yLabel} />
      {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={TEAL} fillOpacity="0.7" />)}
      <text x={(W) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={GRAY}>{xLabel} ({xmin.toFixed(0)}–{xmax.toFixed(0)})</text>
    </>
  );
}

function quartiles(vals: number[]) {
  const s = [...vals].sort((a, b) => a - b);
  const q = (p: number) => { const idx = (s.length - 1) * p; const lo = Math.floor(idx); const hi = Math.ceil(idx); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo); };
  return { min: s[0], q1: q(0.25), med: q(0.5), q3: q(0.75), max: s[s.length - 1] };
}
function BoxByGroup({ rows, yKey, groupKey, yLabel }: { rows: Row[]; yKey: string; groupKey: string; yLabel: string }) {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const g = String(r[groupKey] ?? "desconhecido");
    if (g === "desconhecido") continue;
    const v = Number(r[yKey]);
    if (!Number.isFinite(v)) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(v);
  }
  const entries = Array.from(groups.entries()).filter(([, v]) => v.length > 0);
  if (entries.length === 0) return <text x={W / 2} y={H / 2} textAnchor="middle" fill={GRAY}>Sem dados</text>;
  const allVals = entries.flatMap(([, v]) => v);
  const ymin = Math.min(...allVals); const ymax = Math.max(...allVals);
  const sy = (y: number) => H - PAD.b - ((y - ymin) / (ymax - ymin || 1)) * (H - PAD.t - PAD.b);
  const bw = (W - PAD.l - PAD.r) / entries.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: H - PAD.b - f * (H - PAD.t - PAD.b), v: (ymin + f * (ymax - ymin)).toFixed(1) }));
  return (
    <>
      <Axes yTicks={yTicks} yLabel={yLabel} />
      {entries.map(([g, vals], i) => {
        const q = quartiles(vals);
        const cx = PAD.l + i * bw + bw / 2;
        const bwidth = Math.min(60, bw * 0.5);
        return (
          <g key={g}>
            <line x1={cx} y1={sy(q.min)} x2={cx} y2={sy(q.max)} stroke={GRAY} />
            <rect x={cx - bwidth / 2} y={sy(q.q3)} width={bwidth} height={Math.max(1, sy(q.q1) - sy(q.q3))} fill={TEAL_SOFT} stroke={TEAL} />
            <line x1={cx - bwidth / 2} y1={sy(q.med)} x2={cx + bwidth / 2} y2={sy(q.med)} stroke={TEAL} strokeWidth="2" />
            <text x={cx} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill={GRAY}>{g} (n={vals.length})</text>
          </g>
        );
      })}
    </>
  );
}

function LineEvolution({ series, yLabel }: { series: Series[]; yLabel: string }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <text x={W / 2} y={H / 2} textAnchor="middle" fill={GRAY}>Sem série temporal para este exame</text>;
  const ts = all.map((p) => new Date(p.t).getTime());
  const ys = all.map((p) => p.y);
  const tmin = Math.min(...ts), tmax = Math.max(...ts), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (t: number) => PAD.l + ((t - tmin) / (tmax - tmin || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - ymin) / (ymax - ymin || 1)) * (H - PAD.t - PAD.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: H - PAD.b - f * (H - PAD.t - PAD.b), v: (ymin + f * (ymax - ymin)).toFixed(0) }));
  return (
    <>
      <Axes yTicks={yTicks} yLabel={yLabel} />
      {series.map((s, i) => {
        const pts = s.points.map((p) => ({ x: sx(new Date(p.t).getTime()), y: sy(p.y) }));
        const d = pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        return (
          <g key={i}>
            {pts.length > 1 && <path d={d} fill="none" stroke={TEAL} strokeOpacity="0.35" strokeWidth="1.5" />}
            {pts.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="2.5" fill={TEAL} fillOpacity="0.6" />)}
          </g>
        );
      })}
      <text x={(W) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={GRAY}>tempo (cada linha = 1 paciente)</text>
    </>
  );
}
