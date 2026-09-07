/**
 * Dicionário extensível de siglas e sinônimos clínicos.
 * Acrescentar um item aqui já alimenta a extração da evolução — sem mudar o restante do sistema.
 *
 * aliases: formas já normalizadas (sem acento, minúsculas).
 */

export type TermStatusHint = "dx" | "habit" | "procedure";

export interface MedicalTerm {
  id: string;
  label: string;
  aliases: string[];
  /** Campo do perfil clínico, quando mapeável 1:1. */
  profileKey?: string;
  profileValue?: string;
  /** Também marca este campo (ex.: IAM → dcv). */
  alsoSet?: { key: string; value: string }[];
}

export const MEDICAL_TERMS: MedicalTerm[] = [
  { id: "has", label: "Hipertensão arterial", aliases: ["has", "hta", "hipertensao arterial sistemica", "hipertensao arterial", "hipertensao"], profileKey: "has", profileValue: "sim" },
  { id: "dm2", label: "Diabetes mellitus tipo 2", aliases: ["dm2", "dmt2", "diabetes mellitus tipo 2", "diabetes tipo 2"], profileKey: "dm", profileValue: "sim" },
  { id: "dm1", label: "Diabetes mellitus tipo 1", aliases: ["dm1", "dmt1", "diabetes mellitus tipo 1", "diabetes tipo 1"], profileKey: "dm", profileValue: "sim" },
  { id: "dm", label: "Diabetes mellitus", aliases: ["dm", "diabetes mellitus", "diabetes", "diabetico", "diabetica"], profileKey: "dm", profileValue: "sim" },
  { id: "dpoc", label: "DPOC", aliases: ["dpoc", "doenca pulmonar obstrutiva cronica"], profileKey: "dpoc", profileValue: "sim" },
  { id: "asma", label: "Asma", aliases: ["asma", "asmatico", "asmatica"], profileKey: "asma", profileValue: "sim" },
  { id: "drc", label: "Doença renal crônica", aliases: ["drc", "irc", "doenca renal cronica", "insuficiencia renal cronica", "renal cronico", "renal cronica"], profileKey: "drc", profileValue: "sim" },
  { id: "ira", label: "Injúria renal aguda", aliases: ["ira", "injuria renal aguda", "insuficiencia renal aguda", "aki"], profileKey: "ira_previa", profileValue: "sim" },
  { id: "icfer", label: "ICFER", aliases: ["icfer", "icfe reduzida", "insuficiencia cardiaca com fracao de ejecao reduzida"], profileKey: "ic", profileValue: "sim" },
  { id: "icfep", label: "ICFEP", aliases: ["icfep", "icfe preservada", "insuficiencia cardiaca com fracao de ejecao preservada"], profileKey: "ic", profileValue: "sim" },
  { id: "ic", label: "Insuficiência cardíaca", aliases: ["insuficiencia cardiaca", "icc", "ic congestiva"], profileKey: "ic", profileValue: "sim" },
  { id: "dac", label: "Doença arterial coronariana", aliases: ["dac", "doenca arterial coronariana", "coronariopatia"], profileKey: "dcv", profileValue: "sim" },
  { id: "iam", label: "IAM", aliases: ["iam", "infarto agudo do miocardio", "infarto"], profileKey: "dcv", profileValue: "sim" },
  { id: "fa", label: "Fibrilação atrial", aliases: ["fibrilacao atrial", "fa paroxistica"], profileKey: "fa", profileValue: "sim", alsoSet: [{ key: "dcv", value: "sim" }] },
  { id: "avc", label: "AVC", aliases: ["avc", "acidente vascular cerebral", "avc isquemico", "avc hemorragico"], profileKey: "dcv", profileValue: "sim" },
  { id: "ait", label: "AIT", aliases: ["ait", "ataque isquemico transitorio"], profileKey: "dcv", profileValue: "sim" },
  { id: "les", label: "Lúpus eritematoso sistêmico", aliases: ["les", "lupus eritematoso sistemico", "lupus"], profileKey: "doenca_autoimune", profileValue: "sim" },
  { id: "ar", label: "Artrite reumatoide", aliases: ["artrite reumatoide"], profileKey: "doenca_autoimune", profileValue: "sim" },
  { id: "itu", label: "ITU", aliases: ["itu", "infeccao do trato urinario", "infeccao urinaria"] },
  { id: "hd", label: "Hemodiálise", aliases: ["hemodialise", "em hd", "hemodialitico"], profileKey: "hemodialise", profileValue: "sim" },
  { id: "dp", label: "Diálise peritoneal", aliases: ["dialise peritoneal", "capd", "dpac"], profileKey: "dialise_peritoneal", profileValue: "sim" },
  { id: "trs", label: "TRS", aliases: ["trs", "terapia renal substitutiva"] },
  { id: "hiv", label: "HIV", aliases: ["hiv", "virus da imunodeficiencia humana"] },
  { id: "hbv", label: "HBV", aliases: ["hbv", "hepatite b"], profileKey: "hepatopatia", profileValue: "sim" },
  { id: "hcv", label: "HCV", aliases: ["hcv", "hepatite c"], profileKey: "hepatopatia", profileValue: "sim" },
  { id: "tep", label: "TEP", aliases: ["tep", "tromboembolia pulmonar", "embolia pulmonar"], profileKey: "dcv", profileValue: "sim" },
  { id: "tvp", label: "TVP", aliases: ["tvp", "trombose venosa profunda"] },
  { id: "drpad", label: "DRPAD", aliases: ["drpad", "doenca renal policistica autossomica dominante"], profileKey: "policistica", profileValue: "sim" },
  { id: "gesf", label: "GESF", aliases: ["gesf", "glomeruloesclerose segmentar e focal"], profileKey: "glomerulopatia", profileValue: "sim" },
  { id: "niga", label: "Nefropatia por IgA", aliases: ["niga", "nefropatia por iga", "doenca de berger"], profileKey: "glomerulopatia", profileValue: "sim" },
  { id: "sn", label: "Síndrome nefrótica", aliases: ["sindrome nefrotica"] },
  { id: "sne", label: "Síndrome nefrítica", aliases: ["sindrome nefritica"] },
  { id: "hpb", label: "HPB", aliases: ["hpb", "hbp", "hiperplasia prostatica benigna"] },
  { id: "obesidade", label: "Obesidade", aliases: ["obesidade", "obeso", "obesa"], profileKey: "obesidade", profileValue: "sim" },
  { id: "dislipidemia", label: "Dislipidemia", aliases: ["dislipidemia", "hipercolesterolemia"], profileKey: "dislipidemia", profileValue: "sim" },
  { id: "neoplasia", label: "Neoplasia", aliases: ["neoplasia", "cancer", "neoplasico"], profileKey: "neoplasia", profileValue: "sim" },
  { id: "cirrose", label: "Cirrose", aliases: ["cirrose", "hepatopatia"], profileKey: "hepatopatia", profileValue: "sim" },
  { id: "litiase", label: "Nefrolitíase", aliases: ["litiase", "nefrolitiase", "calculo renal", "urolitiase"], profileKey: "litiase", profileValue: "sim" },
  { id: "transplante", label: "Transplante", aliases: ["transplante renal", "tx renal", "transplantado"], profileKey: "transplante", profileValue: "sim" },
  { id: "rim_unico", label: "Rim único", aliases: ["rim unico", "monorrene", "monorrim"], profileKey: "rim_unico", profileValue: "sim" },
  { id: "ckm", label: "Síndrome CKM", aliases: ["sindrome ckm", "ckm", "cardiovascular renal metabol"], profileKey: "ckm", profileValue: "sim" },
];

/** Termos ordenados pelo alias mais longo — evita casar DM antes de DM2. */
export function termsByAliasLength(): { term: MedicalTerm; alias: string }[] {
  const rows: { term: MedicalTerm; alias: string }[] = [];
  for (const term of MEDICAL_TERMS) {
    for (const alias of term.aliases) rows.push({ term, alias });
  }
  return rows.sort((a, b) => b.alias.length - a.alias.length);
}
