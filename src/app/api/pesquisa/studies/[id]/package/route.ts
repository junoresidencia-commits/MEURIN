import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { buildCohortRecords, applyFilters } from "@/lib/research";
import { completeness, describeVars, resultsText, cohortSeries, type TableRow } from "@/lib/research-analysis";
import { RESEARCH_VARS_BY_KEY, type Operator } from "@/lib/research-fields";
import { STUDY_TYPE_LABEL, STUDY_STATUS_LABEL } from "@/app/medicos/pesquisa/studyMeta";
import { createZip, type ZipFile } from "@/lib/zip";

const DEFAULT_VARS = ["idade", "sexo", "drc", "estagio_g", "categoria_a", "has", "dm", "lab_creatinina", "lab_tfge", "lab_rac"];
const BOM = "\ufeff";
const csv = (rows: (string | number)[][]) => BOM + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
const num = (x: number) => String(x).replace(".", ",");
const opLabel = (o: Operator) => (o === "!=" ? "≠" : o === "entre" ? "entre" : o);

function methodologyFor(key: string): string {
  if (key === "idade") return "Calculada a partir da data de nascimento.";
  if (key === "sexo") return "Informado no cadastro do paciente.";
  if (key === "cidade") return "Informado no cadastro do paciente.";
  if (key === "imc") return "Calculado (peso / altura²).";
  if (key === "lab_tfge") return "TFGe estimada pela equação CKD-EPI 2021 (creatinina, idade, sexo). Último valor do histórico.";
  if (key === "lab_tfge_cistatina") return "TFGe estimada pela equação CKD-EPI Cistatina C 2021. Último valor do histórico.";
  if (key.startsWith("lab_")) return "Último valor registrado no histórico laboratorial.";
  return "Dado estruturado do perfil clínico (informado/extraído/confirmado pelo médico).";
}

