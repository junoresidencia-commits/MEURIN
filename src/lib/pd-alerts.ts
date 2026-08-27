import type { PdCatheterEval, PdDailyLog } from "./pd-store";

export type PdAlert = { key: string; level: "atencao" | "alerta"; title: string; message: string; at: string };

export function computePdAlerts(logs: PdDailyLog[], catheter: PdCatheterEval[]): PdAlert[] {
  const alerts: PdAlert[] = [];
  const latest = logs[0];
  if (!latest) return alerts;

  if (latest.effluent && /turvo|opaco|leitoso|sangue/i.test(latest.effluent)) {
    alerts.push({ key: "efluente", level: "alerta", title: "Efluente turvo", message: "O último registro descreve efluente alterado. Avaliar peritonite.", at: latest.loggedAt });
  }
  if (latest.fever) {
    alerts.push({ key: "febre", level: "alerta", title: "Febre", message: "Febre registrada no controle de DP.", at: latest.loggedAt });
  }
  if (latest.abdominalPain) {
    alerts.push({ key: "dor", level: "alerta", title: "Dor abdominal", message: "Dor abdominal no último controle de DP.", at: latest.loggedAt });
  }
  if (latest.missedExchanges) {
    alerts.push({ key: "trocas", level: "alerta", title: "Trocas não realizadas", message: "Paciente deixou de realizar trocas.", at: latest.loggedAt });
  }
  if (latest.systolic != null && (latest.systolic >= 180 || latest.systolic < 90)) {
    alerts.push({ key: "pa", level: "alerta", title: "PA fora do habitual", message: `PA ${latest.systolic}/${latest.diastolic ?? "—"} mmHg no último controle.`, at: latest.loggedAt });
  }

  const ufs = logs.filter((l) => l.ultrafiltrationMl != null).slice(0, 8).map((l) => Number(l.ultrafiltrationMl));
  if (latest.ultrafiltrationMl != null && ufs.length >= 3) {
    const mean = ufs.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, ufs.length - 1);
    if (mean && Math.abs(Number(latest.ultrafiltrationMl) - mean) > Math.max(400, Math.abs(mean) * 0.6)) {
      alerts.push({ key: "uf", level: "atencao", title: "Ultrafiltração diferente do habitual", message: `UF atual ${latest.ultrafiltrationMl} mL (média recente ~${Math.round(mean)} mL).`, at: latest.loggedAt });
    }
  }

  const weights = logs.filter((l) => l.weightKg != null).slice(0, 5).map((l) => Number(l.weightKg));
  if (weights.length >= 2 && weights[0] - weights[weights.length - 1] >= 2.5) {
    alerts.push({ key: "peso", level: "atencao", title: "Ganho rápido de peso", message: `Peso subiu ${ (weights[0] - weights[weights.length - 1]).toFixed(1) } kg nos registros recentes.`, at: latest.loggedAt });
  }

  const urines = logs.filter((l) => l.urineMl != null).slice(0, 6).map((l) => Number(l.urineMl));
  if (urines.length >= 3 && urines[0] < urines.slice(1).reduce((a, b) => a + b, 0) / (urines.length - 1) * 0.5 && urines[0] < 400) {
    alerts.push({ key: "diurese", level: "atencao", title: "Queda de diurese", message: `Diurese residual ${urines[0]} mL, abaixo do habitual.`, at: latest.loggedAt });
  }

  const cat = catheter[0];
  if (cat && (cat.hyperemia || cat.secretion || cat.pain)) {
    alerts.push({ key: "orificio", level: "alerta", title: "Problema no orifício de saída", message: "Última avaliação do cateter com hiperemia, secreção ou dor.", at: cat.evaluatedAt });
  }
  return alerts;
}
