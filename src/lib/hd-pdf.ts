import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { HD_SHIFT_LABEL, HD_WEEKDAY_LABEL, monthLabel } from "./hd-labels";
import type { HdMapRow, HdShift, HdWeekdayGroup } from "./hd-types";

const COLS = [
  { k: "machine", h: "Máq", w: 28 },
  { k: "patientName", h: "Paciente", w: 150 },
  { k: "access", h: "Acesso", w: 48 },
  { k: "heparin", h: "Heparina", w: 48 },
  { k: "time", h: "Tempo", w: 40 },
  { k: "capillary", h: "Capilar", w: 48 },
  { k: "epo", h: "EPO", w: 62 },
  { k: "iron", h: "Ferro", w: 58 },
  { k: "sevelamer", h: "Sevelâmer", w: 58 },
  { k: "calcitriol", h: "Calcitriol", w: 52 },
  { k: "cinacalcet", h: "Cinacalcete", w: 58 },
  { k: "paricalcitol", h: "Paricalcitol", w: 58 },
] as const;

export async function buildHdMapPdf(opts: {
  unitName: string;
  year: number;
  month: number;
  rows: Array<HdMapRow & { patientName: string }>;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 841.89;
  const pageH = 595.28;
  const margin = 28;

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
      .sort((a, b) => Number(a.machine) - Number(b.machine));
    if (subset.length === 0) continue;
    const wards = [...new Set(subset.map((r) => r.ward || "ALA 1"))];

    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;
    const title = `${opts.unitName} · Mapa ${monthLabel(opts.year, opts.month)}`;
    const sub = `${HD_SHIFT_LABEL[shift]} · ${HD_WEEKDAY_LABEL[weekdayGroup]}`;
    page.drawText(title, { x: margin, y, size: 14, font: bold, color: rgb(0.03, 0.18, 0.27) });
    y -= 16;
    page.drawText(sub, { x: margin, y, size: 10, font, color: rgb(0.03, 0.48, 0.51) });
    y -= 18;

    const drawHeader = () => {
      let x = margin;
      for (const c of COLS) {
        page.drawText(c.h, { x, y, size: 7, font: bold, color: rgb(0.05, 0.2, 0.28) });
        x += c.w;
      }
      y -= 12;
    };

    for (const ward of wards) {
      if (y < 50) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(ward, { x: margin, y, size: 9, font: bold, color: rgb(0.03, 0.48, 0.51) });
      y -= 12;
      drawHeader();
      for (const r of subset.filter((row) => (row.ward || "ALA 1") === ward)) {
        if (y < 36) {
          page = doc.addPage([pageW, pageH]);
          y = pageH - margin;
          drawHeader();
        }
        let x = margin;
        const rec = r as unknown as Record<string, string>;
        for (const c of COLS) {
          const text = String(rec[c.k] || "").slice(0, 28);
          page.drawText(text, { x, y, size: 7, font, color: rgb(0.1, 0.18, 0.22) });
          x += c.w;
        }
        y -= 11;
      }
      y -= 8;
    }
  }

  if (doc.getPageCount() === 0) {
    const page = doc.addPage([pageW, pageH]);
    page.drawText("Mapa sem pacientes neste mês.", {
      x: margin,
      y: pageH - 60,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
