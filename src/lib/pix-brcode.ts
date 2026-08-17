/* ============================================================================
   Pix "copia e cola" (BR Code estático — padrão EMV do Banco Central).
   Puro, sem dependências. Gera o payload para o paciente pagar direto ao médico.
   Sem valor fixo (o paciente confirma o valor no app do banco) e txid "***".
   ============================================================================ */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

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

/** Remove acentos e limita tamanho (nome/cidade do recebedor). */
function sanitize(text: string, max: number): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/** Monta o BR Code (copia e cola) estático a partir da chave e dados do recebedor. */
export function buildPixBrCode(opts: { key: string; holderName?: string; city?: string }): string {
  const key = (opts.key || "").trim();
  if (!key) return "";
  const name = sanitize(opts.holderName || "RECEBEDOR", 25) || "RECEBEDOR";
  const city = sanitize(opts.city || "BRASIL", 15) || "BRASIL";

  const gui = tlv("00", "br.gov.bcb.pix");
  const merchantAccount = tlv("26", gui + tlv("01", key));
  const additional = tlv("62", tlv("05", "***"));

  const payloadNoCrc =
    tlv("00", "01") + // Payload Format Indicator
    merchantAccount +
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Moeda BRL
    tlv("58", "BR") + // País
    tlv("59", name) + // Nome do recebedor
    tlv("60", city) + // Cidade
    additional +
    "6304"; // ID + len do CRC

  return payloadNoCrc + crc16(payloadNoCrc);
}
