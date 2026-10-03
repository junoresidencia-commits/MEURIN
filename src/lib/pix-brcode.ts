/* ============================================================================
   Pix "copia e cola" (BR Code EMV do Banco Central).
   Puro, sem dependências. Gera o payload para o paciente pagar direto na chave
   cadastrada pelo médico. Com amountCents, o valor da consulta vai no campo 54.
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

/** Monta o BR Code (copia e cola) a partir da chave e dados do recebedor.
 *  Com amountCents, gera Pix dinâmico com o valor da consulta. */
export function buildPixBrCode(opts: {
  key: string;
  holderName?: string;
  city?: string;
  amountCents?: number;
  txid?: string;
}): string {
  const key = (opts.key || "").trim();
  if (!key) return "";
  const name = sanitize(opts.holderName || "RECEBEDOR", 25) || "RECEBEDOR";
  const city = sanitize(opts.city || "BRASIL", 15) || "BRASIL";
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const gui = tlv("00", "br.gov.bcb.pix");
  const merchantAccount = tlv("26", gui + tlv("01", key));
  const additional = tlv("62", tlv("05", txid));
  const amount =
    typeof opts.amountCents === "number" && opts.amountCents > 0
      ? tlv("54", (opts.amountCents / 100).toFixed(2))
      : "";

  const payloadNoCrc =
    tlv("00", "01") + // Payload Format Indicator
    merchantAccount +
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Moeda BRL
    amount +
    tlv("58", "BR") + // País
    tlv("59", name) + // Nome do recebedor
    tlv("60", city) + // Cidade
    additional +
    "6304"; // ID + len do CRC

  return payloadNoCrc + crc16(payloadNoCrc);
}

export function doctorPixKey(doctor: { name?: string; pixKey?: string; pixProfile?: { key?: string; holderName?: string; city?: string } | null }): {
  key: string;
  holderName?: string;
  city?: string;
} | null {
  const key = (doctor.pixProfile?.key || doctor.pixKey || "").trim();
  if (!key) return null;
  return {
    key,
    holderName: doctor.pixProfile?.holderName || doctor.name,
    city: doctor.pixProfile?.city,
  };
}

export function buildProfessionalPix(
  professional: { name?: string; pixKey?: string; pixProfile?: { key?: string; holderName?: string; city?: string } | null },
  charge: { id: string; priceCents: number },
  fallbackHolder = "Profissional"
) {
  const dest = doctorPixKey(professional);
  if (!dest) return null;
  const brCode = buildPixBrCode({
    key: dest.key,
    holderName: dest.holderName,
    city: dest.city,
    amountCents: charge.priceCents,
    txid: charge.id.replace(/-/g, "").slice(0, 25),
  });
  if (!brCode) return null;
  return {
    brCode,
    amountCents: charge.priceCents,
    holderName: dest.holderName || fallbackHolder,
  };
}

export function buildBookingPix(
  doctor: { name?: string; pixKey?: string; pixProfile?: { key?: string; holderName?: string; city?: string } | null },
  booking: { id: string; priceCents: number }
) {
  return buildProfessionalPix(doctor, booking, "Médico");
}
