import "server-only";
import type { CohortRecord } from "./research";
import { RESEARCH_VARS_BY_KEY } from "./research-fields";
import { summarize, welchT, mannWhitney, chiSquare, fisher2x2, type TestResult } from "./stats";

/* Comparação entre 2 grupos (determinística): escolhe o teste adequado, verifica
   pressupostos básicos (tipo, n, assimetria) e explica o porquê. */

export interface CompareNumRow {
  key: string; label: string; unit?: string; kind: "num";
  a: { n: number; mean: number; sd: number; median: number; q1: number; q3: number } | null;
  b: { n: number; mean: number; sd: number; median: number; q1: number; q3: number } | null;
  test: TestResult | null;
}
export interface CompareCatRow {
  key: string; label: string; kind: "cat";
  categories: string[];
  a: Record<string, number>;
  b: Record<string, number>;
  test: TestResult | null;
}
export type CompareRow = CompareNumRow | CompareCatRow;

export interface CompareResult {
  groupVar: string;
  groupLabel: string;
  valueA: string;
  valueB: string;
  nA: number;
  nB: number;
  rows: CompareRow[];
}

const r2 = (x: number, d = 2) => { const f = 10 ** d; return Math.round(x * f) / f; };

function eq(rec: CohortRecord, key: string, value: string): boolean {
  return String(rec[key] ?? "").toLowerCase() === value.toLowerCase();
}

export function compareGroups(
  records: CohortRecord[],
  groupVar: string,
  valueA: string,
  valueB: string,
  variables: string[]
): CompareResult {
  const groupLabel = RESEARCH_VARS_BY_KEY.get(groupVar)?.label || groupVar;
  const A = records.filter((r) => eq(r, groupVar, valueA));
  const B = records.filter((r) => eq(r, groupVar, valueB));

  const rows: CompareRow[] = [];
  for (const key of variables) {
    if (key === groupVar) continue;
    const def = RESEARCH_VARS_BY_KEY.get(key);
    if (!def) continue;

    if (def.type === "num") {
      const av = A.map((r) => Number(r[key])).filter(Number.isFinite);
      const bv = B.map((r) => Number(r[key])).filter(Number.isFinite);
      const sa = summarize(av);
      const sb = summarize(bv);
      let test: TestResult | null = null;
      if (sa && sb && sa.n >= 2 && sb.n >= 2) {
        const smallN = sa.n < 15 || sb.n < 15;
        const skewed = Math.abs(sa.skew) > 1 || Math.abs(sb.skew) > 1;
        test = smallN || skewed ? mannWhitney(av, bv) : welchT(av, bv);
      }
      rows.push({
        key, label: def.label, unit: def.unit, kind: "num",
        a: sa ? { n: sa.n, mean: r2(sa.mean), sd: r2(sa.sd), median: r2(sa.median), q1: r2(sa.q1), q3: r2(sa.q3) } : null,
        b: sb ? { n: sb.n, mean: r2(sb.mean), sd: r2(sb.sd), median: r2(sb.median), q1: r2(sb.q1), q3: r2(sb.q3) } : null,
        test,
      });
    } else {
      // categórica: contingência categorias × (A,B), ignorando "desconhecido"
      const cats = new Set<string>();
      const countA: Record<string, number> = {};
      const countB: Record<string, number> = {};
      for (const r of A) { const v = String(r[key] ?? "desconhecido"); if (v !== "desconhecido") { cats.add(v); countA[v] = (countA[v] || 0) + 1; } }
      for (const r of B) { const v = String(r[key] ?? "desconhecido"); if (v !== "desconhecido") { cats.add(v); countB[v] = (countB[v] || 0) + 1; } }
      const categories = Array.from(cats).sort();
      let test: TestResult | null = null;
      if (categories.length >= 2) {
        const matrix = categories.map((c) => [countA[c] || 0, countB[c] || 0]);
        // esperadas mínimas p/ decidir Fisher em 2×2
        if (categories.length === 2) {
          const [[a, b], [c, d]] = matrix;
          const n = a + b + c + d;
          const rowSum = [a + b, c + d];
          const colSum = [a + c, b + d];
          const minExp = n ? Math.min(...rowSum.flatMap((rs) => colSum.map((cs) => (rs * cs) / n))) : 0;
          test = minExp < 5 ? fisher2x2(a, b, c, d) : chiSquare(matrix);
        } else {
          test = chiSquare(matrix);
        }
      }
      rows.push({ key, label: def.label, kind: "cat", categories, a: countA, b: countB, test });
    }
  }

  return { groupVar, groupLabel, valueA, valueB, nA: A.length, nB: B.length, rows };
}
