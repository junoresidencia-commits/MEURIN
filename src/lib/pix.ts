// Gera o código PIX "Copia e Cola" (BR Code EMV) a partir dos dados do médico.
// Puro e client-safe. O QR pode ser gerado a partir desta string.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/** Remove acentos e caracteres não permitidos; caixa alta; limita tamanho. */
function sanitize(text: string, max: number): string {
  const noAccents = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return noAccents.slice(0, max) || "";
}

/** CRC16-CCITT (0x1021, init 0xFFFF) — exigido no campo 63 do BR Code. */
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

export interface PixCodeInput {
  key: string; // chave PIX (CPF/CNPJ só dígitos, telefone com +55, e-mail, ou aleatória)
  name?: string; // nome do favorecido
  city?: string; // cidade do recebedor
  amountCents?: number; // valor fixo (opcional)
  txid?: string; // identificador (opcional)
}

/**
 * Monta a string "PIX Copia e Cola". Retorna "" se não houver chave.
 * Aceita valor fixo (campo 54) quando amountCents > 0.
 */
export function buildPixCode(input: PixCodeInput): string {
  const key = String(input.key || "").trim();
  if (!key) return "";

  const name = sanitize(input.name || "RECEBEDOR", 25) || "RECEBEDOR";
  const city = sanitize(input.city || "BRASIL", 15) || "BRASIL";
  const txid = sanitize(input.txid || "***", 25) || "***";

  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);

  let payload = "";
  payload += tlv("00", "01"); // Payload Format Indicator
  payload += tlv("26", merchantAccount); // Merchant Account Information (PIX)
  payload += tlv("52", "0000"); // Merchant Category Code
  payload += tlv("53", "986"); // Moeda: BRL
  if (input.amountCents && input.amountCents > 0) {
    payload += tlv("54", (input.amountCents / 100).toFixed(2)); // Valor
  }
  payload += tlv("58", "BR"); // País
  payload += tlv("59", name); // Nome do recebedor
  payload += tlv("60", city); // Cidade
  payload += tlv("62", tlv("05", txid)); // Additional data (txid)

  const toCrc = `${payload}6304`;
  return `${toCrc}${crc16(toCrc)}`;
}

/** Formata a chave PIX de forma amigável conforme o tipo, para exibição. */
export function maskPixKeyForDisplay(key: string): string {
  return key; // no pagamento exibimos a chave completa (necessária para pagar)
}
