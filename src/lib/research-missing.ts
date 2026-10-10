export type MissingFixTab = "exames" | "perfil" | "cadastro";

export type MissingField = {
  key: string;
  label?: string;
  fixTab: string;
};

export function preferredFixTab(missing: { fixTab: string }[]): MissingFixTab {
  const counts = { perfil: 0, exames: 0, cadastro: 0 };
  for (const item of missing) {
    if (item.fixTab === "exames") counts.exames += 1;
    else if (item.fixTab === "cadastro") counts.cadastro += 1;
    else counts.perfil += 1;
  }
  if (counts.cadastro >= counts.perfil && counts.cadastro >= counts.exames && counts.cadastro > 0) return "cadastro";
  if (counts.exames > counts.perfil) return "exames";
  return "perfil";
}

export function chartTabForFix(fixTab: string): "perfil" | "exames" {
  return fixTab === "exames" ? "exames" : "perfil";
}

/** Link do prontuário já na aba certa, com a lista do que falta. */
export function chartFixHref(patientId: string, missing: MissingField[], single?: MissingField): string {
  const pick = single || { key: "", fixTab: preferredFixTab(missing) };
  const tab = chartTabForFix(pick.fixTab);
  const keys = (single ? [single] : missing).map((m) => m.key).filter(Boolean);
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (keys.length) params.set("faltantes", keys.join(","));
  const needsCadastro = (single ? [single] : missing).some((m) => m.fixTab === "cadastro");
  if (needsCadastro) params.set("editar", "1");
  return `/medicos/paciente/${encodeURIComponent(patientId)}?${params.toString()}`;
}

export function parseFaltantesQuery(search: string): string[] {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(raw).get("faltantes") || "";
  return value.split(",").map((k) => k.trim()).filter(Boolean);
}

export function wantsChartEdit(search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("editar") === "1";
}

export function firstLabTestKey(faltantes: string[]): string | null {
  const hit = faltantes.find((k) => k.startsWith("lab_") && k.length > 4);
  return hit ? hit.slice(4) : null;
}

export const CHART_WINDOW_FEATURES = "popup=yes,width=1120,height=820,scrollbars=yes,resizable=yes";

export function chartWindowName(patientId: string): string {
  return `meurim-prontuario-${patientId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "paciente"}`;
}
