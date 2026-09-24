import assert from "node:assert/strict";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { readDb } from "../src/lib/store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";
import { calcKtv, calcUrr, parseHours, parseLocaleNumber } from "../src/lib/hd-calcs";
import { evaluateHdLabs, DEFAULT_HD_RULES } from "../src/lib/hd-rules";
import { parseSalaBrancaWorkbook, buildSalaBrancaWorkbook } from "../src/lib/hd-xlsx";
import { hdPerm, HD_ROLE_DEFAULTS } from "../src/lib/hd-access";
import type { HdActor, HdMember, HdRule } from "../src/lib/hd-types";
import {
  ensureHdSession,
  hdAddLabs,
  hdAddMember,
  hdCloseMonth,
  hdExportXlsx,
  hdImportSalaBranca,
  hdListAudit,
  hdListMap,
  hdPeekMenu,
  hdReviewPatient,
  hdUpdateMapCell,
  hdUpdateMember,
  requireHd,
} from "../src/lib/hd-store";

function buildFixture(): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ["", "DIACENTER TESTE"],
    ["", "DISTRIBUIÇÃO DE PACIENTES"],
    ["", "1º TURNO - SEGUNDA | QUARTA | SEXTA"],
    [],
    ["ALA 1"],
    ["MÁQ", "PACIENTE", "HEPARINA", "TEMPO", "ACESSO", "CAPILAR", "ALFAEPOETINA", "SAC. FÉRRICO", "SEVELÂMER", "CALCITRIOL", "CINACALCETE", "PARICALCITOL"],
    ["1", "MARIA TESTE HD", "5,000", "4:00 H", "FAV 16", "B20-H", "1amp 3x/sem", "1amp 1x/sem", "1comp 3x/dia", "", "", ""],
    ["2", "JOAO TESTE HD (PERM)", "6,000", "3:30 H", "PERM", "B18-H", "", "", "", "", "", ""],
    [],
    ["", "Atualização: 12/09/2026", "Assinatura Médico: ____________________________"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "TURNO 1 SEGUNDA");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }
  const hdFile = path.join(process.cwd(), "data", "hemodialise.json");
  try { unlinkSync(hdFile); } catch { /* ok */ }

  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  const ana = db0.doctors.find((d) => d.email === "ana@meurim.com");
  assert.ok(carlos && ana, "seed de médicos permanece");

  assert.equal(parseLocaleNumber("9,1"), 9.1);
  assert.equal(calcUrr(150, 50), 66.7);
  assert.equal(calcUrr(null, 50), null);
  assert.equal(calcKtv(150, 50, null), null);
  assert.ok((calcKtv(150, 45, parseHours("4:00 H")) ?? 0) > 1);
  const rules = DEFAULT_HD_RULES.map((r, i) => ({ ...r, id: String(i) })) as HdRule[];
  const crit = evaluateHdLabs({ hb: 7.2, p: 7.4, k: 6.8 }, rules);
  assert.ok(crit.some((a) => a.level === "CRITICO" && a.code === "ANEMIA-HB-CRIT"));
  assert.ok(crit.some((a) => a.code === "K-CRIT"));
  assert.equal(evaluateHdLabs({ hb: 11 }, rules).length, 0);

  const actor: HdActor = { doctorId: carlos.id, name: carlos.name, email: carlos.email, isSuperAdmin: false };
  const peek0 = await hdPeekMenu(actor);
  assert.equal(peek0.allowed, true);

  const ses = await ensureHdSession(actor);
  assert.ok(ses.unit && ses.member);
  assert.equal(ses.member.role, "ADMIN");
  const ctx = await requireHd(actor, "manage_team");
  assert.ok(ctx);

  const realPath = "/home/ubuntu/.cursor/projects/workspace/uploads/Mapa_Sala_Branca__f140.xlsx";
  try {
    const real = parseSalaBrancaWorkbook(readFileSync(realPath));
    assert.ok(real.rows.length > 80, `mapa real deveria ter dezenas de pacientes, veio ${real.rows.length}`);
    assert.ok(real.rows.every((r) => r.machine && r.name && r.shift));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const parsed = parseSalaBrancaWorkbook(buildFixture());
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].name, "MARIA TESTE HD");
  assert.equal(parsed.rows[1].notes, "PERM");
  const imported = await hdImportSalaBranca(ctx, buildFixture(), "mapa-teste.xlsx");
  assert.equal(imported.imported, 2);
  assert.equal(imported.created, 2);

  const map = await hdListMap(ctx, 2026, 9);
  assert.equal(map.rows.length, 2);
  const maria = map.rows.find((r) => r.patientName === "MARIA TESTE HD");
  assert.ok(maria);
  const moved = await hdUpdateMapCell(ctx, maria.id, "machine", "7");
  assert.equal(moved.machine, "7");

  const labs = await hdAddLabs(ctx, [
    { patientId: maria.patientId, exam: "Hemoglobina", value: "8,9", source: "manual" },
    { patientId: maria.patientId, exam: "Fósforo", value: "6,2", source: "ocr", confidence: 70 },
  ], 2026, 9);
  assert.equal(labs.created, 2);
  assert.equal(labs.pending, 1);

  await hdReviewPatient(ctx, { patientId: maria.patientId, decision: "manter", year: 2026, month: 9, notes: "Manter EPO" });
  const closed = await hdCloseMonth(ctx, 2026, 9);
  assert.equal(closed.status, "closed");
  await assert.rejects(() => hdUpdateMapCell(ctx, maria.id, "heparin", "4,000"), /justificativa/i);
  await hdUpdateMapCell(ctx, maria.id, "heparin", "4,000", "Ajuste após fechamento");

  const nurse = await hdAddMember(ctx, { email: ana.email, role: "ENFERMAGEM", functionLabel: "Enfermeira" });
  assert.equal(nurse.status, "active");
  const fakeNurse: HdMember = {
    id: "n1",
    unitId: ctx.unit.id,
    doctorId: ana.id,
    email: ana.email,
    name: ana.name,
    role: "ENFERMAGEM",
    functionLabel: "Enfermeira",
    status: "active",
    permissions: { edit_heparin: false },
    lastAccessAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(hdPerm(fakeNurse, "view_map"), true);
  assert.equal(hdPerm(fakeNurse, "edit_heparin"), false);
  assert.equal(hdPerm(fakeNurse, "edit_prescription"), false);
  assert.equal(HD_ROLE_DEFAULTS.LABORATORIO.view_map, false);

  await hdUpdateMember(ctx, nurse.id, { status: "inactive" });
  const anaActor: HdActor = { doctorId: ana.id, name: ana.name, email: ana.email, isSuperAdmin: false };
  const peekAna = await hdPeekMenu(anaActor);
  assert.equal(peekAna.allowed, false);

  const audit = await hdListAudit(ctx);
  assert.ok(audit.some((a) => a.action === "import_xlsx"));
  assert.ok(audit.some((a) => a.action === "deactivate_member"));
  assert.ok(audit.some((a) => a.action === "close_month"));
  const deactivatedStillThere = audit.find((a) => a.action === "deactivate_member");
  assert.ok(deactivatedStillThere);

  const xlsx = await hdExportXlsx(ctx, 2026, 9);
  const round = parseSalaBrancaWorkbook(xlsx);
  assert.ok(round.rows.length >= 2);
  const rebuilt = buildSalaBrancaWorkbook({
    unitName: "DIACENTER TESTE",
    updatedLabel: "24/09/2026",
    rows: map.rows,
  });
  assert.ok(rebuilt.length > 100);

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, `contagens do Meu Rim não podem cair: ${dropped.join(", ")}`);

  console.log("ok hemodialise", {
    imported: imported.imported,
    audit: audit.length,
    doctors: after.doctors,
    patients: after.patients,
  });
  void readFileSync;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
