import assert from "node:assert/strict";
import {
  buildDoctorPaymentWhatsApp,
  doctorPaymentAlertPhone,
  shouldNotifyDoctorPaymentWhatsApp,
} from "../src/lib/whatsapp-payment";

assert.equal(doctorPaymentAlertPhone({}), null);
assert.equal(doctorPaymentAlertPhone({ phone: "123" }), null);
assert.equal(doctorPaymentAlertPhone({ notifyWhatsapp: "(71) 99999-0000" }), "(71) 99999-0000");
assert.equal(doctorPaymentAlertPhone({ phone: "71988887777", notifyWhatsapp: "71911112222" }), "71911112222");
assert.equal(doctorPaymentAlertPhone({ phone: "71988887777" }), "71988887777");

assert.equal(shouldNotifyDoctorPaymentWhatsApp({}, { permMedico: true }), true);
assert.equal(shouldNotifyDoctorPaymentWhatsApp({ notifyPayments: false }, { permMedico: true }), false);
assert.equal(shouldNotifyDoctorPaymentWhatsApp({}, { permMedico: false }), false);
assert.equal(shouldNotifyDoctorPaymentWhatsApp({ notifyPayments: true }, {}), true);

const text = buildDoctorPaymentWhatsApp({
  patientName: "Maria da Silva Pix",
  slotStart: "2026-10-05T12:00:00.000Z",
  priceCents: 40000,
  bookingId: "abc-123",
  tz: "UTC",
});
assert.match(text, /pagamento identificado/i);
assert.match(text, /Paciente: Maria/);
assert.match(text, /R\$\s*400/);
assert.match(text, /abc-123/);
assert.doesNotMatch(text, /diagnóstico|exame|creatinina/i);
assert.match(text, /Confira se caiu na sua chave Pix/);

console.log("whatsapp-payment ok");
