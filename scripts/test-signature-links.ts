import assert from "node:assert/strict";
import { SIGNATURE_LINKS } from "../src/lib/signature-links";
import {
  DIGITAL_SIGNATURE_PROVIDERS,
  getDigitalSignatureProvider,
  isDigitalSignatureProviderId,
  listDigitalSignatureProviders,
} from "../src/lib/digital-signature/providers";
import { digitalSignatureLabel, digitalSignatureStatus } from "../src/lib/digital-signature/status";

const hosts = {
  vidaasInfo: "validcertificadora.com.br",
  vidaasAndroid: "play.google.com",
  vidaasIos: "apps.apple.com",
  govAssinador: "assinador.iti.br",
  validarIti: "validar.iti.gov.br",
  cfmCertificado: "certificadodigital.cfm.org.br",
  cfmPortalServicos: "portalservicos.cfm.org.br",
  cfmPrescricao: "prescricaoeletronica.cfm.org.br",
  cfmEcrm: "ecrm.cfm.org.br",
} as const;

for (const [key, host] of Object.entries(hosts)) {
  const url = SIGNATURE_LINKS[key as keyof typeof SIGNATURE_LINKS];
  assert.ok(url.startsWith("https://"), `${key} precisa ser https`);
  assert.ok(url.includes(host), `${key} deve apontar para ${host}: ${url}`);
}

assert.equal(DIGITAL_SIGNATURE_PROVIDERS.length, 2);
assert.ok(isDigitalSignatureProviderId("vidaas"));
assert.ok(isDigitalSignatureProviderId("cfm"));
assert.equal(isDigitalSignatureProviderId("birdid"), false);

const ordered = listDigitalSignatureProviders();
assert.equal(ordered[0].id, "vidaas", "VIDaaS é o provedor principal");
assert.equal(ordered[1].id, "cfm");

for (const provider of DIGITAL_SIGNATURE_PROVIDERS) {
  assert.equal(provider.apiReady, false, `${provider.id} não pode fingir API`);
  assert.equal(provider.deepLink, null, `${provider.id} não inventa deep link`);
  assert.ok(provider.officialLinks.length >= 2);
  for (const link of provider.officialLinks) {
    assert.ok(link.href.startsWith("https://"), link.href);
  }
}

const vidaas = getDigitalSignatureProvider("vidaas")!;
assert.equal(vidaas.officialLinks[0].href, SIGNATURE_LINKS.vidaasInfo);
const cfm = getDigitalSignatureProvider("cfm")!;
assert.equal(cfm.officialLinks[0].href, SIGNATURE_LINKS.cfmCertificado);
assert.match(cfm.honesty, /Credencial Médica/i);

assert.equal(digitalSignatureStatus({ status: "final" }), "unsigned");
assert.equal(digitalSignatureStatus({ status: "signed", signatureMethod: "eletronica" }), "unsigned");
assert.equal(digitalSignatureStatus({ status: "signed", signatureMethod: "certificada" }), "signed");
assert.equal(digitalSignatureLabel({ status: "signed", signatureMethod: "certificada" }), "Assinado digitalmente");
assert.equal(digitalSignatureLabel({}), "Não assinado");

console.log("signature-links + digital-signature providers ok", Object.keys(SIGNATURE_LINKS));
