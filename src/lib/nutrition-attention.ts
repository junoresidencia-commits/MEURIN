// Nível de atenção nutricional individualizado, derivado dos EXAMES recentes e do
// PERFIL CLÍNICO (estágio da DRC, diálise). É EDUCATIVO e sinaliza atenção — NÃO gera
// diagnóstico nem altera dieta/metas automaticamente.

export interface AttentionFlag {
  key: string;
  level: "atencao" | "alerta";
  title: string;
  message: string;
}

type LabLike = { testKey: string; value: number; measuredAt: string };

function latest(labs: LabLike[], key: string): number | null {
  let v: number | null = null;
  let when = "";
  for (const l of labs) {
    if (l.testKey === key && l.measuredAt > when) { when = l.measuredAt; v = l.value; }
  }
  return v;
}

export function computeAttention(labs: LabLike[], profile: Record<string, unknown> | undefined): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const k = latest(labs, "potassio");
  if (k != null) {
    if (k > 5.5) flags.push({ key: "potassio", level: "alerta", title: "Potássio elevado nos exames", message: `Seu exame recente de potássio está alto (${k}). Sua equipe pode orientar mais atenção a alimentos ricos em potássio. Não faça mudanças por conta própria.` });
    else if (k >= 5.0) flags.push({ key: "potassio", level: "atencao", title: "Potássio no limite", message: `Seu potássio recente (${k}) está próximo do limite. Vale acompanhar de perto com sua equipe.` });
  }
  const p = latest(labs, "fosforo");
  if (p != null && p > 4.5) {
    flags.push({ key: "fosforo", level: "alerta", title: "Fósforo elevado nos exames", message: `Seu exame recente de fósforo está alto (${p}). Fique atento a ultraprocessados com aditivos de fósforo e converse com sua equipe.` });
  }
  const estagio = String(profile?.estagio_g || "").toUpperCase();
  if (estagio === "G4" || estagio === "G5") {
    flags.push({ key: "estagio", level: "atencao", title: `Doença renal ${estagio}`, message: "Em estágios mais avançados, a equipe costuma acompanhar de perto potássio, fósforo, sódio e proteínas. Siga as metas definidas pela sua nutricionista." });
  }
  const hemo = profile?.hemodialise === true || profile?.hemodialise === "sim";
  const dp = profile?.dialise_peritoneal === true || profile?.dialise_peritoneal === "sim";
  if (hemo || dp) {
    flags.push({ key: "dialise", level: "atencao", title: "Em diálise", message: "Quem faz diálise costuma precisar de mais proteína e de atenção a potássio, fósforo e líquidos. As metas são individualizadas pela sua equipe." });
  }
  return flags;
}
