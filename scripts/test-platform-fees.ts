import assert from "node:assert/strict";
import {
  computePlatformFeeCents,
  feeRuleFrom,
  feeSummary,
  normalizeFeeMode,
} from "../src/lib/platform-fees";
import { buildPixBrCode } from "../src/lib/pix-brcode";
import { FOUNDER_SUPER_ADMIN_EMAIL } from "../src/lib/platform-types";
import { doctorFeeRule } from "../src/lib/types";

assert.equal(normalizeFeeMode("gratis"), "gratis");
assert.equal(normalizeFeeMode("por_atendimento"), "por_atendimento");
assert.equal(normalizeFeeMode("por_entrada"), "por_entrada");
assert.equal(normalizeFeeMode("xyz"), "gratis");
assert.equal(normalizeFeeMode(undefined), "gratis");

const gratis = feeRuleFrom({ appFeeMode: "gratis", commissionPercent: 20, entryFeeCents: 1500 });
assert.equal(computePlatformFeeCents(gratis, "atendimento", 20000), 0);
assert.equal(computePlatformFeeCents(gratis, "entrada", 0), 0);
assert.match(feeSummary(gratis), /grátis/i);

const perVisit = feeRuleFrom({ appFeeMode: "por_atendimento", commissionPercent: 10, entryFeeCents: 500 });
assert.equal(computePlatformFeeCents(perVisit, "atendimento", 20000), 2500);
assert.equal(computePlatformFeeCents(perVisit, "entrada", 0), 0);
assert.equal(computePlatformFeeCents(perVisit, "atendimento", 0), 500);
assert.match(feeSummary(perVisit), /10%/);

const onlyPct = feeRuleFrom({ appFeeMode: "por_atendimento", commissionPercent: 15, entryFeeCents: 0 });
assert.equal(computePlatformFeeCents(onlyPct, "atendimento", 10000), 1500);

const entry = feeRuleFrom({ appFeeMode: "por_entrada", commissionPercent: 50, entryFeeCents: 800 });
assert.equal(computePlatformFeeCents(entry, "entrada", 0), 800);
assert.equal(computePlatformFeeCents(entry, "atendimento", 99999), 0);

const returnFreeVisit = feeRuleFrom({ appFeeMode: "por_atendimento", commissionPercent: 10, entryFeeCents: 200 });
assert.equal(computePlatformFeeCents(returnFreeVisit, "atendimento", 0), 200, "retorno grátis ainda pode gerar valor fixo");

const adminPix = buildPixBrCode({
  key: FOUNDER_SUPER_ADMIN_EMAIL,
  holderName: "C.J. ATENDIMENTOS MEDICOS LTDA",
  city: "BRASIL",
  amountCents: 2500,
  txid: "pltana123",
});
assert.ok(adminPix.startsWith("000201"));
assert.match(adminPix, /junoresidencia@gmail\.com/);
assert.match(adminPix, /540525.00/);

const doctorGratis = doctorFeeRule({ commissionPercent: 100, appFeeMode: "gratis", entryFeeCents: 0 });
assert.equal(computePlatformFeeCents(doctorGratis, "atendimento", 35000), 0);
const doctorCut = doctorFeeRule({ commissionPercent: 80, appFeeMode: "por_atendimento", entryFeeCents: 0 });
assert.equal(doctorCut.commissionPercent, 20);
assert.equal(computePlatformFeeCents(doctorCut, "atendimento", 40000), 8000);
const doctorEntry = doctorFeeRule({ commissionPercent: 100, appFeeMode: "por_entrada", entryFeeCents: 1500 });
assert.equal(computePlatformFeeCents(doctorEntry, "entrada", 0), 1500);
assert.equal(computePlatformFeeCents(doctorEntry, "atendimento", 40000), 0);

console.log("platform-fees + pix admin ok");