function tableRowText(r: TableRow, n: number): string {
  if (r.type === "num") {
    if (!r.num) return "sem dados";
    const u = r.unit ? ` ${r.unit}` : "";
    return `${num(r.num.mean)} ± ${num(r.num.sd)}${u} (mediana ${num(r.num.median)} [${num(r.num.q1)}–${num(r.num.q3)}]; n=${r.num.n})`;
  }
  return Object.entries(r.cat)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v} (${n ? num(Math.round((v / n) * 1000) / 10) : 0}%)`)
    .join("; ");
}

/* ---- Gráficos SVG (vetor, alta qualidade) ---- */
const W = 680, H = 400, PADL = 56, PADR = 20, PADT = 40, PADB = 56;
function barSvg(title: string, data: { label: string; value: number }[]): string {
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (W - PADL - PADR) / Math.max(1, data.length);
  const bars = data.map((d, i) => {
    const h = (d.value / max) * (H - PADT - PADB);
    const x = PADL + i * bw + bw * 0.15;
    const y = H - PADB - h;
    const w = bw * 0.7;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#0f766e"/><text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="#0f172a">${d.value}</text><text x="${(x + w / 2).toFixed(1)}" y="${(H - PADB + 16)}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(d.label).slice(0, 12)}</text>`;
  }).join("");
  return svgWrap(title, `<line x1="${PADL}" y1="${PADT}" x2="${PADL}" y2="${H - PADB}" stroke="#cbd5e1"/><line x1="${PADL}" y1="${H - PADB}" x2="${W - PADR}" y2="${H - PADB}" stroke="#cbd5e1"/>${bars}`);
}
function lineSvg(title: string, series: { code: string; points: { t: string; y: number }[] }[], yLabel: string): string {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return svgWrap(title, `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#64748b">Sem série</text>`);
  const ts = all.map((p) => new Date(p.t).getTime());
  const ys = all.map((p) => p.y);
  const tmin = Math.min(...ts), tmax = Math.max(...ts), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (t: number) => PADL + ((t - tmin) / (tmax - tmin || 1)) * (W - PADL - PADR);
  const sy = (y: number) => H - PADB - ((y - ymin) / (ymax - ymin || 1)) * (H - PADT - PADB);
  const paths = series.map((s) => {
    const pts = s.points.map((p) => `${sx(new Date(p.t).getTime()).toFixed(1)} ${sy(p.y).toFixed(1)}`);
    const d = pts.map((p, j) => `${j ? "L" : "M"}${p}`).join(" ");
    const circles = s.points.map((p) => `<circle cx="${sx(new Date(p.t).getTime()).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2.5" fill="#0f766e" fill-opacity="0.6"/>`).join("");
    return `${pts.length > 1 ? `<path d="${d}" fill="none" stroke="#0f766e" stroke-opacity="0.35" stroke-width="1.5"/>` : ""}${circles}`;
  }).join("");
  return svgWrap(title, `<line x1="${PADL}" y1="${PADT}" x2="${PADL}" y2="${H - PADB}" stroke="#cbd5e1"/><line x1="${PADL}" y1="${H - PADB}" x2="${W - PADR}" y2="${H - PADB}" stroke="#cbd5e1"/><text x="16" y="${H / 2}" text-anchor="middle" font-size="11" fill="#64748b" transform="rotate(-90 16 ${H / 2})">${escapeXml(yLabel)}</text>${paths}`);
}
function svgWrap(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/><text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>${body}</svg>`;
}
function escapeXml(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });

  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, study.filters);
  const variables = study.variables.length ? study.variables : DEFAULT_VARS;
  const table1 = describeVars(matched, variables);
  const quality = completeness(matched, variables);
  const results = resultsText(study.question, matched.length, all.length, table1);

  // Banco anonimizado
  const cols = ["codigo", ...variables];
  const header = cols.map((c) => (c === "codigo" ? "Código" : RESEARCH_VARS_BY_KEY.get(c)?.label || c));
  const bankRows: (string | number)[][] = [header];
  matched.forEach((r, i) => {
    const code = `P${String(i + 1).padStart(4, "0")}`;
    bankRows.push(cols.map((c) => {
      if (c === "codigo") return code;
      const def = RESEARCH_VARS_BY_KEY.get(c);
      const raw = r[c];
      return raw === null || raw === undefined ? (def?.type === "num" ? "" : "desconhecido") : (raw as string | number);
    }));
  });

  // Dicionário
  const dictRows: (string | number)[][] = [["Chave", "Variável", "Tipo", "Unidade", "Origem"]];
  for (const c of variables) {
    const def = RESEARCH_VARS_BY_KEY.get(c);
    dictRows.push([c, def?.label || c, def?.type || "", def?.unit || "", def?.source || ""]);
  }

  // Estatística / Tabela 1
  const tableRows: (string | number)[][] = [["Variável", "Resultado"]];
  tableRows.push(["Pacientes", matched.length]);
  for (const r of table1) tableRows.push([`${r.label}${r.type === "num" && r.unit ? ` (${r.unit})` : ""}`, tableRowText(r, matched.length)]);

  // Qualidade / dados faltantes
  const qualRows: (string | number)[][] = [["Variável", "Disponível", "Total", "%"]];
  for (const q of quality) qualRows.push([q.label, q.available, q.total, num(q.pct)]);

  // Metodologia
  const methodology = [
    "METODOLOGIA DOS DADOS",
    "",
    "Como cada variável do banco foi obtida:",
    ...variables.map((c) => `- ${RESEARCH_VARS_BY_KEY.get(c)?.label || c}: ${methodologyFor(c)}`),
    "",
    "Observações:",
    "- Campo vazio = desconhecido (não assumir 'não').",
    "- Valores laboratoriais correspondem ao ÚLTIMO valor do histórico, salvo os arquivos de dados longitudinais.",
  ].join("\n");

  // Resumo do estudo
  const criteria = study.filters.length
    ? study.filters.map((f) => `${RESEARCH_VARS_BY_KEY.get(f.field)?.label || f.field} ${opLabel(f.op)} ${f.value}${f.op === "entre" ? ` e ${f.value2 ?? ""}` : ""}`).join("; ")
    : "Sem filtros (todos os pacientes).";
  const resumo = [
    "RESUMO DO ESTUDO",
    "",
    `Título: ${study.title || "—"}`,
    `Objetivo/pergunta: ${study.question || "—"}`,
    `Desenho: ${STUDY_TYPE_LABEL[study.type] || study.type}`,
    `Status: ${STUDY_STATUS_LABEL[study.status] || study.status}`,
    `Criado em: ${new Date(study.createdAt).toLocaleDateString("pt-BR")}`,
    `Número de pacientes incluídos: ${matched.length} (de ${all.length} no banco)`,
    `Critérios de inclusão: ${criteria}`,
    `Variáveis: ${variables.map((c) => RESEARCH_VARS_BY_KEY.get(c)?.label || c).join(", ")}`,
    "",
    "RESULTADOS (a partir dos dados reais):",
    results,
  ].join("\n");

  // Fluxograma
  const fluxograma = [
    "FLUXOGRAMA DOS PACIENTES",
    "",
    `Pacientes avaliados: ${all.length}`,
    "        |",
    `Excluídos (não atenderam aos critérios): ${all.length - matched.length}`,
    "        |",
    `Incluídos na análise: ${matched.length}`,
  ].join("\n");

  // Dados longitudinais (labs relevantes)
  const labKeys = new Set<string>(["creatinina", "tfge", "rac"]);
  for (const v of variables) if (v.startsWith("lab_")) labKeys.add(v.slice(4));
  const longRows: (string | number)[][] = [["Código", "Exame", "Data", "Valor"]];
  const seriesByKey: Record<string, { code: string; points: { t: string; y: number }[] }[]> = {};
  for (const key of labKeys) {
    const series = await cohortSeries(doctorId, study.filters, key);
    seriesByKey[key] = series;
    for (const s of series) for (const p of s.points) longRows.push([s.code, RESEARCH_VARS_BY_KEY.get(`lab_${key}`)?.label || key, p.t, num(p.y)]);
  }

  // Gráficos SVG
  const firstCat = table1.find((r) => r.type !== "num") as Extract<TableRow, { type: "cat" | "text" }> | undefined;
  const barData = firstCat ? Object.entries(firstCat.cat).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })) : [];
  const tfgeSeries = seriesByKey["tfge"] || [];

  const files: ZipFile[] = [
    { name: "README.txt", data: `PACOTE DE PRODUÇÃO CIENTÍFICA — MEU RIM\nEstudo: ${study.title}\nGerado em: ${new Date().toLocaleString("pt-BR")}\n\nConteúdo:\n- resumo_do_estudo.txt\n- banco_anonimizado.csv\n- estatistica_tabela1.csv\n- qualidade_do_banco.csv\n- dicionario_variaveis.csv\n- metodologia.txt\n- fluxograma.txt\n- dados_longitudinais.csv\n- graficos/*.svg\n\nPrivacidade: banco anonimizado (P0001…), sem nome/CPF/CNS/telefone/e-mail/endereço.\nA produção textual (artigo/abstract/revisão) é feita externamente.` },
    { name: "resumo_do_estudo.txt", data: resumo },
    { name: "banco_anonimizado.csv", data: csv(bankRows) },
    { name: "estatistica_tabela1.csv", data: csv(tableRows) },
    { name: "qualidade_do_banco.csv", data: csv(qualRows) },
    { name: "dicionario_variaveis.csv", data: csv(dictRows) },
    { name: "metodologia.txt", data: methodology },
    { name: "fluxograma.txt", data: fluxograma },
    { name: "dados_longitudinais.csv", data: csv(longRows) },
  ];
  if (barData.length) files.push({ name: `graficos/distribuicao_${firstCat!.key}.svg`, data: barSvg(`Distribuição de ${firstCat!.label}`, barData) });
  if (tfgeSeries.length) files.push({ name: "graficos/evolucao_tfge.svg", data: lineSvg("Evolução da TFGe ao longo do tempo", tfgeSeries, "mL/min/1,73m²") });

  const zip = createZip(files);
  const safe = (study.title || "estudo").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "estudo";
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pacote-${safe}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
