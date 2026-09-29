/* ============================================================================
   Hemodiálise → opinião + pacote CEAF (LME / receita / TER)
   ----------------------------------------------------------------------------
   Client-safe. Não inventa CID, medicamento, apresentação nem quantidade.
   Fonte dos medicamentos: catálogo oficial CEAF. Quantidade: texto do mapa.
   Sulfato ferroso oral NÃO é CEAF — o oficial é sacarato de hidróxido férrico.
   A IA não prescreve: o médico confirma e assina.
   ============================================================================ */

import { getMedication, getProtocol } from "@/lib/ceaf-catalog";
import { HD_EXAM_LABEL, HD_EXAM_UNIT } from "@/lib/hd-labels";
import type { HdAlert, HdExamCode } from "@/lib/hd-types";
import type { LabMap } from "@/lib/hd-rules";

export type HdMapRx = {
  epo?: string | null;
  iron?: string | null;
  sevelamer?: string | null;
  calcitriol?: string | null;
  cinacalcet?: string | null;
  paricalcitol?: string | null;
};

export type HdDocMed = {
  medId: string;
  name: string;
  presentation: string;
  /** Cópia do texto do mapa. Vazio se o mapa não tem quantidade. */
  monthlyQty: string;
  fromMap: boolean;
};

export type HdDocPackage = {
  protocolId: string;
  protocolName: string;
  cid10: string;
  diagnosis: string;
  medications: HdDocMed[];
  ready: boolean;
  reasons: string[];
  warnings: string[];
};

export type HdDocSuggestion = {
  hasLabs: boolean;
  labsText: string;
  opinion: string[];
  packages: HdDocPackage[];
  warnings: string[];
  canGenerate: boolean;
};

