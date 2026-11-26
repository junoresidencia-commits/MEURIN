/**
 * Primeira consulta — regras KDIGO/pesquisa (client-safe).
 * Não inventa dado: exame só entra se houver registro com data.
 * Exames trazidos (measuredAt ≤ consulta) nunca se misturam com os pedidos depois.
 */

export const FIRST_VISIT_STUDY_ID = "primeira-consulta";

export type VisitCertainty = "confirmada" | "provavel" | "incerta";
export type ExamStatus = "disponivel" | "nao_apresentado" | "solicitado_apos" | "sem_registro";

export const VISIT_CERTAINTY_LABEL: Record<VisitCertainty, string> = {
  confirmada: "Primeira consulta confirmada",
  provavel: "Provável primeira consulta",
  incerta: "Não foi possível confirmar que foi a primeira consulta",
};

export const CARE_REASON_LABEL: Record<string, string> = {
  pressa: "Urgência / prioridade",
  acompanhamento: "Acompanhamento / encaminhamento",
  segunda_opiniao: "Segunda opinião",
  outro: "Outro motivo",
};

/** Exames da chegada — catálogo fixo da pesquisa de primeira consulta. */
export const FIRST_VISIT_EXAMS = [
  { key: "creatinina", label: "Creatinina", labKeys: ["creatinina"] },
  { key: "ureia", label: "Ureia", labKeys: ["ureia"] },
  { key: "eas", label: "Sumário de urina", labKeys: [] },
  { key: "rac", label: "Relação albumina/creatinina", labKeys: ["rac"] },
  { key: "proteinuria_24h", label: "Proteinúria de 24 horas", labKeys: ["proteinuria_24h"] },
  { key: "potassio", label: "Potássio", labKeys: ["potassio"] },
  { key: "hemograma", label: "Hemograma", labKeys: ["hemoglobina", "hematocrito", "leucocitos", "plaquetas"] },
  { key: "hba1c", label: "Hemoglobina glicada", labKeys: ["hba1c"] },
  { key: "calcio", label: "Cálcio", labKeys: ["calcio", "calcio_ionico"] },
  { key: "fosforo", label: "Fósforo", labKeys: ["fosforo"] },
  { key: "pth", label: "PTH", labKeys: ["pth"] },
  { key: "bicarbonato", label: "Bicarbonato", labKeys: ["bicarbonato"] },
  { key: "usg_renal", label: "Ultrassonografia renal", labKeys: [] },
  { key: "outros", label: "Outros exames apresentados", labKeys: [] },
] as const;

export type FirstVisitExamKey = (typeof FIRST_VISIT_EXAMS)[number]["key"];

const CORE_LAB = new Set<string>([
  ...FIRST_VISIT_EXAMS.flatMap((e) => e.labKeys),
  "tfge",
  "tfge_cistatina",
  "cistatina_c",
]);

export type LabPoint = {
  testKey: string;
  value: number;
  unit?: string | null;
  measuredAt: string;
  origin?: string | null;
};

export type ExamAtArrival = {
  key: string;
  label: string;
  status: ExamStatus;
  measuredAt: string | null;
  value: string | null;
  unit: string | null;
  altered: boolean | null;
  requestedAfter: boolean;
};

export type FirstVisitAnchor = {
  visitAt: string;
  source: "booking" | "nota" | "cadastro";
  bookingId: string | null;
  noteId: string | null;
  careReason: string | null;
  courtesyKind: string | null;
  locationName: string | null;
  patientCity: string | null;
  certainty: VisitCertainty;
  certaintyReason: string;
};

export type BookingLite = {
  id: string;
  doctorId: string;
  patientEmail: string;
  patientCity?: string | null;
  careReason?: string | null;
  slotStart: string;
  status?: string | null;
  stage?: string | null;
  courtesyKind?: string | null;
  locationId?: string | null;
  locationName?: string | null;
};

