import * as XLSX from "xlsx";
import type { HdMapRow, HdShift, HdWeekdayGroup } from "./hd-types";

export type ImportedSalaRow = {
  name: string;
  shift: HdShift;
  weekdayGroup: HdWeekdayGroup;
  ward: string;
  machine: string;
  heparin: string;
  time: string;
  access: string;
  capillary: string;
  epo: string;
  iron: string;
  sevelamer: string;
  calcitriol: string;
  cinacalcet: string;
  paricalcitol: string;
  notes: string;
};

export type ParsedSalaBranca = {
  unitName: string;
  updatedAt: string | null;
  rows: ImportedSalaRow[];
};

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function isHeader(row: unknown[]): boolean {
  const a = cell(row, 0).toUpperCase();
  const b = cell(row, 1).toUpperCase();
  return (a.startsWith("MÁQ") || a === "MAQ" || a.startsWith("MAQ")) && b.startsWith("PACIENTE");
}

function isAla(row: unknown[]): string | null {
  const a = cell(row, 0).toUpperCase();
  if (/^ALA\s*\d/.test(a)) return a.replace(/\s+/g, " ").trim();
  return null;
}

function parseShiftTitle(text: string): { shift: HdShift | null; weekdayGroup: HdWeekdayGroup | null } {
  const u = text.toUpperCase();
  let shift: HdShift | null = null;
  if (u.includes("1º") || u.includes("1°") || u.includes("1O") || u.includes("1º TURNO") || /1[º°O]?\s*TURNO/.test(u)) shift = "MANHA";
  if (u.includes("2º") || u.includes("2°") || /2[º°O]?\s*TURNO/.test(u)) shift = "TARDE";
  if (u.includes("3º") || u.includes("3°") || /3[º°O]?\s*TURNO/.test(u)) shift = "NOITE";
  let weekdayGroup: HdWeekdayGroup | null = null;
  if (u.includes("TERÇA") || u.includes("TERCA") || u.includes("QUINTA") || u.includes("SÁBADO") || u.includes("SABADO")) {
    weekdayGroup = "TER_QUI_SAB";
  } else if (u.includes("SEGUNDA") || u.includes("QUARTA") || u.includes("SEXTA")) {
    weekdayGroup = "SEG_QUA_SEX";
  }
  return { shift, weekdayGroup };
}

function sheetMeta(name: string): { shift: HdShift | null; weekdayGroup: HdWeekdayGroup | null } {
  const u = name.toUpperCase();
  let shift: HdShift | null = null;
  if (u.includes("TURNO 1") || u.includes("TURNO1")) shift = "MANHA";
  if (u.includes("TURNO 2") || u.includes("TURNO2")) shift = "TARDE";
  if (u.includes("TURNO 3") || u.includes("TURNO3")) shift = "NOITE";
  let weekdayGroup: HdWeekdayGroup | null = null;
  if (u.includes("TERÇA") || u.includes("TERCA")) weekdayGroup = "TER_QUI_SAB";
  else if (u.includes("SEGUNDA")) weekdayGroup = "SEG_QUA_SEX";
  return { shift, weekdayGroup };
}

function cleanName(raw: string): { name: string; notes: string } {
  const m = raw.match(/^(.*?)(\s*\((.+)\))\s*$/);
  if (m) return { name: m[1].trim(), notes: m[3].trim() };
  return { name: raw.trim(), notes: "" };
}

export function parseSalaBrancaWorkbook(buf: Buffer | Uint8Array): ParsedSalaBranca {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const rows: ImportedSalaRow[] = [];
  let unitName = "Hemodiálise";
  let updatedAt: string | null = null;

  for (const sheetName of wb.SheetNames) {
    const upper = sheetName.toUpperCase();
    if (upper.startsWith("PLAN") || upper.includes("SALA NOVA")) continue;
    const meta = sheetMeta(sheetName);
    if (!meta.shift || !meta.weekdayGroup) continue;

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];
    let ward = "ALA 1";
    let shift = meta.shift;
    let weekdayGroup = meta.weekdayGroup;
    let inTable = false;

    for (const row of data) {
      const joined = row.map((c) => String(c || "")).join(" ");
      if (/DIACENTER|CLÍNICA|CLINICA/i.test(joined) && cell(row, 1)) {
        const maybe = cell(row, 1);
        if (maybe && maybe.length < 80) unitName = maybe;
      }
      const upd = joined.match(/Atualiza[cç][aã]o:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (upd) updatedAt = upd[1];

      const title = parseShiftTitle(joined);
      if (title.shift) shift = title.shift;
      if (title.weekdayGroup) weekdayGroup = title.weekdayGroup;

      const ala = isAla(row);
      if (ala) {
        ward = ala;
        inTable = false;
        continue;
      }
      if (isHeader(row)) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;

      const machine = cell(row, 0);
      const rawName = cell(row, 1);
      if (!rawName) continue;
      if (!/^\d+$/.test(machine)) continue;
      const { name, notes } = cleanName(rawName);
      if (!name) continue;

      rows.push({
        name,
        shift,
        weekdayGroup,
        ward,
        machine,
        heparin: cell(row, 2),
        time: cell(row, 3),
        access: cell(row, 4),
        capillary: cell(row, 5),
        epo: cell(row, 6),
        iron: cell(row, 7),
        sevelamer: cell(row, 8),
        calcitriol: cell(row, 9),
        cinacalcet: cell(row, 10),
        paricalcitol: cell(row, 11),
        notes,
      });
    }
  }

  return { unitName, updatedAt, rows };
}