function txt(v?: string | null): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function norm(v?: string | null): string {
  return txt(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function officialMed(protocolId: string, medId: string, monthlyQty: string, fromMap: boolean): HdDocMed | null {
  const m = getMedication(protocolId, medId);
  if (!m) return null;
  return { medId: m.id, name: m.name, presentation: m.presentation, monthlyQty: txt(monthlyQty), fromMap };
}

/** Só escolhe 2.000 / 4.000 / 10.000 se o mapa disser. 10.000 antes de 4.000/2.000. */
export function matchEpoPresentation(mapText?: string | null): "alfaepoetina_2000" | "alfaepoetina_4000" | "alfaepoetina_10000" | null {
  const t = norm(mapText);
  if (!t) return null;
  if (/10[\.\s]?000|10000/.test(t)) return "alfaepoetina_10000";
  if (/4[\.\s]?000|4000/.test(t)) return "alfaepoetina_4000";
  if (/2[\.\s]?000|2000/.test(t)) return "alfaepoetina_2000";
  return null;
}

/** Só escolhe 30 mg ou 60 mg se o mapa disser. */
export function matchCinacalcetPresentation(mapText?: string | null): "cinacalcete_30" | "cinacalcete_60" | null {
  const t = norm(mapText);
  if (!t) return null;
  if (/\b60\b/.test(t)) return "cinacalcete_60";
  if (/\b30\b/.test(t)) return "cinacalcete_30";
  return null;
}

export function formatHdLabsText(labs: LabMap): string {
  const lines: string[] = [];
  (Object.keys(labs) as HdExamCode[]).forEach((code) => {
    const v = labs[code];
    if (v == null || !Number.isFinite(v)) return;
    const label = HD_EXAM_LABEL[code] || code;
    const unit = HD_EXAM_UNIT[code] || "";
    lines.push(`${label}: ${String(v).replace(".", ",")}${unit ? ` ${unit}` : ""}`);
  });
  return lines.join("\n");
}

function pack(
  protocolId: string,
  cid10: string,
  medications: HdDocMed[],
  reasons: string[],
  warnings: string[]
): HdDocPackage | null {
  const p = getProtocol(protocolId);
  if (!p) return null;
  const cid = p.cids.find((c) => c.code === cid10);
  if (!cid) return null;
  return {
    protocolId: p.id,
    protocolName: p.name,
    cid10: cid.code,
    diagnosis: cid.description,
    medications,
    ready: medications.length > 0,
    reasons,
    warnings,
  };
}

/**
 * Opinião do protocolo HD + pacotes CEAF oficiais.
 * Não inventa ampola, apresentação de EPO nem ferro oral.
 */
export function suggestHdDocsFromExams(input: { labs?: LabMap; alerts?: HdAlert[]; map?: HdMapRx | null }): HdDocSuggestion {
  const labs = input.labs || {};
  const alerts = input.alerts || [];
  const map = input.map || {};
  const labsText = formatHdLabsText(labs);
  const hasLabs = labsText.length > 0;

  const ferroAlert = alerts.some((a) => a.domain === "ferro" || a.code.startsWith("FERRO-"));
  const anemiaAlert = alerts.some((a) => a.domain === "anemia" || a.code.startsWith("ANEMIA-"));
  const dmoAlert = alerts.some((a) => a.domain === "DRC-MBD" || a.code.startsWith("MBD-"));

  const ironMap = txt(map.iron);
  const epoMap = txt(map.epo);
  const sevelamerMap = txt(map.sevelamer);
  const calcitriolMap = txt(map.calcitriol);
  const cinacalcetMap = txt(map.cinacalcet);
  const paricalcitolMap = txt(map.paricalcitol);

  const opinion: string[] = [];
  if (alerts.length === 0) {
    opinion.push("Exames sem alerta prioritário do protocolo. A IA não prescreve.");
  } else {
    for (const a of alerts) {
      opinion.push(`${a.message} — ${a.suggestion}`);
    }
  }

  const packages: HdDocPackage[] = [];
  const warnings: string[] = [];

  if (ferroAlert || ironMap) {
    const reasons: string[] = [];
    const warn: string[] = [];
    if (ferroAlert) reasons.push("Exames de ferro fora da faixa de revisão (TSAT/ferritina).");
    if (ironMap) reasons.push("Mapa da sala já tem ferro.");
    if (/sulfato|ferroso|vo\b|oral/.test(norm(ironMap))) {
      warn.push("O mapa cita ferro oral/sulfato. No CEAF o medicamento oficial é Sacarato de hidróxido férrico 100 mg injetável — não cadastramos sulfato ferroso oral.");
    }
    if (!ironMap) {
      warn.push("Mapa sem quantidade de ferro. A LME sai com o medicamento oficial; o médico preenche as ampolas.");
    }
    const med = officialMed("anemia_drc_ferro", "sacarato_ferrico_100", ironMap, Boolean(ironMap));
    const p = pack("anemia_drc_ferro", "N18.0", med ? [med] : [], reasons, warn);
    if (p) packages.push(p);
  }

  if (anemiaAlert || epoMap) {
    const reasons: string[] = [];
    const warn: string[] = [];
    if (anemiaAlert) reasons.push("Hemoglobina abaixo da faixa de revisão.");
    if (epoMap) reasons.push("Mapa da sala já tem EPO.");
    const epoId = matchEpoPresentation(epoMap);
    const meds: HdDocMed[] = [];
    if (epoId) {
      const med = officialMed("anemia_drc_alfaepoetina", epoId, epoMap, true);
      if (med) meds.push(med);
    } else {
      warn.push("O mapa não diz se a alfaepoetina é 2.000, 4.000 ou 10.000 UI. Não inventamos a apresentação — o médico escolhe.");
    }
    const p = pack("anemia_drc_alfaepoetina", "N18.0", meds, reasons, warn);
    if (p) packages.push(p);
  }

  const dmoMap = Boolean(sevelamerMap || calcitriolMap || cinacalcetMap || paricalcitolMap);
  if (dmoAlert || dmoMap) {
    const reasons: string[] = [];
    const warn: string[] = [];
    if (dmoAlert) reasons.push("Fósforo ou PTH fora da faixa de revisão.");
    if (dmoMap) reasons.push("Mapa da sala já tem medicamento de DMO.");
    const meds: HdDocMed[] = [];
    if (sevelamerMap) {
      const med = officialMed("dmo_drc", "sevelamer_800", sevelamerMap, true);
      if (med) meds.push(med);
    }
    if (calcitriolMap) {
      const med = officialMed("dmo_drc", "calcitriol_025", calcitriolMap, true);
      if (med) meds.push(med);
    }
    if (cinacalcetMap) {
      const cinId = matchCinacalcetPresentation(cinacalcetMap);
      if (cinId) {
        const med = officialMed("dmo_drc", cinId, cinacalcetMap, true);
        if (med) meds.push(med);
      } else {
        warn.push("O mapa tem cinacalcete, mas não diz 30 mg ou 60 mg. Não inventamos a apresentação.");
      }
    }
    if (paricalcitolMap) {
      const med = officialMed("dmo_drc", "paricalcitol_5", paricalcitolMap, true);
      if (med) meds.push(med);
    }
    if (!meds.length) {
      warn.push("Mapa sem sevelâmer, calcitriol, cinacalcete ou paricalcitol. Sem medicamento oficial não geramos LME de DMO.");
    }
    const p = pack("dmo_drc", "N18.5", meds, reasons, warn);
    if (p) packages.push(p);
  }

  if (!packages.length && hasLabs) {
    warnings.push("Exames publicados. Sem alerta de ferro/anemia/DMO e sem medicamento no mapa — nada para gerar no CEAF.");
  }

  const canGenerate = packages.some((p) => p.ready);
  return { hasLabs, labsText, opinion, packages, warnings, canGenerate };
}
