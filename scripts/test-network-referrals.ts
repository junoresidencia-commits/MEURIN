import assert from "node:assert/strict";
import {
  DEFAULT_SHARE_SLICES,
  honorific,
  isConsentMethod,
  isProfessionalKind,
  isShareSlice,
  REFERRAL_STATUS_LABELS,
  SHARE_SLICE_LABELS,
} from "../src/lib/network-types";

assert.equal(honorific("Maria", "doctor"), "Dr(a). Maria");
assert.equal(isProfessionalKind("doctor"), true);
assert.equal(isProfessionalKind("cardiologia"), false);
assert.equal(isConsentMethod("in_person"), true);
assert.equal(isConsentMethod("whatsapp"), false);
assert.equal(isShareSlice("clinicalSummary"), true);
assert.equal(isShareSlice("prontuario_completo"), false);
assert.ok(DEFAULT_SHARE_SLICES.includes("reason"));
assert.ok(DEFAULT_SHARE_SLICES.includes("clinicalSummary"));
assert.ok(!DEFAULT_SHARE_SLICES.includes("documents"));
assert.equal(REFERRAL_STATUS_LABELS.pending, "Pendente");
assert.equal(REFERRAL_STATUS_LABELS.following, "Em acompanhamento");
assert.equal(SHARE_SLICE_LABELS.medications, "Medicamentos");

console.log("network-referrals types ok");
