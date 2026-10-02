// Monta rascunhos de Receita e Relatório a partir dos dados JÁ existentes na LME.
// Não inventa exames, doses ou justificativas — apenas reaproveita o que está na LME.
// O texto é sempre editável no compositor antes de assinar.

import { CEAF_PROTOCOLS, getProtocol, protocolFitsAge } from "@/lib/ceaf-catalog";
import { getProtocolOfficialDocs, type OfficialDocSlot } from "@/lib/ceaf-documents";

export type LmeLike = {
  id?: string;
  cid10?: string | null;
  diagnosis?: string | null;
  anamnesis?: string | null;
  patientName?: string | null;
  protocolId?: string | null;
  medications?: { name: string; presentation?: string | null; monthlyQty?: string | null }[];
};

export type InferProtocolOpts = {
  ageYears?: number | null;
};

export type InferredRoute = {
  route: string | null;
  form: string | null;
  injectable: boolean;
  oral: boolean;
};

/** Infere via/forma só a partir do nome e da apresentação registrados. Não inventa dose. */
export function inferRouteAndForm(name: string, presentation?: string | null): InferredRoute {
  const t = `${name} ${presentation || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const injectable = /injet|ampola|frasco|iv\b|ev\b|sc\b|im\b|subcut|endoven|infus|parenter/.test(t);
  const oralForm = /comprimid|capsula|dragea|solucao oral/.test(t);
  let form: string | null = null;
  if (/frasco-ampola|frasco ampola/.test(t)) form = "frasco-ampola";
  else if (/ampola/.test(t)) form = "ampola";
  else if (/frasco de/.test(t) || (/frasco/.test(t) && injectable)) form = "frasco";
  else if (/comprimid/.test(t)) form = "comprimido";
  else if (/capsula/.test(t)) form = "cápsula";
  else if (/dragea/.test(t)) form = "drágea";
  else if (/solucao oral/.test(t)) form = "solução oral";
  else if (presentation?.trim()) form = presentation.trim();

  let route: string | null = null;
  if (injectable) route = "injetável (confirmar subcutânea, endovenosa ou intramuscular)";
  else if (oralForm || /solucao oral/.test(t)) route = "via oral";

  return { route, form, injectable, oral: Boolean(oralForm) && !injectable };
}

function posologyBlock(m: { name: string; presentation?: string | null; monthlyQty?: string | null }): string[] {
  const inferred = inferRouteAndForm(m.name, m.presentation);
  const nome = [m.name, m.presentation].filter(Boolean).join(" ");
  const lines = [nome];
  if (inferred.form) lines.push(`   Apresentação: ${inferred.form}`);
  if (inferred.route) lines.push(`   Via: ${inferred.route}`);
  else lines.push("   Via: ____ (preencher)");
  lines.push("   Dose: ____ (preencher — não inferida)");
  lines.push("   Frequência: ____ (preencher)");
  lines.push("   Duração: ____ (preencher)");
  lines.push(`   Quantidade: ${m.monthlyQty ? m.monthlyQty : "____"}`);
  if (inferred.injectable) {
    lines.push("   Atenção: apresentação injetável — não usar posologia de comprimido.");
  }
  return lines;
}

export function receitaFromLme(lme: LmeLike): { type: "receita"; title: string; body: string } {
  const meds = lme.medications || [];
  const lines: string[] = [];
  if (lme.cid10) lines.push(`CID-10: ${lme.cid10}`);
  if (lines.length) lines.push("");
  if (meds.length === 0) {
    lines.push("1. ____");
    lines.push("   Via: ____ (preencher)");
    lines.push("   Dose: ____ (preencher)");
    lines.push("   Frequência: ____ (preencher)");
    lines.push("   Duração: ____ (preencher)");
    lines.push("   Quantidade: ____");
  } else {
    meds.forEach((m, i) => {
      const block = posologyBlock(m);
      block[0] = `${i + 1}. ${block[0]}`;
      lines.push(...block);
      lines.push("");
    });
  }
  lines.push("Orientações: ");
  lines.push("");
  lines.push("Revise dose, via, frequência e duração antes de emitir. Campos em branco não foram preenchidos automaticamente.");
  return { type: "receita", title: "Receita médica", body: lines.join("\n").trim() };
}

export function relatorioFromLme(lme: LmeLike): { type: "relatorio"; title: string; body: string } {
  const meds = (lme.medications || []).map((m) => [m.name, m.presentation].filter(Boolean).join(" ")).filter(Boolean);
  const lines: string[] = ["RELATÓRIO MÉDICO", ""];
  lines.push(`Paciente com diagnóstico de ${lme.diagnosis || "____"}${lme.cid10 ? ` (CID ${lme.cid10})` : ""}.`);
  if (lme.anamnesis) { lines.push(""); lines.push(lme.anamnesis); }
  if (meds.length) { lines.push(""); lines.push(`Em uso de: ${meds.join("; ")}.`); }
  lines.push("");
  lines.push("Exames relevantes (confirmar valores): ");
  lines.push("");
  lines.push("Solicito a manutenção/continuidade do tratamento conforme protocolo aplicável.");
  return { type: "relatorio", title: "Relatório médico", body: lines.join("\n").trim() };
}

/** URL do compositor. O corpo grande fica no rascunho local — a URL só identifica tipo e LME. */
export function composerHref(patientKey: string, doc: { type: string; title: string; body?: string }, lmeId?: string): string {
  const p = new URLSearchParams({ type: doc.type, title: doc.title });
  if (lmeId) p.set("lmeId", lmeId);
  if (doc.body && !lmeId) p.set("body", doc.body);
  return `/medicos/paciente/${encodeURIComponent(patientKey)}/documento?${p.toString()}`;
}

export function lmeComplementaresHref(lmeId: string): string {
  return `/lme/${lmeId}#complementares`;
}

