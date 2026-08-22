// Monta rascunhos de Receita e Relatório a partir dos dados JÁ existentes na LME.
// Não inventa exames, doses ou justificativas — apenas reaproveita o que está na LME.
// O texto é sempre editável no compositor antes de assinar.

export type LmeLike = {
  cid10?: string | null;
  diagnosis?: string | null;
  anamnesis?: string | null;
  patientName?: string | null;
  medications?: { name: string; presentation?: string | null; monthlyQty?: string | null }[];
};

export function receitaFromLme(lme: LmeLike): { type: "receita"; title: string; body: string } {
  const meds = lme.medications || [];
  const lines: string[] = [];
  if (lme.cid10) lines.push(`CID-10: ${lme.cid10}`);
  if (lines.length) lines.push("");
  if (meds.length === 0) {
    lines.push("1. ____");
    lines.push("   Posologia: ____ — via oral — ____ — uso contínuo");
    lines.push("   Quantidade: ____");
  } else {
    meds.forEach((m, i) => {
      const nome = [m.name, m.presentation].filter(Boolean).join(" ");
      lines.push(`${i + 1}. ${nome}`);
      lines.push(`   Posologia: 1 comprimido — via oral — 1x ao dia — uso contínuo (revisar)`);
      lines.push(`   Quantidade: ${m.monthlyQty ? m.monthlyQty : "____"}`);
      lines.push("");
    });
  }
  lines.push("Orientações: ");
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

/** URL do compositor com prefill (Receita ou Relatório) para um paciente. */
export function composerHref(patientKey: string, doc: { type: string; title: string; body: string }, lmeId?: string): string {
  const p = new URLSearchParams({ type: doc.type, title: doc.title, body: doc.body });
  if (lmeId) p.set("lmeId", lmeId);
  return `/medicos/paciente/${encodeURIComponent(patientKey)}/documento?${p.toString()}`;
}
