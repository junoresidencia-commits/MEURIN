import { HD_EXAM_LABEL, HD_EXAM_UNIT } from "./hd-labels";
import { parseLabGroups } from "./lab-parser";
import { LAB_NUMBER_RE, parsePtBrLabNumber } from "./lab-number";
import { matchExamCode, normName } from "./hd-store-names";
import { extractLabeledPatientName, softenOcrText } from "./ocr-text";
import type { HdExamCode } from "./hd-types";

export type HdParsedLabItem = {
  exam: string;
  examCode: HdExamCode;
  value: string;
  unit: string;
  date?: string;
  name?: string;
  patientId?: string;
  confidence: number;
};

const LAB_KEY_TO_HD: Record<string, HdExamCode> = {
  hemoglobina: "hb",
  hematocrito: "ht",
  ferritina: "ferritin",
  sat_transferrina: "tsat",
  ferro_serico: "serum_iron",
  calcio: "ca",
  fosforo: "p",
  pth: "pth",
  potassio: "k",
  albumina: "albumin",
  bicarbonato: "hco3",
  ureia: "urea_pre",
  creatinina: "creat",
  sodio: "na",
};

function ureaCode(raw: string): HdExamCode {
  const u = normName(raw);
  if (/POS|PÓS|POST/.test(u)) return "urea_post";
  return "urea_pre";
}

function addItem(
  out: HdParsedLabItem[],
  seen: Set<string>,
  item: Omit<HdParsedLabItem, "exam" | "unit"> & { exam?: string }
) {
  const key = `${item.date || ""}:${item.examCode}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    exam: item.exam || HD_EXAM_LABEL[item.examCode],
    examCode: item.examCode,
    value: item.value,
    unit: HD_EXAM_UNIT[item.examCode],
    date: item.date,
    name: item.name,
    patientId: item.patientId,
    confidence: item.confidence,
  });
}

function tokensOf(s: string): string[] {
  return normName(s)
    .split(/[^A-Z]+/)
    .filter((t) => t.length > 2);
}

function tokenClose(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let miss = 0;
  const max = Math.max(a.length, b.length);
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) if (a[i] !== b[i]) miss += 1;
  miss += max - min;
  return miss <= 1;
}

function nameMatchesText(name: string, folded: string, tokens: string[]): boolean {
  const n = normName(name);
  if (!n || n.length < 4) return false;
  if (folded.includes(n)) return true;
  const parts = n.split(" ").filter((x) => x.length > 2);
  if (parts.length < 2) return tokens.some((t) => tokenClose(t, n));
  const first = parts[0];
  const last = parts[parts.length - 1];
  const firstHit = folded.includes(first) || tokens.some((t) => tokenClose(t, first));
  const lastHit = folded.includes(last) || tokens.some((t) => tokenClose(t, last));
  return firstHit && lastHit;
}

/** Pacientes cujo nome aparece no laudo. Não inventa cadastro. */
export function matchPatientsInText<T extends { id: string; name: string }>(
  text: string,
  patients: T[]
): T[] {
  const softened = softenOcrText(text);
  const folded = normName(softened);
  if (!folded) return [];
  const tokens = tokensOf(softened);
  const labeled = extractLabeledPatientName(softened);
  const hits: T[] = [];
  for (const p of patients) {
    if (nameMatchesText(p.name, folded, tokens)) {
      hits.push(p);
      continue;
    }
    if (labeled && nameMatchesText(p.name, normName(labeled), tokensOf(labeled))) {
      hits.push(p);
    }
  }
  return hits;
}

/**
 * Lê exames e datas do texto do laudo (PDF digital, OCR ou colagem).
 * Só devolve o que o texto traz — não inventa valor, data nem paciente.
 */
export function parseHdLabsFromText(
  text: string,
  patients: Array<{ id: string; name: string }> = [],
  forcedPatientId?: string
): {
  items: HdParsedLabItem[];
  needsPatient: boolean;
  matched: Array<{ id: string; name: string }>;
  date?: string;
} {
  const raw = softenOcrText(String(text || "")).trim();
  if (!raw) return { items: [], needsPatient: !forcedPatientId, matched: [] };

  const forced = forcedPatientId
    ? patients.find((p) => p.id === forcedPatientId)
    : undefined;
  const matched = forced ? [forced] : matchPatientsInText(raw, patients);
  const patient = matched.length === 1 ? matched[0] : undefined;
  const needsPatient = !patient;

  const items: HdParsedLabItem[] = [];
  const seen = new Set<string>();
  let firstDate: string | undefined;

  for (const group of parseLabGroups(raw)) {
    if (group.date && !firstDate) firstDate = group.date;
    for (const lab of group.labs) {
      let code = LAB_KEY_TO_HD[lab.testKey];
      if (!code) continue;
      if (lab.testKey === "ureia") code = ureaCode(lab.raw || lab.label);
      const value = Number.isFinite(lab.value) ? String(lab.value).replace(".", ",") : "";
      if (!value) continue;
      addItem(items, seen, {
        exam: HD_EXAM_LABEL[code],
        examCode: code,
        value,
        date: group.date,
        name: patient?.name,
        patientId: patient?.id,
        confidence: group.date ? 82 : 70,
      });
    }
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 180) continue;
    const num = trimmed.match(LAB_NUMBER_RE);
    if (!num || num.index == null) continue;
    const label = trimmed.slice(0, num.index).trim();
    if (!label) continue;
    const code = matchExamCode(label);
    if (!code) continue;
    const valueNum = parsePtBrLabNumber(num[1]);
    if (!Number.isFinite(valueNum)) continue;
    const dateMatch = trimmed.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    let date: string | undefined;
    if (dateMatch) {
      const y = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      const dd = Number(dateMatch[1]);
      const mm = Number(dateMatch[2]);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
        date = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        if (!firstDate) firstDate = date;
      }
    }
    addItem(items, seen, {
      exam: HD_EXAM_LABEL[code],
      examCode: code,
      value: String(valueNum).replace(".", ","),
      date: date || firstDate,
      name: patient?.name,
      patientId: patient?.id,
      confidence: date || firstDate ? 80 : 68,
    });
  }

  if (firstDate) {
    for (const it of items) if (!it.date) it.date = firstDate;
  }

  return { items, needsPatient, matched, date: firstDate };
}
