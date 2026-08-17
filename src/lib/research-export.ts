import "server-only";
import { RESEARCH_VARS_BY_KEY } from "./research-fields";

/* ============================================================================
   Exportação científica avançada (determinística, sem IA):
   dicionário de variáveis + scripts R/Python + sintaxe SPSS.
   Nomes de coluna = CHAVES (idade, sexo, has, lab_tfge…) para uso direto.
   Separador ";" e decimal "," (padrão pt-BR: read.csv2 no R, decimal="," no pandas).
   ============================================================================ */

export type VarKind = "numérica" | "categórica" | "binária" | "texto" | "data";

export interface VarDict {
  key: string;
  label: string;
  kind: VarKind;
  unit: string;
  values: string; // valores possíveis (categóricas) ou faixa/—
  coding: string; // codificação sugerida p/ análise
  missing: string; // como aparecem os ausentes
  formula: string; // fórmula/critério p/ variáveis calculadas
}

function isBinary(opts?: { value: string }[]): boolean {
  if (!opts) return false;
  const vals = opts.map((o) => o.value);
  return vals.includes("sim") && vals.includes("nao");
}

const FORMULA: Record<string, string> = {
  idade: "idade = data atual − data de nascimento (ajustada por mês/dia).",
  imc: "IMC = peso(kg) / altura(m)².",
  lab_tfge: "TFGe estimada pela equação CKD-EPI 2021 (creatinina, idade, sexo).",
  lab_tfge_cistatina: "TFGe estimada pela equação CKD-EPI Cistatina C 2021.",
};

export function buildDictionary(variables: string[]): VarDict[] {
  return variables.map((key) => {
    const def = RESEARCH_VARS_BY_KEY.get(key);
    const label = def?.label || key;
    const unit = def?.unit || "";
    if (!def || def.type === "num") {
      return {
        key, label, kind: "numérica", unit,
        values: "numérico",
        coding: "valor numérico",
        missing: "célula vazia (NA)",
        formula: FORMULA[key] || (key.startsWith("lab_") ? "Último valor registrado no histórico laboratorial." : ""),
      };
    }
    if (def.type === "text") {
      return { key, label, kind: "texto", unit, values: "texto livre", coding: "—", missing: "célula vazia", formula: "" };
    }
    // categórica
    const opts = def.options || [];
    if (isBinary(opts)) {
      return {
        key, label, kind: "binária", unit,
        values: "sim / não",
        coding: "1 = sim; 0 = não",
        missing: 'vazio ou "desconhecido" = NA (não assumir "não")',
        formula: "",
      };
    }
    return {
      key, label, kind: "categórica", unit,
      values: opts.map((o) => o.label).join(", ") || "—",
      coding: opts.map((o) => `"${o.value}" = ${o.label}`).join("; ") || "categorias como texto",
      missing: '"desconhecido" ou vazio = NA',
      formula: "",
    };
  });
}

/** Texto com definições adotadas no banco (documentação — confirmar com diretrizes vigentes). */
export function definitionsText(): string {
  return [
    "DEFINIÇÕES ADOTADAS NO BANCO",
    "(Documentação das convenções usadas nos dados. Confirme os limiares com as diretrizes vigentes do seu estudo.)",
    "",
    "- TFGe: taxa de filtração glomerular estimada pela equação CKD-EPI 2021 (creatinina). Unidade: mL/min/1,73 m².",
    "  Quando disponível cistatina C, usa-se a CKD-EPI Cistatina C 2021 (variável separada).",
    "- Estágios de TFGe (G): G1 ≥90; G2 60–89; G3a 45–59; G3b 30–44; G4 15–29; G5 <15 mL/min/1,73 m².",
    "- Albuminúria (categoria A) por RAC (relação albumina/creatinina urinária): A1 <30; A2 30–300; A3 >300 mg/g.",
    "- Proteinúria: quantificada por proteinúria de 24h ou relação proteína/creatinina (RPC); relatar unidade utilizada.",
    "- DRC (doença renal crônica): alterações de estrutura/função renal por ≥3 meses (ex.: TFGe <60 e/ou albuminúria/lesão). Registro do médico no perfil clínico.",
    "- Diabetes (DM): diagnóstico clínico/laboratorial registrado; variável binária (1=sim/0=não).",
    "- Hipertensão (HAS): diagnóstico clínico registrado; variável binária (1=sim/0=não).",
    "",
    "Proveniência: idade calculada da data de nascimento; exames = último valor do histórico (série completa em dados_longitudinais.csv);",
    "campos do perfil clínico = informado/extraído/confirmado pelo médico. Campo vazio = desconhecido (nunca assumir 'não').",
  ].join("\n");
}