export const LME_DOC_DRAFT_PREFIX = "meurim:lme-doc:";

export function lmeDocDraftKey(lmeId: string, type: string) {
  return `${LME_DOC_DRAFT_PREFIX}${lmeId}:${type}`;
}

export type LmeDocDraft = { title: string; body: string; savedAt: string };

export function readLmeDocDraft(lmeId: string, type: string): LmeDocDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lmeDocDraftKey(lmeId, type));
    if (!raw) return null;
    const d = JSON.parse(raw) as LmeDocDraft;
    if (!d || typeof d.body !== "string") return null;
    return d;
  } catch {
    return null;
  }
}

export function writeLmeDocDraft(lmeId: string, type: string, draft: { title: string; body: string }) {
  if (typeof window === "undefined") return;
  try {
    const payload: LmeDocDraft = { ...draft, savedAt: new Date().toISOString() };
    window.localStorage.setItem(lmeDocDraftKey(lmeId, type), JSON.stringify(payload));
  } catch {
    /* quota / privado */
  }
}

export function clearLmeDocDraft(lmeId: string, type: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(lmeDocDraftKey(lmeId, type)); } catch { /* ignore */ }
}

function normCid(code?: string | null) {
  return String(code || "").toUpperCase().replace(/\s+/g, "");
}

function medScore(pMeds: { name: string }[], names: string[]) {
  let score = 0;
  for (const med of pMeds) {
    const needle = med.name.toLowerCase();
    const short = needle.slice(0, 16);
    if (names.some((n) => n.includes(needle))) score += 10;
    else if (names.some((n) => n.includes(short) || needle.includes(n.slice(0, 16)))) score += 3;
  }
  return score;
}

/**
 * Escolhe protocolo por doença + CID + idade + indicação.
 * Medicamento sozinho não decide quando há empate (ex.: ciclosporina em SN e LES).
 */
