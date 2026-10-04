import assert from "node:assert/strict";
import {
  normalizePixKey,
  normalizePixPhone,
  parsePixProfileInput,
  samePixKey,
  PIX_ERRORS,
} from "../src/lib/pix-key";

assert.deepEqual(normalizePixKey("cpf", "000.000.000-00").ok, false);
assert.equal(normalizePixKey("cpf", "").ok, false);

const cpf = normalizePixKey("cpf", "390.533.447-05");
assert.equal(cpf.ok, true);
if (cpf.ok) assert.equal(cpf.key, "39053344705");
assert.deepEqual(normalizePixKey("cpf", "39053344705"), cpf);

const cnpj = normalizePixKey("cnpj", "11.444.777/0001-61");
assert.equal(cnpj.ok, true);
if (cnpj.ok) assert.equal(cnpj.key, "11444777000161");

const mail = normalizePixKey("email", "  Carlos@MeuRim.com ");
assert.equal(mail.ok, true);
if (mail.ok) assert.equal(mail.key, "carlos@meurim.com");
assert.equal(normalizePixKey("email", "sem-arroba").ok, false);

assert.equal(normalizePixPhone("(77) 99999-9999"), "+5577999999999");
assert.equal(normalizePixPhone("77999999999"), "+5577999999999");
assert.equal(normalizePixPhone("+55 77 99999-9999"), "+5577999999999");
const phone = normalizePixKey("telefone", "(77) 99999-9999");
assert.equal(phone.ok, true);
if (phone.ok) assert.equal(phone.key, "+5577999999999");

const rnd = normalizePixKey("aleatoria", "{A0E07860-1C28-464A-9B8C-7E3B1A2C4D5E}");
assert.equal(rnd.ok, true);
if (rnd.ok) assert.equal(rnd.key, "a0e07860-1c28-464a-9b8c-7e3b1a2c4d5e");
assert.equal(normalizePixKey("aleatoria", "nao-e-uuid").ok, false);

const parsed = parsePixProfileInput({
  keyType: "telefone",
  key: "77 99999-9999",
  holderName: "Dr Carlos",
  city: "Irecê",
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.profile.key, "+5577999999999");
  assert.equal(parsed.profile.holderName, "Dr Carlos");
}

assert.equal(parsePixProfileInput({ key: "x" }).ok, false);
assert.equal(samePixKey("390.533.447-05", "39053344705"), true);
assert.equal(samePixKey("+5577999999999", "77999999999"), true);
assert.equal(PIX_ERRORS.saved, "Chave PIX salva com sucesso.");
assert.equal(PIX_ERRORS.invalid, "A chave PIX informada é inválida.");

console.log("pix-key ok");