/** Script R (read.csv2 = sep ';' e decimal ','). Cria fatores e versões binárias _bin. */
export function rScript(variables: string[]): string {
  const dict = buildDictionary(variables);
  const numeric = dict.filter((d) => d.kind === "numérica").map((d) => d.key);
  const binary = dict.filter((d) => d.kind === "binária").map((d) => d.key);
  const categorical = dict.filter((d) => d.kind === "categórica").map((d) => d.key);
  const L: string[] = [];
  L.push("# Meu Rim — importação do banco de pesquisa (R)");
  L.push('# Coloque este arquivo na mesma pasta de "dados.csv".');
  L.push('df <- read.csv2("dados.csv", na.strings = c("NA", "", "desconhecido"), fileEncoding = "UTF-8", stringsAsFactors = FALSE)');
  L.push("");
  if (numeric.length) {
    L.push("# Variáveis numéricas");
    L.push(`num_vars <- c(${numeric.map((k) => `"${k}"`).join(", ")})`);
    L.push('for (v in num_vars) df[[v]] <- as.numeric(gsub(",", ".", as.character(df[[v]])))');
    L.push("");
  }
  if (categorical.length) {
    L.push("# Variáveis categóricas (como fator)");
    for (const k of categorical) {
      const opts = RESEARCH_VARS_BY_KEY.get(k)?.options || [];
      L.push(`df$${k} <- factor(df$${k}, levels = c(${opts.map((o) => `"${o.value}"`).join(", ")}))`);
    }
    L.push("");
  }
  if (binary.length) {
    L.push("# Variáveis binárias -> 1 = sim, 0 = não (coluna _bin)");
    L.push(`bin_vars <- c(${binary.map((k) => `"${k}"`).join(", ")})`);
    L.push('for (v in bin_vars) df[[paste0(v, "_bin")]] <- ifelse(df[[v]] == "sim", 1L, ifelse(df[[v]] == "nao", 0L, NA))');
    L.push("");
  }
  L.push("summary(df)");
  return L.join("\n");
}

/** Script Python (pandas). */
export function pyScript(variables: string[]): string {
  const dict = buildDictionary(variables);
  const numeric = dict.filter((d) => d.kind === "numérica").map((d) => d.key);
  const binary = dict.filter((d) => d.kind === "binária").map((d) => d.key);
  const categorical = dict.filter((d) => d.kind === "categórica").map((d) => d.key);
  const L: string[] = [];
  L.push("# Meu Rim — importação do banco de pesquisa (Python / pandas)");
  L.push("import pandas as pd");
  L.push('df = pd.read_csv("dados.csv", sep=";", decimal=",", na_values=["NA", "", "desconhecido"], encoding="utf-8")');
  L.push("");
  if (numeric.length) {
    L.push("# Numéricas");
    L.push(`num_vars = [${numeric.map((k) => `"${k}"`).join(", ")}]`);
    L.push('for v in num_vars:\n    df[v] = pd.to_numeric(df[v].astype(str).str.replace(",", ".", regex=False), errors="coerce")');
    L.push("");
  }
  if (categorical.length) {
    L.push("# Categóricas");
    L.push(`cat_vars = [${categorical.map((k) => `"${k}"`).join(", ")}]`);
    L.push('for v in cat_vars:\n    df[v] = df[v].astype("category")');
    L.push("");
  }
  if (binary.length) {
    L.push("# Binárias -> 1/0 (coluna _bin)");
    L.push(`bin_vars = [${binary.map((k) => `"${k}"`).join(", ")}]`);
    L.push('for v in bin_vars:\n    df[v + "_bin"] = df[v].map({"sim": 1, "nao": 0})');
    L.push("");
  }
  L.push("print(df.describe(include='all'))");
  return L.join("\n");
}

/** Sintaxe SPSS: importa o CSV (decimal vírgula) e aplica rótulos de variáveis/valores. */
export function spssSyntax(variables: string[]): string {
  const dict = buildDictionary(variables);
  const cols = ["codigo", ...variables];
  const spec = cols.map((c) => {
    if (c === "codigo") return "codigo A12";
    const d = dict.find((x) => x.key === c);
    return d && d.kind === "numérica" ? `${c} F12.3` : `${c} A40`;
  });
  const L: string[] = [];
  L.push("* Meu Rim — importacao do banco de pesquisa (SPSS).");
  L.push('* Ajuste o caminho do arquivo "dados.csv" conforme necessario.');
  L.push("GET DATA");
  L.push("  /TYPE=TXT");
  L.push('  /FILE="dados.csv"');
  L.push("  /ENCODING='UTF8'");
  L.push("  /DELIMITERS=';'");
  L.push("  /QUALIFIER='\"'");
  L.push("  /DECIMAL=COMMA");
  L.push("  /ARRANGEMENT=DELIMITED");
  L.push("  /FIRSTCASE=2");
  L.push("  /VARIABLES=");
  L.push("    " + spec.join("\n    "));
  L.push(".");
  L.push("");
  L.push("VARIABLE LABELS");
  for (const d of dict) L.push(`  ${d.key} "${d.label.replace(/"/g, "'")}"`);
  L.push(".");
  L.push("");
  const bins = dict.filter((d) => d.kind === "binária");
  const cats = dict.filter((d) => d.kind === "categórica");
  if (bins.length || cats.length) {
    L.push("VALUE LABELS");
    for (const d of bins) L.push(`  /${d.key} 'sim' "Sim" 'nao' "Nao"`);
    for (const d of cats) {
      const opts = RESEARCH_VARS_BY_KEY.get(d.key)?.options || [];
      if (opts.length) L.push(`  /${d.key} ` + opts.map((o) => `'${o.value}' "${o.label.replace(/"/g, "'")}"`).join(" "));
    }
    L.push(".");
  }
  L.push("");
  L.push("EXECUTE.");
  return L.join("\n");
}
