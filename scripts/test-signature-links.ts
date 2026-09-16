import assert from "node:assert/strict";
import { SIGNATURE_LINKS } from "../src/lib/signature-links";

const hosts = {
  vidaasInfo: "validcertificadora.com.br",
  vidaasAndroid: "play.google.com",
  vidaasIos: "apps.apple.com",
  govAssinador: "assinador.iti.br",
  validarIti: "validar.iti.gov.br",
  cfmCertificado: "certificadodigital.cfm.org.br",
} as const;

for (const [key, host] of Object.entries(hosts)) {
  const url = SIGNATURE_LINKS[key as keyof typeof SIGNATURE_LINKS];
  assert.ok(url.startsWith("https://"), `${key} precisa ser https`);
  assert.ok(url.includes(host), `${key} deve apontar para ${host}: ${url}`);
}

console.log("signature-links ok", Object.keys(SIGNATURE_LINKS));
