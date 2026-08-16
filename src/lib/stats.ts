/* ============================================================================
   Estatística inferencial (funções puras, client/server-safe).
   p-valores calculados por aproximações numéricas padrão (Numerical Recipes).
   Nada aqui inventa dados — recebe amostras reais e devolve estatísticas.
   ============================================================================ */

/** ln(Γ(x)) — Lanczos. */
export function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Função gama incompleta regularizada P(a,x) por série. */
function gser(a: number, x: number): number {
  if (x <= 0) return 0;
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 500; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}
/** Q(a,x) por fração contínua. */
function gcf(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
/** P(a,x) regularizada. */
export function gammp(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  return x < a + 1 ? gser(a, x) : 1 - gcf(a, x);
}

/** Beta incompleta regularizada I_x(a,b). */
function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** CDF normal padrão. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** p bicaudal do t de Student. */
export function studentTwoTailP(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return NaN;
  const x = df / (df + t * t);
  return betai(df / 2, 0.5, x);
}
/** p do qui-quadrado (cauda superior). */
export function chiSquarePValue(chi2: number, df: number): number {
  if (df <= 0) return NaN;
  return 1 - gammp(df / 2, chi2 / 2);
}

export interface NumSummary { n: number; mean: number; sd: number; median: number; q1: number; q3: number; min: number; max: number; skew: number }
export function summarize(values: number[]): NumSummary | null {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return null;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const q = (p: number) => { const idx = (n - 1) * p; const lo = Math.floor(idx); const hi = Math.ceil(idx); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo); };
  const skew = sd > 0 && n > 2 ? s.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / n : 0;
  return { n, mean, sd, median: q(0.5), q1: q(0.25), q3: q(0.75), min: s[0], max: s[n - 1], skew };
}

export interface TestResult { test: string; statistic: number; df?: number; p: number; rationale: string }

/** Teste t de Welch (variâncias desiguais) — bicaudal. */
export function welchT(a: number[], b: number[]): TestResult | null {
  const sa = summarize(a);
  const sb = summarize(b);
  if (!sa || !sb || sa.n < 2 || sb.n < 2) return null;
  const va = sa.sd ** 2;
  const vb = sb.sd ** 2;
  const se = Math.sqrt(va / sa.n + vb / sb.n);
  if (se === 0) return null;
  const t = (sa.mean - sb.mean) / se;
  const df = (va / sa.n + vb / sb.n) ** 2 / ((va / sa.n) ** 2 / (sa.n - 1) + (vb / sb.n) ** 2 / (sb.n - 1));
  const p = studentTwoTailP(t, df);
  return { test: "Teste t de Welch", statistic: round(t, 3), df: round(df, 1), p, rationale: "Variável numérica aproximadamente simétrica e n suficiente em ambos os grupos; Welch não assume variâncias iguais." };
}

/** Mann-Whitney U (aprox. normal com correção de empates) — bicaudal. */
export function mannWhitney(a: number[], b: number[]): TestResult | null {
  const A = a.filter(Number.isFinite);
  const B = b.filter(Number.isFinite);
  const na = A.length;
  const nb = B.length;
  if (na < 1 || nb < 1) return null;
  const all = [...A.map((v) => ({ v, g: 0 })), ...B.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  // ranks médios (empates)
  const ranks = new Array(all.length).fill(0);
  let i = 0;
  const tieGroups: number[] = [];
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    tieGroups.push(j - i + 1);
    i = j + 1;
  }
  let rankSumA = 0;
  all.forEach((el, idx) => { if (el.g === 0) rankSumA += ranks[idx]; });
  const U = rankSumA - (na * (na + 1)) / 2;
  const mu = (na * nb) / 2;
  const N = na + nb;
  const tieCorr = tieGroups.reduce((acc, t) => acc + (t ** 3 - t), 0);
  const sigma = Math.sqrt((na * nb / 12) * ((N + 1) - tieCorr / (N * (N - 1))));
  if (sigma === 0) return null;
  const z = (U - mu) / sigma;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { test: "Mann-Whitney U", statistic: round(U, 1), p, rationale: "Variável numérica assimétrica ou amostra pequena; teste não paramétrico, não assume normalidade." };
}

/** Qui-quadrado de independência para tabela de contingência r×c. */
export function chiSquare(matrix: number[][]): TestResult | null {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (rows < 2 || cols < 2) return null;
  const rowSum = matrix.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = new Array(cols).fill(0).map((_, j) => matrix.reduce((a, r) => a + r[j], 0));
  const total = rowSum.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let chi2 = 0;
  let minExpected = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = (rowSum[r] * colSum[c]) / total;
      minExpected = Math.min(minExpected, e);
      if (e > 0) chi2 += (matrix[r][c] - e) ** 2 / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const p = chiSquarePValue(chi2, df);
  return { test: "Qui-quadrado", statistic: round(chi2, 3), df, p, rationale: minExpected >= 5 ? "Tabela de contingência com frequências esperadas ≥ 5." : "Atenção: alguma frequência esperada < 5 — considerar Fisher (2×2)." };
}

/** Fisher exato (2×2) — bicaudal. */
export function fisher2x2(a: number, b: number, c: number, d: number): TestResult | null {
  const n = a + b + c + d;
  if (n === 0) return null;
  const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d;
  const logProb = (x: number) => {
    const yb = r1 - x, yc = c1 - x, yd = r2 - (c1 - x);
    if (x < 0 || yb < 0 || yc < 0 || yd < 0) return -Infinity;
    return lgamma(r1 + 1) + lgamma(r2 + 1) + lgamma(c1 + 1) + lgamma(c2 + 1) - lgamma(n + 1) - lgamma(x + 1) - lgamma(yb + 1) - lgamma(yc + 1) - lgamma(yd + 1);
  };
  const pObs = logProb(a);
  let p = 0;
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  for (let x = lo; x <= hi; x++) {
    const lp = logProb(x);
    if (lp <= pObs + 1e-9) p += Math.exp(lp);
  }
  return { test: "Fisher exato (2×2)", statistic: NaN, p: Math.min(1, p), rationale: "Tabela 2×2 com amostra pequena ou frequências esperadas baixas." };
}

function round(x: number, d: number): number { const f = 10 ** d; return Math.round(x * f) / f; }
