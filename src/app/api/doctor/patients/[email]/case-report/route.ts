import { NextResponse } from "next/server";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getDoctorSessionId } from "@/lib/auth";
import { getLabResults, getClinicalNotes, getDocuments } from "@/lib/patient-store";
import { getProfile } from "@/lib/clinical-profile-store";
import { getCase } from "@/lib/research-studies-store";
import { labLabel, labUnit } from "@/lib/labs";
import { ETIOLOGIAS } from "@/lib/clinical-fields";

const COMORB: { key: string; label: string }[] = [
  { key: "has", label: "Hipertensão arterial" },
  { key: "dm", label: "Diabetes mellitus" },
  { key: "ic", label: "Insuficiência cardíaca" },
  { key: "dcv", label: "Doença cardiovascular" },
  { key: "obesidade", label: "Obesidade" },
  { key: "dislipidemia", label: "Dislipidemia" },
  { key: "hepatopatia", label: "Hepatopatia" },
  { key: "neoplasia", label: "Neoplasia" },
  { key: "rim_unico", label: "Rim único" },
  { key: "policistica", label: "Doença renal policística" },
  { key: "glomerulopatia", label: "Glomerulopatia" },
  { key: "litiase", label: "Nefrolitíase" },
  { key: "transplante", label: "Transplante renal" },
  { key: "hemodialise", label: "Hemodiálise" },
  { key: "dialise_peritoneal", label: "Diálise peritoneal" },
];

function ageFrom(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a >= 0 && a < 130 ? a : null;
}
function initials(name: string): string {
  return (name || "").split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).join(".").slice(0, 6) || "—";
}
function sexLabel(sex?: string | null): string {
  const s = String(sex || "").toLowerCase();
  if (/^f|fem|mulher/.test(s)) return "feminino";
  if (/^m|masc|homem/.test(s)) return "masculino";
  return "não informado";
}
const brDate = (iso: string) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso.slice(0, 10); } };

export async function GET(_req: Request, ctx: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  const { email } = await ctx.params;
  const access = await resolvePatientAccess(email);
  if (!access || !doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const [labs, notes, docs, profile, mark] = await Promise.all([
    getLabResults(access.key),
    getClinicalNotes(access.key),
    getDocuments(access.key),
    getProfile(access.key),
    getCase(doctorId, access.key),
  ]);
  const data = profile?.data || {};
  const age = ageFrom(access.birthdate);
  const sex = sexLabel(access.sex);

  // Apresentação
  const drc = String(data.drc || "") === "sim";
  const estagio = data.estagio_g ? ` (estágio ${data.estagio_g}${data.categoria_a ? `, albuminúria ${data.categoria_a}` : ""})` : "";
  const etioLabel = ETIOLOGIAS.find((e) => e.value === data.etiologia_principal)?.label;
  const presentation =
    `Paciente ${initials(access.name)}, sexo ${sex}${age != null ? `, ${age} anos` : ""}.` +
    (drc ? ` Doença renal crônica${estagio}${etioLabel ? `, provável etiologia: ${etioLabel}.` : "."}` : "");

  // Antecedentes / comorbidades
  const antecedents = COMORB.filter((c) => String(data[c.key] || "") === "sim").map((c) => c.label);
  const antecedentsText = antecedents.length ? antecedents.join("; ") + "." : "Sem comorbidades estruturadas registradas.";

  // Exames por data (linha do tempo laboratorial)
  const byDate = new Map<string, { label: string; value: number; unit: string }[]>();
  for (const l of labs) {
    const d = new Date(l.measuredAt).toISOString().slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push({ label: labLabel(l.testKey), value: l.value, unit: labUnit(l.testKey) });
  }
  const examDates = Array.from(byDate.keys()).sort();
  const examsText = examDates.length
    ? examDates.map((d) => `${brDate(d)}: ` + byDate.get(d)!.map((e) => `${e.label} ${String(e.value).replace(".", ",")}${e.unit ? " " + e.unit : ""}`).join("; ")).join("\n")
    : "Sem exames registrados.";

  // Evolução (notas), da mais antiga p/ mais recente
  const notesAsc = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const evolutionText = notesAsc.length
    ? notesAsc.map((n) => {
        const parts = [n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join(" ");
        return `${brDate(n.createdAt)}: ${parts || "(evolução sem texto)"}`;
      }).join("\n\n")
    : "Sem evoluções registradas.";

  // Tratamento (documentos: receitas)
  const receitas = docs.filter((d) => d.type === "receita");
  const treatmentText = receitas.length
    ? receitas.map((d) => `${brDate(d.createdAt)}: ${d.title}`).join("\n")
    : "Registrar tratamento(s) realizado(s).";

  // Linha do tempo (eventos reais)
  type Ev = { date: string; kind: string; text: string };
  const events: Ev[] = [];
  for (const n of notesAsc) events.push({ date: n.createdAt.slice(0, 10), kind: "Evolução", text: [n.chiefComplaint, n.assessment].filter(Boolean).join(" — ") || "Consulta/evolução" });
  for (const d of examDates) events.push({ date: d, kind: "Exames", text: byDate.get(d)!.map((e) => e.label).slice(0, 6).join(", ") });
  for (const d of docs) events.push({ date: d.createdAt.slice(0, 10), kind: "Documento", text: `${d.type}: ${d.title}` });
  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    meta: { initials: initials(access.name), age, sex, categories: mark?.categories || [], scientificNote: mark?.note || "" },
    draft: {
      title: `Relato de caso — ${initials(access.name)}`,
      presentation,
      history: mark?.note ? mark.note : "Descreva a história clínica atual do caso.",
      antecedents: antecedentsText,
      exams: examsText,
      evolution: evolutionText,
      treatment: treatmentText,
      outcome: "Descreva o desfecho (melhora/estabilização/progressão/óbito), quando aplicável.",
    },
    timeline: events,
  });
}
