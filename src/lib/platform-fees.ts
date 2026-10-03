/** Cobrança da plataforma por profissional. O admin define pessoa a pessoa. */

export const APP_FEE_MODES = ["gratis", "por_atendimento", "por_entrada"] as const;
export type AppFeeMode = (typeof APP_FEE_MODES)[number];

export const APP_FEE_LABEL: Record<AppFeeMode, string> = {
  gratis: "App grátis",
  por_atendimento: "Por atendimento",
  por_entrada: "Por entrada",
};

export type PlatformChargeKind = "atendimento" | "entrada";
export type PlatformChargeStatus = "due" | "declared" | "received";
export type PlatformActorKind = "psychology" | "nursing" | "nutrition";

export interface ProfessionalFeeRule {
  appFeeMode: AppFeeMode;
  commissionPercent: number;
  entryFeeCents: number;
}

export function normalizeFeeMode(value: unknown): AppFeeMode {
  return APP_FEE_MODES.includes(value as AppFeeMode) ? (value as AppFeeMode) : "gratis";
}

export function feeRuleFrom(input: {
  appFeeMode?: unknown;
  commissionPercent?: number | null;
  entryFeeCents?: number | null;
}): ProfessionalFeeRule {
  return {
    appFeeMode: normalizeFeeMode(input.appFeeMode),
    commissionPercent: Math.min(100, Math.max(0, Math.round(Number(input.commissionPercent ?? 0) || 0))),
    entryFeeCents: Math.max(0, Math.round(Number(input.entryFeeCents ?? 0) || 0)),
  };
}

/** Quanto a plataforma fica neste evento. Grátis = 0. */
export function computePlatformFeeCents(
  rule: ProfessionalFeeRule,
  event: PlatformChargeKind,
  priceCents = 0
): number {
  if (rule.appFeeMode === "gratis") return 0;
  if (rule.appFeeMode === "por_entrada" && event !== "entrada") return 0;
  if (rule.appFeeMode === "por_atendimento" && event !== "atendimento") return 0;
  const pct = event === "atendimento" ? Math.round((Math.max(0, priceCents) * rule.commissionPercent) / 100) : 0;
  const fixed = rule.entryFeeCents;
  if (rule.appFeeMode === "por_entrada") return fixed;
  return pct + fixed;
}

export function feeSummary(rule: ProfessionalFeeRule): string {
  if (rule.appFeeMode === "gratis") return "App grátis — nada entra para a plataforma.";
  const parts: string[] = [];
  if (rule.appFeeMode === "por_atendimento") {
    if (rule.commissionPercent > 0) parts.push(`${rule.commissionPercent}% de cada consulta`);
    if (rule.entryFeeCents > 0) parts.push(`R$ ${(rule.entryFeeCents / 100).toFixed(2)} por atendimento`);
    if (!parts.length) parts.push("por atendimento (valor ainda não definido)");
  } else {
    parts.push(rule.entryFeeCents > 0 ? `R$ ${(rule.entryFeeCents / 100).toFixed(2)} por entrada` : "por entrada (valor ainda não definido)");
  }
  return `Cobra ${parts.join(" + ")}.`;
}
