import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { readDb, updateDb } from "../src/lib/store";
import { createPatient } from "../src/lib/patients-store";
import { getLme } from "../src/lib/lme-store";
import { getDocumentById } from "../src/lib/patient-store";
import { readFile, DOCPDF_BUCKET } from "../src/lib/doc-storage";
import { DEFAULT_HD_RULES, evaluateHdLabs } from "../src/lib/hd-rules";
import { matchCinacalcetPresentation, matchEpoPresentation, suggestHdDocsFromExams } from "../src/lib/hd-docs-from-exams";
import { printHref, safePdfSrc } from "../src/lib/print-pdf";
import { hdGenerateDocsFromExams, hdPreviewDocsFromExams } from "../src/lib/hd-docs-generate";
import {
  ensureHdSession,
  hdAddLabs,
  hdAddPatient,
  hdListMap,
  hdUpdateMapCell,
  requireHd,
} from "../src/lib/hd-store";
import type { HdActor, HdRule } from "../src/lib/hd-types";

const rules = DEFAULT_HD_RULES.map((r, i) => ({ ...r, id: String(i) })) as HdRule[];

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  assert.equal(matchEpoPresentation("1amp 3x/sem"), null);
  assert.equal(matchEpoPresentation("4000 3x/sem"), "alfaepoetina_4000");
  assert.equal(matchEpoPresentation("10.000 UI"), "alfaepoetina_10000");
  assert.equal(matchEpoPresentation("2.000"), "alfaepoetina_2000");
  assert.equal(matchCinacalcetPresentation("cinacalcete"), null);
  assert.equal(matchCinacalcetPresentation("30 mg"), "cinacalcete_30");
  assert.equal(safePdfSrc("/api/documents/abc/pdf"), "/api/documents/abc/pdf");
  assert.equal(safePdfSrc("https://evil.example/x"), "");
  assert.equal(printHref("/api/lme/1/oficial"), "/imprimir?src=%2Fapi%2Flme%2F1%2Foficial%3Fprint%3D1");
  assert.equal(safePdfSrc("/api/lme/1/oficial?print=1"), "/api/lme/1/oficial?print=1");

  const ferroLabs = evaluateHdLabs({ tsat: 15, ferritin: 80, hb: 11 }, rules);
  const ferro = suggestHdDocsFromExams({
    labs: { tsat: 15, ferritin: 80, hb: 11 },
    alerts: ferroLabs,
    map: { iron: "8 ampolas / mês" },
  });
  assert.equal(ferro.canGenerate, true);
  const ferroPack = ferro.packages.find((p) => p.protocolId === "anemia_drc_ferro");
  assert.ok(ferroPack);
  assert.equal(ferroPack.cid10, "N18.0");
  assert.equal(ferroPack.medications[0]?.medId, "sacarato_ferrico_100");
  assert.equal(ferroPack.medications[0]?.monthlyQty, "8 ampolas / mês");
  assert.ok(!ferroPack.medications.some((m) => /sulfato/i.test(m.name)));

  const semQty = suggestHdDocsFromExams({
    labs: { tsat: 12, ferritin: 90 },
    alerts: evaluateHdLabs({ tsat: 12, ferritin: 90 }, rules),
    map: {},
  });
  const semQtyPack = semQty.packages.find((p) => p.protocolId === "anemia_drc_ferro");
  assert.ok(semQtyPack?.ready);
  assert.equal(semQtyPack?.medications[0]?.monthlyQty, "");

  const epoSemApresentacao = suggestHdDocsFromExams({
    labs: { hb: 9.1 },
    alerts: evaluateHdLabs({ hb: 9.1 }, rules),
    map: { epo: "1amp 3x/sem" },
  });
  const epoPack = epoSemApresentacao.packages.find((p) => p.protocolId === "anemia_drc_alfaepoetina");
  assert.ok(epoPack);
  assert.equal(epoPack.ready, false);
  assert.equal(epoPack.medications.length, 0);

  const epoOk = suggestHdDocsFromExams({
    labs: { hb: 9.1 },
    alerts: evaluateHdLabs({ hb: 9.1 }, rules),
    map: { epo: "4000 3x/sem" },
  });
  assert.equal(epoOk.packages.find((p) => p.protocolId === "anemia_drc_alfaepoetina")?.medications[0]?.medId, "alfaepoetina_4000");

  const dmo = suggestHdDocsFromExams({
    labs: { p: 6.2 },
    alerts: evaluateHdLabs({ p: 6.2 }, rules),
    map: { sevelamer: "1comp 3x/dia" },
  });
  const dmoPack = dmo.packages.find((p) => p.protocolId === "dmo_drc");
  assert.equal(dmoPack?.cid10, "N18.5");
  assert.equal(dmoPack?.medications[0]?.medId, "sevelamer_800");
  assert.equal(dmoPack?.medications[0]?.monthlyQty, "1comp 3x/dia");

  const cin = suggestHdDocsFromExams({
    labs: { pth: 900 },
    alerts: evaluateHdLabs({ pth: 900 }, rules),
    map: { cinacalcet: "cinacalcete" },
  });
  assert.equal(cin.packages.find((p) => p.protocolId === "dmo_drc")?.ready, false);

  const hdFile = path.join(process.cwd(), "data", "hemodialise.json");
  try { unlinkSync(hdFile); } catch { /* ok */ }

  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);
  await updateDb((db) => ({
    ...db,
    doctors: db.doctors.map((d) =>
      d.id === carlos.id
        ? {
            ...d,
            cns: d.cns || "989000000000000",
            locations: [
              ...(d.locations || []),
              { id: "loc-hd-ceaf", name: "Clínica HD Teste", city: "Salvador", type: "clinica", active: true, cnes: "1234567" },
            ],
          }
        : d
    ),
  }));

  const actor: HdActor = { doctorId: carlos.id, name: carlos.name, email: carlos.email, isSuperAdmin: false };
  await ensureHdSession(actor);
  const ctx = await requireHd(actor, "review");
  assert.ok(ctx);

  const cadastro = await createPatient({
    doctorId: carlos.id,
    name: "MARIA LME HD",
    cns: "898000000000000",
    cpf: "52998224725",
    email: "maria.lme.hd@example.com",
  });
  const hd = await hdAddPatient(ctx, { name: "MARIA LME HD", patientId: cadastro.id });
  const map = await hdListMap(ctx, 2026, 9);
  const row = map.rows.find((r: { patientId: string }) => r.patientId === hd.id);
  assert.ok(row);
  await hdUpdateMapCell(ctx, row.id, "iron", "8 ampolas / mês");
  await hdUpdateMapCell(ctx, row.id, "epo", "4000 3x/sem");
  await hdAddLabs(
    ctx,
    [
      { patientId: hd.id, exam: "hb", value: "9,2", confidence: 100, source: "manual" },
      { patientId: hd.id, exam: "tsat", value: "15", confidence: 100, source: "manual" },
      { patientId: hd.id, exam: "ferritin", value: "80", confidence: 100, source: "manual" },
    ],
    2026,
    9
  );

  const preview = await hdPreviewDocsFromExams(ctx, hd.id, 2026, 9);
  assert.ok(preview);
  assert.equal(preview.linked?.cns, "898000000000000");
  assert.equal(preview.establishment?.cnes, "1234567");
  assert.equal(preview.canGenerate, true);
  assert.ok(preview.suggestion.packages.some((p) => p.protocolId === "anemia_drc_ferro" && p.medications[0]?.monthlyQty === "8 ampolas / mês"));
  assert.ok(preview.suggestion.packages.some((p) => p.protocolId === "anemia_drc_alfaepoetina" && p.medications[0]?.medId === "alfaepoetina_4000"));

  const gen = await hdGenerateDocsFromExams(ctx, { patientId: hd.id, year: 2026, month: 9 });
  assert.ok(gen.generated.length >= 2, `esperava 2 LMEs, veio ${gen.generated.length}`);
  const ferroLme = await getLme(gen.generated.find((g) => g.protocolId === "anemia_drc_ferro")!.lmeId);
  assert.ok(ferroLme);
  assert.equal(ferroLme.patientCns, "898000000000000");
  assert.equal(ferroLme.cnes, "1234567");
  assert.equal(ferroLme.cid10, "N18.0");
  assert.equal(ferroLme.medications[0]?.name, "Sacarato de hidróxido férrico 100 mg injetável");
  assert.equal(ferroLme.medications[0]?.monthlyQty, "8 ampolas / mês");
  const ferroGen = gen.generated.find((g) => g.protocolId === "anemia_drc_ferro");
  assert.ok(ferroGen?.receitaId && ferroGen.receitaUrl);
  assert.ok(ferroGen.relatorioId && ferroGen.relatorioUrl);
  assert.ok(ferroGen.terId && ferroGen.terUrl);
  const rxDoc = await getDocumentById(ferroGen.receitaId);
  assert.ok(rxDoc?.pdfPath);
  assert.equal(rxDoc.status, "final");
  const rxFile = await readFile(DOCPDF_BUCKET, rxDoc.pdfStorage || "local", rxDoc.pdfPath);
  assert.ok(rxFile && rxFile.buffer.slice(0, 4).toString() === "%PDF");
  const relDoc = await getDocumentById(ferroGen.relatorioId);
  assert.ok(relDoc?.pdfPath);
  const relFile = await readFile(DOCPDF_BUCKET, relDoc.pdfStorage || "local", relDoc.pdfPath);
  assert.ok(relFile && relFile.buffer.slice(0, 4).toString() === "%PDF");
  const terDoc = await getDocumentById(ferroGen.terId);
  assert.ok(terDoc?.pdfPath);

  const epoLme = await getLme(gen.generated.find((g) => g.protocolId === "anemia_drc_alfaepoetina")!.lmeId);
  assert.ok(epoLme);
  assert.equal(epoLme.medications[0]?.name, "Alfaepoetina 4.000 UI injetável");
  assert.equal(epoLme.medications[0]?.monthlyQty, "4000 3x/sem");

  console.log("ok hd-docs-from-exams", {
    packages: preview.suggestion.packages.map((p) => p.protocolId),
    lmes: gen.generated.map((g) => g.lmeId),
    ter: gen.generated.map((g) => Boolean(g.terId)),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