export type NoteLite = {
  id: string;
  doctorId: string;
  createdAt: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Mesmo dia da consulta ainda conta como exame trazido. */
export const ARRIVAL_GRACE_MS = 12 * HOUR;
/** Exames de até 18 meses antes entram como “trouxe na chegada”. */
export const ARRIVAL_LOOKBACK_MS = 548 * DAY;

export function isCancelledVisit(b: BookingLite): boolean {
  const st = String(b.status || "");
  const stage = String(b.stage || "");
  return st === "cancelled" || stage === "cancelada" || stage === "nao_realizada";
}

/** Retorno inequívoco: cortesia de retorno. careReason=acompanhamento NÃO basta (é o padrão do agendamento). */
export function isReturnBooking(b: BookingLite): boolean {
  return b.courtesyKind === "retorno";
}

function tOf(iso: string): number {
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : 0;
}

/**
 * Uma âncora por paciente: o primeiro atendimento NÃO-retorno.
 * Se só houver retorno registrado, usa esse horário e marca incerteza.
 */
export function pickFirstVisit(input: {
  bookings: BookingLite[];
  notes: NoteLite[];
  doctorId: string;
  registeredAt?: string | null;
}): FirstVisitAnchor | null {
  const bookings = (input.bookings || [])
    .filter((b) => !isCancelledVisit(b))
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  const notes = (input.notes || [])
    .filter((n) => n.doctorId === input.doctorId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const firstNonReturn = bookings.find((b) => !isReturnBooking(b)) || null;
  const firstAny = bookings[0] || null;
  const firstNote = notes[0] || null;

  if (firstNonReturn) {
    const noteSameDay = firstNote && Math.abs(tOf(firstNote.createdAt) - tOf(firstNonReturn.slotStart)) <= DAY;
    const reason = firstNonReturn.careReason || "";
    let certainty: VisitCertainty = "provavel";
    let certaintyReason = "Primeiro horário registrado com este médico. O motivo padrão do agendamento não distingue consulta de retorno.";
    if (reason === "pressa" || reason === "segunda_opiniao" || reason === "outro") {
      certainty = "confirmada";
      certaintyReason = `Primeiro atendimento registrado (${CARE_REASON_LABEL[reason] || reason}), sem retorno anterior.`;
    } else if (firstNonReturn.courtesyKind === "gratis") {
      certainty = "confirmada";
      certaintyReason = "Primeira consulta (cortesia de consulta nova), sem retorno anterior.";
    } else if (noteSameDay) {
      certainty = "confirmada";
      certaintyReason = "Primeiro horário e primeira evolução neste médico coincidem no mesmo dia.";
    } else if (bookings.some((b) => isReturnBooking(b) && b.slotStart > firstNonReturn.slotStart)) {
      certainty = "confirmada";
      certaintyReason = "Há retorno posterior; este é o primeiro atendimento não-retorno.";
    }
    return {
      visitAt: firstNonReturn.slotStart,
      source: "booking",
      bookingId: firstNonReturn.id,
      noteId: noteSameDay ? firstNote!.id : firstNote && firstNote.createdAt <= firstNonReturn.slotStart ? firstNote.id : null,
      careReason: firstNonReturn.careReason || null,
      courtesyKind: firstNonReturn.courtesyKind || null,
      locationName: firstNonReturn.locationName || null,
      patientCity: firstNonReturn.patientCity || null,
      certainty,
      certaintyReason,
    };
  }

  if (firstAny && isReturnBooking(firstAny)) {
    return {
      visitAt: firstAny.slotStart,
      source: "booking",
      bookingId: firstAny.id,
      noteId: firstNote?.id || null,
      careReason: firstAny.careReason || null,
      courtesyKind: firstAny.courtesyKind || null,
      locationName: firstAny.locationName || null,
      patientCity: firstAny.patientCity || null,
      certainty: "incerta",
      certaintyReason: "O único atendimento registrado é um retorno. Não dá para confirmar que foi a primeira consulta.",
    };
  }

  if (firstNote) {
    return {
      visitAt: firstNote.createdAt,
      source: "nota",
      bookingId: null,
      noteId: firstNote.id,
      careReason: null,
      courtesyKind: null,
      locationName: null,
      patientCity: null,
      certainty: "incerta",
      certaintyReason: "Há evolução neste médico, mas não há consulta agendada. Não dá para confirmar que foi a primeira consulta.",
    };
  }

  if (input.registeredAt) {
    return {
      visitAt: input.registeredAt,
      source: "cadastro",
      bookingId: null,
      noteId: null,
      careReason: null,
      courtesyKind: null,
      locationName: null,
      patientCity: null,
      certainty: "incerta",
      certaintyReason: "Paciente cadastrado, sem consulta nem evolução. Data de cadastro usada só como referência.",
    };
  }
  return null;
}

export function identityKey(cpf?: string | null, clinicalKey?: string | null): string {
  const digits = String(cpf || "").replace(/\D/g, "");
  if (digits.length === 11) return `cpf:${digits}`;
  return `key:${String(clinicalKey || "").toLowerCase().trim()}`;
}

export function splitLabsAtVisit(labs: LabPoint[], visitAt: string): { brought: LabPoint[]; after: LabPoint[] } {
  const t = tOf(visitAt);
  const brought: LabPoint[] = [];
  const after: LabPoint[] = [];
  for (const l of labs) {
    const lt = tOf(l.measuredAt);
    if (!lt) continue;
    if (lt <= t + ARRIVAL_GRACE_MS && lt >= t - ARRIVAL_LOOKBACK_MS) brought.push(l);
    else if (lt > t + ARRIVAL_GRACE_MS) after.push(l);
  }
  return { brought, after };
}

function latestByKey(labs: LabPoint[], keys: string[]): LabPoint | null {
  let hit: LabPoint | null = null;
  const set = new Set(keys);
  for (const l of labs) {
    if (!set.has(l.testKey) || !Number.isFinite(l.value)) continue;
    if (!hit || l.measuredAt > hit.measuredAt) hit = l;
  }
  return hit;
}

function fmtNum(n: number): string {
  return String(n).replace(".", ",");
}

/** Limites conservadores para “alterado” na chegada. Sem sexo, usa o corte mais amplo. */
export function examAltered(key: string, value: number, sex?: string | null): boolean | null {
  if (!Number.isFinite(value)) return null;
  const female = /^f|fem|mulher/i.test(String(sex || ""));
  switch (key) {
    case "creatinina":
      return female ? value > 1.1 : value > 1.3;
    case "ureia":
      return value > 50;
    case "rac":
      return value >= 30;
    case "proteinuria_24h":
      return value > 150;
    case "potassio":
      return value < 3.5 || value > 5.0;
    case "hemograma":
      return female ? value < 12 : value < 13;
    case "hba1c":
      return value >= 6.5;
    case "calcio":
      return value < 8.4 || value > 10.5;
    case "fosforo":
      return value > 4.5;
    case "pth":
      return value > 65;
    case "bicarbonato":
      return value < 22;
    default:
      return null;
  }
}

const USG_RE = /\b(usg|ultrasson\w*|eco(?:grafia)?\s*renal|rins?\s+e\s+vias|us\s*rins)\b/i;
const EAS_RE = /\b(eas|urina\s*tipo\s*1|sumario\s+de\s+urina|exame\s+de\s+urina|fita\s+(de\s+)?urina)\b/i;
const NO_EXAM_RE = /\b(sem\s+exames?|chegou\s+sem\s+exame|nao\s+trouxe\s+exame|nenhum\s+exame)\b/i;

export function textHasUsg(text: string): boolean {
  return USG_RE.test(text || "");
}
export function textHasEas(text: string): boolean {
  return EAS_RE.test(text || "");
}
export function textSaysNoExams(text: string): boolean {
  return NO_EXAM_RE.test((text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
}

export function parseBloodPressure(text: string): { systolic: number; diastolic: number } | null {
  const t = text || "";
  const m =
    /(?:pa|pressao(?:\s+arterial)?)\s*[:\-]?\s*(\d{2,3})\s*[x\/]\s*(\d{2,3})/i.exec(t) ||
    /\b(\d{2,3})\s*[x\/]\s*(\d{2,3})\s*(?:mmhg)?\b/i.exec(t);
  if (!m) return null;
  const systolic = Number(m[1]);
  const diastolic = Number(m[2]);
  if (systolic < 70 || systolic > 260 || diastolic < 40 || diastolic > 160) return null;
  if (systolic <= diastolic) return null;
  return { systolic, diastolic };
}

export function municipioFromAddress(raw?: string | null, bookingCity?: string | null): string {
  const city = String(bookingCity || "").trim();
  const s = String(raw || "").trim();
  if (city && (!s || s.length > 80)) return city;
  if (!s) return city;
  const noCep = s.replace(/\b\d{5}-?\d{3}\b/g, "").trim();
  const parts = noCep.split(/[,/\n]/).map((p) => p.replace(/\s*-\s*[A-Za-z]{2}\s*$/, "").trim()).filter(Boolean);
  if (parts.length === 1 && !/\d/.test(parts[0]) && parts[0].length <= 40) return parts[0];
  const last = [...parts].reverse().find((p) => p.length >= 3 && p.length <= 40 && !/^(rua|av|avenida|r\.|n[ºo°]|apto|cep)$/i.test(p));
  return last || city || s.slice(0, 40);
}

export type ClassifyExamInput = {
  labsBrought: LabPoint[];
  labsAfter: LabPoint[];
  noteText?: string;
  easFromNote?: { proteinuria?: string | null; hematuria?: string | null };
  usgBrought?: { at: string | null; label?: string | null };
  usgAfter?: boolean;
  sex?: string | null;
  saidNoExams?: boolean;
};

function examFromLab(def: (typeof FIRST_VISIT_EXAMS)[number], brought: LabPoint[], after: LabPoint[], sex?: string | null): ExamAtArrival {
  const hit = latestByKey(brought, [...def.labKeys]);
  const later = latestByKey(after, [...def.labKeys]);
  if (hit) {
    const displayKey = def.key === "hemograma" ? "hemograma" : def.key;
    const valueNum = def.key === "hemograma" ? (latestByKey(brought, ["hemoglobina"])?.value ?? hit.value) : hit.value;
    return {
      key: def.key,
      label: def.label,
      status: "disponivel",
      measuredAt: hit.measuredAt,
      value: fmtNum(valueNum),
      unit: hit.unit || null,
      altered: examAltered(displayKey, valueNum, sex),
      requestedAfter: Boolean(later),
    };
  }
  if (later) {
    return {
      key: def.key,
      label: def.label,
      status: "solicitado_apos",
      measuredAt: later.measuredAt,
      value: fmtNum(later.value),
      unit: later.unit || null,
      altered: examAltered(def.key === "hemograma" ? "hemograma" : def.key, later.value, sex),
      requestedAfter: true,
    };
  }
  return {
    key: def.key,
    label: def.label,
    status: "sem_registro",
    measuredAt: null,
    value: null,
    unit: null,
    altered: null,
    requestedAfter: false,
  };
}

export function classifyArrivalExams(input: ClassifyExamInput): ExamAtArrival[] {
  const saidNo = input.saidNoExams || textSaysNoExams(input.noteText || "");
  const out: ExamAtArrival[] = [];
  for (const def of FIRST_VISIT_EXAMS) {
    if (def.key === "eas") {
      const fita = input.easFromNote;
      const mentioned = textHasEas(input.noteText || "");
      const hasFita = Boolean(fita?.proteinuria || fita?.hematuria);
      if (hasFita || mentioned) {
        const bits = [fita?.proteinuria ? `proteína ${fita.proteinuria}` : "", fita?.hematuria ? `sangue ${fita.hematuria}` : ""].filter(Boolean);
        const altered = ["1+", "2+", "3+", "4+"].includes(String(fita?.proteinuria || "")) || ["1+", "2+", "3+", "4+"].includes(String(fita?.hematuria || ""));
        out.push({
          key: "eas",
          label: def.label,
          status: "disponivel",
          measuredAt: null,
          value: bits.join(" · ") || (mentioned ? "mencionado na evolução" : null),
          unit: null,
          altered: hasFita ? altered : null,
          requestedAfter: false,
        });
      } else if (saidNo) {
        out.push({ key: "eas", label: def.label, status: "nao_apresentado", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: false });
      } else {
        out.push({ key: "eas", label: def.label, status: "sem_registro", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: false });
      }
      continue;
    }
    if (def.key === "usg_renal") {
      if (input.usgBrought) {
        out.push({
          key: "usg_renal",
          label: def.label,
          status: "disponivel",
          measuredAt: input.usgBrought.at,
          value: input.usgBrought.label || "apresentada",
          unit: null,
          altered: null,
          requestedAfter: Boolean(input.usgAfter),
        });
      } else if (textHasUsg(input.noteText || "")) {
        out.push({ key: "usg_renal", label: def.label, status: "disponivel", measuredAt: null, value: "mencionada na evolução", unit: null, altered: null, requestedAfter: Boolean(input.usgAfter) });
      } else if (input.usgAfter) {
        out.push({ key: "usg_renal", label: def.label, status: "solicitado_apos", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: true });
      } else if (saidNo) {
        out.push({ key: "usg_renal", label: def.label, status: "nao_apresentado", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: false });
      } else {
        out.push({ key: "usg_renal", label: def.label, status: "sem_registro", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: false });
      }
      continue;
    }
    if (def.key === "outros") {
      const extraBrought = input.labsBrought.filter((l) => !CORE_LAB.has(l.testKey));
      const extraAfter = input.labsAfter.filter((l) => !CORE_LAB.has(l.testKey));
      const names = [...new Set(extraBrought.map((l) => l.testKey))];
      if (names.length) {
        out.push({
          key: "outros",
          label: def.label,
          status: "disponivel",
          measuredAt: extraBrought[extraBrought.length - 1]?.measuredAt || null,
          value: names.join(", "),
          unit: null,
          altered: null,
          requestedAfter: extraAfter.length > 0,
        });
      } else if (extraAfter.length) {
        out.push({
          key: "outros",
          label: def.label,
          status: "solicitado_apos",
          measuredAt: extraAfter[0].measuredAt,
          value: [...new Set(extraAfter.map((l) => l.testKey))].join(", "),
          unit: null,
          altered: null,
          requestedAfter: true,
        });
      } else {
        out.push({ key: "outros", label: def.label, status: saidNo ? "nao_apresentado" : "sem_registro", measuredAt: null, value: null, unit: null, altered: null, requestedAfter: false });
      }
      continue;
    }
    const row = examFromLab(def, input.labsBrought, input.labsAfter, input.sex);
    if (row.status === "sem_registro" && saidNo) row.status = "nao_apresentado";
    out.push(row);
  }
  return out;
}

const WORKUP = new Set(["creatinina", "eas", "rac", "proteinuria_24h"]);

export function arrivedWithoutExams(exams: ExamAtArrival[]): boolean {
  return exams.filter((e) => e.key !== "outros").every((e) => e.status !== "disponivel");
}

/** Investigação incompleta na chegada: falta creatinina ou falta todo o eixo urinário (EAS/RAC/24h). */
export function incompleteWorkup(exams: ExamAtArrival[]): boolean {
  const by = new Map(exams.map((e) => [e.key, e]));
  const creat = by.get("creatinina")?.status === "disponivel";
  const urine = ["eas", "rac", "proteinuria_24h"].some((k) => by.get(k)?.status === "disponivel");
  void WORKUP;
  return !creat || !urine;
}

export function advancedKidneyDisease(opts: { tfge?: number | null; estagioG?: string | null }): boolean {
  if (opts.tfge != null && Number.isFinite(opts.tfge) && opts.tfge < 30) return true;
  const g = String(opts.estagioG || "");
  return g === "G4" || g === "G5";
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}