export function parseDateBr(raw: string | null): { year: number; month: number } | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

const COLS = [
  "MÁQ",
  "PACIENTE",
  "HEPARINA",
  "TEMPO",
  "ACESSO",
  "CAPILAR",
  "ALFAEPOETINA",
  "SAC. FÉRRICO",
  "SEVELÂMER",
  "CALCITRIOL",
  "CINACALCETE",
  "PARICALCITOL",
];

function sheetKey(shift: HdShift, group: HdWeekdayGroup): string {
  const t = shift === "MANHA" ? "TURNO 1" : shift === "TARDE" ? "TURNO 2" : "TURNO 3";
  const d = group === "SEG_QUA_SEX" ? "SEGUNDA" : "TERÇA";
  return `${t} ${d}`;
}

function titleFor(shift: HdShift, group: HdWeekdayGroup): string {
  const n = shift === "MANHA" ? "1º" : shift === "TARDE" ? "2º" : "3º";
  const days = group === "SEG_QUA_SEX" ? "SEGUNDA | QUARTA | SEXTA" : "TERÇA | QUINTA | SÁBADO";
  return `${n} TURNO - ${days}`;
}

export function buildSalaBrancaWorkbook(opts: {
  unitName: string;
  updatedLabel: string;
  rows: Array<HdMapRow & { patientName: string }>;
}): Buffer {
  const wb = XLSX.utils.book_new();
  const groups: Array<[HdShift, HdWeekdayGroup]> = [
    ["MANHA", "SEG_QUA_SEX"],
    ["TARDE", "SEG_QUA_SEX"],
    ["NOITE", "SEG_QUA_SEX"],
    ["MANHA", "TER_QUI_SAB"],
    ["TARDE", "TER_QUI_SAB"],
    ["NOITE", "TER_QUI_SAB"],
  ];

  for (const [shift, weekdayGroup] of groups) {
    const subset = opts.rows
      .filter((r) => r.shift === shift && r.weekdayGroup === weekdayGroup)
      .sort((a, b) => Number(a.machine) - Number(b.machine) || a.patientName.localeCompare(b.patientName));
    const wards = [...new Set(subset.map((r) => r.ward || "ALA 1"))];
    if (wards.length === 0) wards.push("ALA 1");

    const aoa: (string | number)[][] = [
      ["", opts.unitName],
      ["", "DISTRIBUIÇÃO DE PACIENTES"],
      ["", titleFor(shift, weekdayGroup)],
      [],
    ];

    for (const ward of wards) {
      aoa.push([ward]);
      aoa.push(COLS);
      const inWard = subset.filter((r) => (r.ward || "ALA 1") === ward);
      for (const r of inWard) {
        aoa.push([
          r.machine,
          r.patientName,
          r.heparin,
          r.time,
          r.access,
          r.capillary,
          r.epo,
          r.iron,
          r.sevelamer,
          r.calcitriol,
          r.cinacalcet,
          r.paricalcitol,
        ]);
      }
      aoa.push([]);
    }
    aoa.push([]);
    aoa.push(["", `Atualização: ${opts.updatedLabel}`, "Assinatura Médico: ____________________________"]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetKey(shift, weekdayGroup).slice(0, 31));
  }

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out;
}

export function parseLabSpreadsheet(buf: Buffer | Uint8Array): Array<{
  name: string;
  exam: string;
  value: string;
  unit: string;
  date: string;
}> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out: Array<{ name: string; exam: string; value: string; unit: string; date: string }> = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
    for (const row of rows) {
      const keys = Object.keys(row);
      const pick = (...alts: string[]) => {
        const k = keys.find((x) => alts.some((a) => x.toLowerCase().includes(a)));
        return k ? String(row[k] ?? "").trim() : "";
      };
      const patient = pick("paciente", "nome", "name");
      const exam = pick("exame", "exam", "analito");
      const value = pick("resultado", "valor", "value", "result");
      const unit = pick("unidade", "unit");
      const date = pick("data", "date", "coleta");
      if (patient && exam && value) out.push({ name: patient, exam, value, unit, date });
    }
  }
  return out;
}