export function inferProtocolId(lme: LmeLike, opts: InferProtocolOpts = {}): string | null {
  if (lme.protocolId && getProtocol(lme.protocolId)) return lme.protocolId;
  const names = (lme.medications || []).map((m) => `${m.name} ${m.presentation || ""}`.toLowerCase());
  const cid = normCid(lme.cid10);
  const dx = `${lme.diagnosis || ""} ${lme.anamnesis || ""}`.toLowerCase();
  const ranked: { id: string; score: number; uniqueMed: boolean }[] = [];
  for (const p of CEAF_PROTOCOLS) {
    if (!protocolFitsAge(p, opts.ageYears)) continue;
    let score = 0;
    if (cid && p.cids.some((c) => normCid(c.code) === cid)) score += 100;
    else if (cid && p.cids.some((c) => cid.startsWith(normCid(c.code).slice(0, 3)) && normCid(c.code).startsWith(cid.slice(0, 3)))) {
      const p3 = cid.slice(0, 3);
      if (p.cids.some((c) => normCid(c.code).startsWith(p3))) score += 40;
    }
    const pname = p.name.toLowerCase();
    if (dx && (dx.includes("lúpus") || dx.includes("lupus") || dx.includes("les")) && p.id === "les") score += 50;
    if (dx && /nefrotic/.test(dx.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) && p.id.startsWith("sindrome_nefrotica")) score += 30;
    if (dx && /anemia/.test(dx) && p.id.startsWith("anemia_drc")) score += 30;
    if (dx && pname.split("—")[0] && dx.includes(pname.split("—")[0].trim().slice(0, 12))) score += 8;
    const drugs = names.length ? medScore(p.medications, names) : 0;
    score += drugs;
    if (score > 0) ranked.push({ id: p.id, score, uniqueMed: drugs >= 10 });
  }
  if (!ranked.length) return null;
  ranked.sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const tied = ranked.filter((r) => r.score === top.score);
  if (tied.length > 1) return null;
  if (top.score < 40 && !top.uniqueMed) return null;
  if (top.score < 40 && ranked.filter((r) => r.uniqueMed).length > 1) return null;
  return top.id;
}

export type ComplementaryKind = "receita" | "relatorio" | "ter" | "consentimento";
export type ComplementaryStatus = "nao_gerado" | "rascunho" | "gerado" | "indisponivel";

export type ComplementarySlot = {
  kind: ComplementaryKind;
  label: string;
  status: ComplementaryStatus;
  reason?: string;
  officialLabel?: string;
  docId?: string | null;
  pdfUrl?: string | null;
};

export function officialTerSlot(protocolId: string | null): OfficialDocSlot {
  if (!protocolId) {
    return {
      status: "unavailable",
      label: "TER oficial",
      reason: "Esta LME não tem protocolo CEAF gravado. Abra o assistente de LME e escolha o protocolo para usar o TER oficial correspondente.",
    };
  }
  return getProtocolOfficialDocs(protocolId).ter;
}

/**
 * Consentimento separado: o pacote oficial SESAB/CEAF do Meu Rim traz TER
 * (Termo de Esclarecimento e Responsabilidade), não um termo de consentimento
 * genérico. Não inventamos nem substituímos o TER por outro texto.
 */
export function officialConsentimentoSlot(protocolId: string | null): OfficialDocSlot {
  const ter = officialTerSlot(protocolId);
  if (ter.status === "available") {
    return {
      status: "unavailable",
      label: "Termo de consentimento oficial",
      reason: "No pacote oficial da SESAB deste protocolo o documento correspondente é o TER (Termo de Esclarecimento e Responsabilidade). Não há termo de consentimento separado neste arquivo — não substituímos por um termo genérico.",
    };
  }
  return {
    status: "unavailable",
    label: "Termo de consentimento oficial",
    reason: ter.reason || "Não há termo de consentimento oficial neste protocolo no pacote SESAB do Meu Rim.",
  };
}

export const PACKAGE_ORDER: ComplementaryKind[] = ["receita", "relatorio", "ter", "consentimento"];

export function packageMissingLabels(slots: ComplementarySlot[]): string[] {
  return slots
    .filter((s) => s.status === "nao_gerado" || s.status === "rascunho")
    .map((s) => s.label);
}
