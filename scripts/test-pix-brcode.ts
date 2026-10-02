import assert from "node:assert/strict";
import { buildBookingPix, buildPixBrCode, doctorPixKey } from "../src/lib/pix-brcode";
import { computeSplit } from "../src/lib/types";

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const code = buildPixBrCode({
  key: "carlos@meurim.com",
  holderName: "Carlos Nefro",
  city: "Salvador",
  amountCents: 40000,
  txid: "bk1234567890",
});

assert.ok(code.startsWith("000201"), "payload format");
assert.match(code, /0014br\.gov\.bcb\.pix/, "GUI Pix");
assert.match(code, /0117carlos@meurim.com/, "chave do médico");
assert.match(code, /5406400.00/, "valor R$ 400,00 no campo 54");
assert.match(code, /0512bk1234567890/, "txid da consulta");
assert.equal(code.slice(-4), crc16(code.slice(0, -4)), "CRC-16 válido");

const noAmount = buildPixBrCode({ key: "ana@meurim.com", holderName: "Ana" });
assert.doesNotMatch(noAmount, /54\d{2}\d+\.\d{2}/, "sem valor quando amountCents omitido");

assert.equal(doctorPixKey({ name: "X" }), null);
assert.deepEqual(doctorPixKey({ name: "Carlos", pixKey: "carlos@meurim.com" }), {
  key: "carlos@meurim.com",
  holderName: "Carlos",
  city: undefined,
});
assert.deepEqual(
  doctorPixKey({
    name: "Carlos",
    pixKey: "legado@meurim.com",
    pixProfile: { key: "pix-nova", holderName: "Dr Carlos", city: "Salvador" },
  }),
  { key: "pix-nova", holderName: "Dr Carlos", city: "Salvador" }
);

const bookingPix = buildBookingPix(
  { name: "Carlos", pixKey: "carlos@meurim.com" },
  { id: "abc-def-ghi", priceCents: 35000 }
);
assert.ok(bookingPix);
assert.match(bookingPix.brCode, /5406350.00/);
assert.equal(bookingPix.amountCents, 35000);
assert.equal(bookingPix.holderName, "Carlos");
assert.equal(buildBookingPix({ name: "Sem chave" }, { id: "x", priceCents: 100 }), null);

assert.deepEqual(computeSplit(40000, 80), { doctorPayoutCents: 32000, platformFeeCents: 8000 });
assert.deepEqual(computeSplit(40000, 100), { doctorPayoutCents: 40000, platformFeeCents: 0 });

console.log("pix-brcode + split ok", code.slice(0, 40) + "…");
